import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayPgnGame, splitPgnGames } from '../../app.js';

const FILES = 'abcdefgh';
const RANKS = '12345678';
const PROMOTIONS = ['', 'q', 'r', 'b', 'n'];

function normalizeHeader(value) {
  const text = String(value || '').trim();
  return text && text !== '?' ? text : '';
}

function parsePgnYear(dateText) {
  const year = String(dateText || '').trim().match(/^(\d{4})/)?.[1];
  return year ? Number(year) : 0;
}

export function isEligibleOfflineGame(headers = {}, {
  minYear = 2010,
  minElo = 2000
} = {}) {
  const year = parsePgnYear(headers.Date);
  const whiteElo = Number.parseInt(headers.WhiteElo, 10) || 0;
  const blackElo = Number.parseInt(headers.BlackElo, 10) || 0;
  return year >= minYear && whiteElo > minElo && blackElo > minElo;
}

function addString(table, index, value) {
  const normalized = normalizeHeader(value);
  if (index.has(normalized)) return index.get(normalized);
  const id = table.length;
  table.push(normalized);
  index.set(normalized, id);
  return id;
}

export function squareCode(square) {
  const file = FILES.indexOf(String(square || '')[0]);
  const rank = RANKS.indexOf(String(square || '')[1]);
  if (file < 0 || rank < 0) throw new Error(`Invalid square ${square}`);
  return rank * 8 + file;
}

function codeSquare(code) {
  const square = Number(code);
  if (!Number.isInteger(square) || square < 0 || square > 63) throw new Error(`Invalid square code ${code}`);
  return `${FILES[square % 8]}${RANKS[Math.floor(square / 8)]}`;
}

export function packMove(uci) {
  const text = String(uci || '').trim();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text)) throw new Error(`Invalid UCI move ${uci}`);
  const from = squareCode(text.slice(0, 2));
  const to = squareCode(text.slice(2, 4));
  const promotion = PROMOTIONS.indexOf(text[4] || '');
  if (promotion < 0) throw new Error(`Invalid promotion ${text[4]}`);
  return from | (to << 6) | (promotion << 12);
}

function unpackMove(packed) {
  const value = Number(packed);
  const from = value & 0x3f;
  const to = (value >> 6) & 0x3f;
  const promotion = (value >> 12) & 0x7;
  if (promotion >= PROMOTIONS.length) throw new Error(`Invalid packed promotion ${promotion}`);
  return `${codeSquare(from)}${codeSquare(to)}${PROMOTIONS[promotion]}`;
}

export function encodeMoveList(moves) {
  const buffer = Buffer.alloc((Array.isArray(moves) ? moves.length : 0) * 2);
  moves.forEach((move, index) => {
    buffer.writeUInt16LE(packMove(move), index * 2);
  });
  return buffer;
}

export function decodeMoveBuffer(buffer, offset = 0, count = Math.floor((buffer?.length || 0) / 2)) {
  const moves = [];
  const start = Number(offset) || 0;
  const total = Number(count) || 0;
  for (let index = 0; index < total; index += 1) {
    moves.push(unpackMove(buffer.readUInt16LE((start + index) * 2)));
  }
  return moves;
}

function compactGameFromReplay(replay, stringTable, stringIndex, moveOffset) {
  const headers = replay.headers || {};
  return {
    event: addString(stringTable, stringIndex, headers.Event),
    site: addString(stringTable, stringIndex, headers.Site),
    date: addString(stringTable, stringIndex, headers.Date),
    round: addString(stringTable, stringIndex, headers.Round),
    white: addString(stringTable, stringIndex, headers.White),
    black: addString(stringTable, stringIndex, headers.Black),
    result: addString(stringTable, stringIndex, headers.Result),
    eco: addString(stringTable, stringIndex, headers.ECO),
    whiteElo: Number.parseInt(headers.WhiteElo, 10) || 0,
    blackElo: Number.parseInt(headers.BlackElo, 10) || 0,
    moveOffset,
    moveCount: replay.moves.length
  };
}

export function collectCompactGameBatch(pgn, {
  sourceName = 'memory',
  minYear = 2010,
  minElo = 2000
} = {}) {
  const games = [];
  const errors = [];
  const stringTable = [];
  const stringIndex = new Map();
  const moveParts = [];
  let moveOffset = 0;
  let skippedByFilter = 0;

  splitPgnGames(pgn).forEach((gameText, index) => {
    try {
      const replay = replayPgnGame(gameText);
      if (!isEligibleOfflineGame(replay.headers, { minYear, minElo })) {
        skippedByFilter += 1;
        return;
      }
      const uciMoves = replay.moves.map((move) => move.uci);
      const encoded = encodeMoveList(uciMoves);
      games.push(compactGameFromReplay(replay, stringTable, stringIndex, moveOffset));
      moveParts.push(encoded);
      moveOffset += uciMoves.length;
    } catch (error) {
      errors.push({
        sourceName,
        gameIndex: index + 1,
        message: error?.message || String(error)
      });
    }
  });

  return {
    version: 1,
    sourceName,
    stringTable,
    games,
    moveBuffer: Buffer.concat(moveParts),
    skippedByFilter,
    errors
  };
}

function estimateCompactJsonBytes(batch) {
  const serializable = {
    version: batch.version,
    sourceName: batch.sourceName,
    stringTable: batch.stringTable,
    games: batch.games
  };
  return Buffer.byteLength(JSON.stringify(serializable), 'utf8') + batch.moveBuffer.length;
}

export function summarizeCompactBatch(batch, sourceBytes = 0) {
  const compactBytes = estimateCompactJsonBytes(batch);
  const moveCount = batch.games.reduce((total, game) => total + game.moveCount, 0);
  return {
    sourceName: batch.sourceName,
    games: batch.games.length,
    skipped: batch.errors.length + (Number(batch.skippedByFilter) || 0),
    skippedByFilter: Number(batch.skippedByFilter) || 0,
    skippedByError: batch.errors.length,
    moves: moveCount,
    strings: batch.stringTable.length,
    sourceBytes,
    compactBytes,
    ratio: sourceBytes ? compactBytes / sourceBytes : 0,
    bytesPerGame: batch.games.length ? compactBytes / batch.games.length : 0,
    bytesPerMove: moveCount ? compactBytes / moveCount : 0
  };
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

export function formatCompactSummary(summary) {
  const reduction = summary.sourceBytes ? (1 - summary.ratio) * 100 : 0;
  return [
    `Source: ${summary.sourceName}`,
    `Games: ${summary.games}`,
    `Skipped: ${summary.skipped}`,
    `Moves: ${summary.moves}`,
    `Source bytes: ${formatBytes(summary.sourceBytes)}`,
    `Estimated compact bytes: ${formatBytes(summary.compactBytes)}`,
    `Ratio: ${(summary.ratio * 100).toFixed(2)}%`,
    `Reduction: ${reduction.toFixed(2)}%`,
    `Bytes/game: ${summary.bytesPerGame.toFixed(1)}`,
    `Bytes/move: ${summary.bytesPerMove.toFixed(1)}`
  ].join('\n');
}

function main(argv) {
  const pgnPath = argv[2];
  if (!pgnPath) {
    console.error('Usage: node tools/player-prep/compact-games.mjs <file.pgn>');
    process.exitCode = 1;
    return;
  }

  const pgn = readFileSync(pgnPath, 'utf8');
  const batch = collectCompactGameBatch(pgn, { sourceName: basename(pgnPath) });
  const summary = summarizeCompactBatch(batch, statSync(pgnPath).size);
  console.log(formatCompactSummary(summary));
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) : '';
if (invokedPath && process.argv[1] === invokedPath) {
  main(process.argv);
}
