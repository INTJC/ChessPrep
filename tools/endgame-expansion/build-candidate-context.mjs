import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { replayPgnGame, splitPgnGames } from '../../app.js';
import { listRawPgnFiles } from './scan-pgn-endgames.mjs';

function parseArgs(argv) {
  const args = {
    shortlist: null,
    rawDir: join(process.cwd(), 'data', 'endgame-expansion', 'sources', 'raw'),
    output: null,
    offset: 0,
    limit: 40,
    before: 8,
    after: 12
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--shortlist') args.shortlist = argv[++index];
    else if (arg === '--raw-dir') args.rawDir = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--offset') args.offset = Number(argv[++index]) || args.offset;
    else if (arg === '--limit') args.limit = Number(argv[++index]) || args.limit;
    else if (arg === '--before') args.before = Number(argv[++index]) || args.before;
    else if (arg === '--after') args.after = Number(argv[++index]) || args.after;
  }
  return args;
}

function sourceGameId(headers, file, gameIndex) {
  return [
    basename(file),
    headers.Event || 'event',
    headers.Date || 'date',
    headers.White || 'white',
    headers.Black || 'black',
    gameIndex
  ].join('|');
}

export function sourceGameLookupKey(sourceGameIdValue) {
  const parts = String(sourceGameIdValue || '').split('|');
  return {
    fileName: parts[0] || '',
    gameIndex: Number(parts[5]) || null
  };
}

export function buildCandidateContext(candidate, gameText, file, gameIndex, options = {}) {
  const before = Number(options.before) || 8;
  const after = Number(options.after) || 12;
  const replay = replayPgnGame(gameText);
  let focusIndex = replay.moves.findIndex((move) => (
    move.ply >= candidate.startPly - 2
    && move.ply <= candidate.startPly + 3
    && move.uci === candidate.suggestedFirstMove
  ));
  if (focusIndex < 0) {
    focusIndex = replay.moves.findIndex((move) => move.ply === candidate.startPly + 1);
  }
  if (focusIndex < 0) {
    throw new Error(`Cannot find focus ply ${candidate.startPly + 1} for ${candidate.id}`);
  }
  const start = Math.max(0, focusIndex - before);
  const end = Math.min(replay.moves.length, focusIndex + after + 1);
  return {
    id: candidate.id,
    category: candidate.category || '',
    sourceGameId: sourceGameId(replay.headers, file, gameIndex),
    headers: replay.headers,
    focusPly: candidate.startPly + 1,
    focusMove: replay.moves[focusIndex],
    candidateFen: candidate.fen,
    suggestedFirstMove: candidate.suggestedFirstMove,
    sourceLine: Array.isArray(candidate.sourceLine) ? candidate.sourceLine.map((move) => ({ ...move })) : [],
    window: replay.moves.slice(start, end).map((move) => ({
      ply: move.ply,
      san: move.san,
      uci: move.uci,
      beforeFen: move.beforeFen,
      afterFen: move.afterFen
    })),
    fullMoveCount: replay.moves.length,
    sourcePgnFile: file
  };
}

function buildGameIndex(files, requiredGames = null) {
  const index = new Map();
  const errors = [];
  for (const file of files) {
    const wantedForFile = requiredGames?.get(basename(file));
    if (requiredGames && !wantedForFile) continue;
    const games = splitPgnGames(readFileSync(file, 'utf8'));
    for (const [gameOffset, gameText] of games.entries()) {
      const gameIndex = gameOffset + 1;
      if (wantedForFile && !wantedForFile.has(gameIndex)) continue;
      try {
        const replay = replayPgnGame(gameText);
        index.set(sourceGameId(replay.headers, file, gameIndex), {
          file,
          gameIndex,
          gameText
        });
      } catch (error) {
        errors.push(`${basename(file)} game ${gameIndex}: ${error.message}`);
      }
    }
  }
  return { index, errors };
}

export function buildContexts(shortlistData, rawDir, options = {}) {
  const offset = Math.max(0, Number(options.offset) || 0);
  const selected = (shortlistData.shortlist || []).slice(offset, offset + (Number(options.limit) || 40));
  const requiredGames = new Map();
  for (const candidate of selected) {
    const lookup = sourceGameLookupKey(candidate.sourceGameId);
    if (!lookup.fileName || !lookup.gameIndex) continue;
    if (!requiredGames.has(lookup.fileName)) requiredGames.set(lookup.fileName, new Set());
    requiredGames.get(lookup.fileName).add(lookup.gameIndex);
  }
  const files = listRawPgnFiles(rawDir).filter((file) => requiredGames.has(basename(file)));
  const { index, errors } = buildGameIndex(files, requiredGames);
  const contexts = [];
  const missing = [];

  for (const candidate of selected) {
    const game = index.get(candidate.sourceGameId);
    if (!game) {
      missing.push(candidate.id);
      continue;
    }
    try {
      contexts.push(buildCandidateContext(candidate, game.gameText, game.file, game.gameIndex, options));
    } catch (error) {
      errors.push(`${candidate.id}: ${error.message}`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    rawDir,
    shortlistGeneratedAt: shortlistData.generatedAt || null,
    offset,
    contexts,
    missing,
    errors
  };
}

export function main() {
  const args = parseArgs(process.argv);
  if (!args.shortlist || !args.output) {
    console.error('Usage: node tools/endgame-expansion/build-candidate-context.mjs --shortlist shortlist.json --output contexts.json [--raw-dir raw]');
    process.exit(1);
  }
  const shortlistData = JSON.parse(readFileSync(args.shortlist, 'utf8'));
  const result = buildContexts(shortlistData, args.rawDir, args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, JSON.stringify(result, null, 2));
  console.log(`Built ${result.contexts.length} candidate contexts.`);
  if (result.missing.length) console.log(`Missing source games: ${result.missing.length}`);
  if (result.errors.length) console.log(`Context errors: ${result.errors.length}`);
  console.log(`Wrote ${args.output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
