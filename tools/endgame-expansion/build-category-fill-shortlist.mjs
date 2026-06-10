import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { playLegalUciMove, replayPgnGame, splitPgnGames } from '../../app.js';
import {
  classicalTimeControlEvidence,
  listRawPgnFiles,
  numericElo,
  passesEliteGate
} from './scan-pgn-endgames.mjs';

const ROOT = process.cwd();
const RAW_DIR = join(ROOT, 'data', 'endgame-expansion', 'sources', 'raw');
const DEFAULT_OUTPUT = join(ROOT, 'data', 'endgame-expansion', 'reports', 'category-fill-effective-shortlist.json');
const MIN_BOTH_ELO = 2650;
const MIN_SOURCE_PLIES = 8;
const COMPLETE_SOURCE_DATE_RE = /^\d{4}\.\d{2}\.\d{2}$/;
const REJECT_EVENT_PATTERN = 'tcec|computer|engine|stockfish|komodo|lc0|leela|dragon|cct_|champions chess tour|speed chess|esports|rapid|blitz|bullet|online|internet|pro league|icc|chess\\.com|lichess|prelim|play-in|\\btb\\b|tiebreak|tie-break|blindfold|armageddon|banter|showdown|basque|fischer random|freestyle|frd';
const CLASSICAL_EVENT_PATTERN = 'Candidates|WCh|World Championship|World Cup|Grand Swiss|Grand Prix|FIDE GP|Tata Steel|Corus A|Norway Chess|Sinquefield|London Classic|London Chess Classic|GRENKE|Dortmund|Linares|Pearl Spring|Tal Mem|Tal Memorial|Aerosvit|M-Tel|Final Masters|Grand Slam|Shamkir|Gashimov|Olympiad|European Teams|World Teams|Chennai Grand Masters|Bundesliga|US Championship|Grand Chess Tour|Superbet';

function parseArgs(argv) {
  const args = {
    output: DEFAULT_OUTPUT,
    rawDir: RAW_DIR,
    categories: ['queen-endgames', 'single-rook-defense'],
    target: 120,
    minSourcePlies: MIN_SOURCE_PLIES
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') args.output = argv[++index];
    else if (arg === '--raw-dir') args.rawDir = argv[++index];
    else if (arg === '--categories') args.categories = String(argv[++index] || '').split(',').filter(Boolean);
    else if (arg === '--target') args.target = Number(argv[++index]) || args.target;
    else if (arg === '--min-source-plies') args.minSourcePlies = Number(argv[++index]) || args.minSourcePlies;
  }
  return args;
}

function safeIdPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'unknown';
}

function sourceIdForFile(file) {
  return /lichess-broadcast-db/i.test(file.replaceAll('\\', '/')) ? 'lichess-broadcast-db' : 'pgnmentor-files';
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

function winnerFor(result) {
  if (result === '1-0') return 'w';
  if (result === '0-1') return 'b';
  return null;
}

function targetFor(result, orientation) {
  const winner = winnerFor(result);
  if (winner && orientation === winner) return 'win';
  if (result === '1/2-1/2') return 'draw';
  return null;
}

function materialProfile(fen) {
  const placement = String(fen || '').split(/\s+/)[0] || '';
  const profile = { queens: 0, rooks: 0, bishops: 0, knights: 0, pawns: 0 };
  for (const piece of placement) {
    if (piece === '/' || /\d/.test(piece)) continue;
    const upper = piece.toUpperCase();
    if (upper === 'Q') profile.queens += 1;
    else if (upper === 'R') profile.rooks += 1;
    else if (upper === 'B') profile.bishops += 1;
    else if (upper === 'N') profile.knights += 1;
    else if (upper === 'P') profile.pawns += 1;
  }
  profile.minors = profile.bishops + profile.knights;
  return profile;
}

function categoryFromFen(fen) {
  const profile = materialProfile(fen);
  if (profile.queens > 0 && profile.minors > 0) return 'queen-minor-endgames';
  if (profile.queens > 0) return 'queen-endgames';
  if (profile.rooks > 0 && profile.minors > 0) return 'rook-minor-activity';
  if (profile.rooks === 2 && profile.minors === 0) return 'single-rook-defense';
  if (profile.rooks >= 2) return 'rook-activity';
  if (profile.rooks === 1) return 'single-rook-defense';
  return 'practical-themes';
}

function effectiveCategoryForMove(move, reply) {
  const afterFirstMove = move.afterFen || playLegalUciMove(move.beforeFen, move.uci).nextFen;
  const afterFirstPair = reply
    ? reply.afterFen || playLegalUciMove(afterFirstMove, reply.uci).nextFen
    : afterFirstMove;
  const firstMoveCategory = categoryFromFen(afterFirstMove);
  const firstPairCategory = categoryFromFen(afterFirstPair);
  return firstMoveCategory === firstPairCategory ? firstPairCategory : 'practical-themes';
}

function eventBoost(event) {
  return new RegExp(CLASSICAL_EVENT_PATTERN, 'i').test(event || '') ? 100 : 0;
}

function candidateScore(candidate) {
  const minElo = Math.min(candidate.source.whiteElo || 0, candidate.source.blackElo || 0);
  const targetBoost = candidate.trainingTarget === 'draw' ? 35 : 0;
  return eventBoost(candidate.source.event) + Math.max(0, minElo - MIN_BOTH_ELO) + targetBoost + candidate.complexityScore * 10;
}

export function buildCategoryFillShortlist({ rawDir = RAW_DIR, categories = [], target = 120, minSourcePlies = MIN_SOURCE_PLIES } = {}) {
  const categorySet = new Set(categories);
  const candidates = [];
  const errors = [];
  let gamesSeen = 0;

  for (const file of listRawPgnFiles(rawDir)) {
    const sourceId = sourceIdForFile(file);
    const games = splitPgnGames(readFileSync(file, 'utf8'));
    for (const [gameOffset, gameText] of games.entries()) {
      gamesSeen += 1;
      let replay;
      try {
        replay = replayPgnGame(gameText);
      } catch (error) {
        errors.push(`${basename(file)} game ${gameOffset + 1}: ${error.message}`);
        continue;
      }
      if (!COMPLETE_SOURCE_DATE_RE.test(replay.headers.Date || '')) continue;
      if ((replay.headers.Variant || 'Standard') !== 'Standard') continue;
      if (!passesEliteGate(replay.headers, {
        minBothElo: MIN_BOTH_ELO,
        rejectEventPattern: REJECT_EVENT_PATTERN,
        requireClassicalEvidence: true,
        classicalEventPattern: CLASSICAL_EVENT_PATTERN
      })) continue;

      const timeControl = classicalTimeControlEvidence(replay.headers, { classicalEventPattern: CLASSICAL_EVENT_PATTERN });
      for (const [moveIndex, move] of replay.moves.entries()) {
        if (move.ply < 40) continue;
        if (replay.moves.length - moveIndex < minSourcePlies) continue;
        const orientation = move.beforeFen.split(/\s+/)[1];
        const trainingTarget = targetFor(replay.headers.Result, orientation);
        if (!trainingTarget) continue;
        const reply = replay.moves[moveIndex + 1] || null;
        const effectiveCategory = effectiveCategoryForMove(move, reply);
        if (!categorySet.has(effectiveCategory)) continue;

        candidates.push({
          id: `candidate-${sourceId}-category-fill-${safeIdPart(basename(file))}-${gameOffset + 1}-${move.ply}`,
          category: effectiveCategory,
          title: `${replay.headers.White || 'White'} - ${replay.headers.Black || 'Black'}: move ${move.ply}`,
          level: '候选高水平复杂残局',
          goal: `${orientation === 'w' ? '白先' : '黑先'}，判断关键残局计划`,
          fen: move.beforeFen,
          orientation,
          complexityScore: effectiveCategory === 'single-rook-defense' ? 8 : 9,
          trainingTarget,
          sourceId,
          sourceGameId: sourceGameId(replay.headers, file, gameOffset + 1),
          startPly: move.ply - 1,
          playerQualityReason: `${replay.headers.White} vs ${replay.headers.Black}, ${replay.headers.Event} ${replay.headers.Date}. Selected by category-fill effective material scan.`,
          scanReasons: [
            'effective category survives the first training move pair',
            `${MIN_BOTH_ELO}+ classical source evidence`,
            trainingTarget === 'win' ? 'training side matches the eventual winner' : 'drawn game candidate for defensive pressure review'
          ],
          suggestedFirstMove: move.uci,
          sourceLine: replay.moves.slice(moveIndex, moveIndex + minSourcePlies).map((lineMove) => ({
            ply: lineMove.ply,
            san: lineMove.san,
            uci: lineMove.uci,
            beforeFen: lineMove.beforeFen,
            afterFen: lineMove.afterFen
          })),
          source: {
            white: replay.headers.White || '',
            black: replay.headers.Black || '',
            event: replay.headers.Event || '',
            site: replay.headers.Site || '',
            date: replay.headers.Date || '',
            result: replay.headers.Result || '',
            whiteElo: numericElo(replay.headers.WhiteElo),
            blackElo: numericElo(replay.headers.BlackElo),
            timeControl,
            variant: replay.headers.Variant || 'Standard'
          },
          shortlistStatus: 'needs-original-analysis',
          reviewTier: 'category-fill-review',
          sourceFile: basename(file)
        });
      }
    }
  }

  candidates.sort((a, b) => candidateScore(b) - candidateScore(a)
    || a.category.localeCompare(b.category)
    || a.sourceGameId.localeCompare(b.sourceGameId)
    || a.startPly - b.startPly
    || a.id.localeCompare(b.id));

  const selected = [];
  const startTasks = new Set();
  const byGame = new Map();
  for (const candidate of candidates) {
    if (!byGame.has(candidate.sourceGameId)) byGame.set(candidate.sourceGameId, []);
    byGame.get(candidate.sourceGameId).push(candidate);
  }
  const groups = [...byGame.values()].sort((a, b) => candidateScore(b[0]) - candidateScore(a[0])
    || a[0].sourceGameId.localeCompare(b[0].sourceGameId));
  let round = 0;
  let added = true;
  while (added && selected.length < target) {
    added = false;
    for (const group of groups) {
      const candidate = group[round];
      if (!candidate) continue;
      const startTask = `${candidate.fen}|${candidate.suggestedFirstMove}`;
      if (startTasks.has(startTask)) continue;
      selected.push(candidate);
      startTasks.add(startTask);
      added = true;
      if (selected.length >= target) break;
    }
    round += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'effective-category-fill-shortlist',
    rawDir,
    gamesSeen,
    target,
    requestedCategories: categories,
    shortlist: selected,
    counts: {
      scannedCandidates: candidates.length,
      shortlisted: selected.length,
      byCategory: selected.reduce((counts, candidate) => {
        counts[candidate.category] = (counts[candidate.category] || 0) + 1;
        return counts;
      }, {})
    },
    errors
  };
}

export function main() {
  const args = parseArgs(process.argv);
  const result = buildCategoryFillShortlist(args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    gamesSeen: result.gamesSeen,
    scannedCandidates: result.counts.scannedCandidates,
    shortlisted: result.counts.shortlisted,
    byCategory: result.counts.byCategory,
    output: args.output
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
