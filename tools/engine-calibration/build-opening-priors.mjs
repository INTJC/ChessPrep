import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { replayPgnGame, splitPgnGames } from '../../app.js';

const DEFAULT_SOURCE_DIR = 'data/endgame-expansion/sources/raw';
const DEFAULT_OUTPUT = 'data/engine-calibration/opening-priors.json';
const DEFAULT_MIN_PLY = 1;
const DEFAULT_MAX_PLY = 24;
const DEFAULT_MIN_GAMES = 2;
const FAST_EVENT_PATTERN = /\b(blitz|rapid|bullet|armageddon|banter|titled|3-0|1-0|hyperbullet|speed|chess\.com|chess24|clutch|pro league|charity cup|cct|online|internet|superrapid)\b/i;

const ELO_BINS = [
  { profileId: 'human-2200', min: 2150, max: 2250 },
  { profileId: 'human-2400', min: 2350, max: 2450 },
  { profileId: 'human-2600', min: 2550, max: 2650 },
  { profileId: 'human-2700', min: 2680, max: 2760 }
];

export function parseArgs(argv) {
  const args = {
    sourceDir: DEFAULT_SOURCE_DIR,
    output: DEFAULT_OUTPUT,
    minPly: DEFAULT_MIN_PLY,
    maxPly: DEFAULT_MAX_PLY,
    minGames: DEFAULT_MIN_GAMES,
    excludeFastEvents: true
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source-dir') args.sourceDir = argv[++index] || args.sourceDir;
    else if (arg === '--output') args.output = argv[++index] || args.output;
    else if (arg === '--min-ply') args.minPly = Number(argv[++index]) || args.minPly;
    else if (arg === '--max-ply') args.maxPly = Number(argv[++index]) || args.maxPly;
    else if (arg === '--min-games') args.minGames = Number(argv[++index]) || args.minGames;
    else if (arg === '--include-fast-events') args.excludeFastEvents = false;
  }

  return args;
}

export function collectOpeningPriorsFromPgnTexts(inputs, options = {}) {
  const merged = {
    minPly: DEFAULT_MIN_PLY,
    maxPly: DEFAULT_MAX_PLY,
    minGames: DEFAULT_MIN_GAMES,
    excludeFastEvents: true,
    ...options
  };
  const positionMap = new Map();
  const sourceFiles = new Set();
  let gameCount = 0;
  let replayErrorCount = 0;
  let skippedByEloCount = 0;
  let skippedFastEventCount = 0;

  for (const input of inputs) {
    sourceFiles.add(input.sourceFile || '');
    for (const gameText of splitPgnGames(input.text || '')) {
      gameCount += 1;
      let replay = null;
      try {
        replay = replayPgnGame(gameText);
      } catch {
        replayErrorCount += 1;
        continue;
      }

      if (merged.excludeFastEvents && isFastOrOnlineEvent(replay.headers)) {
        skippedFastEventCount += 1;
        continue;
      }

      let matchedAnySide = false;
      for (const side of ['w', 'b']) {
        const elo = sideElo(replay.headers, side);
        const bins = binsForElo(elo);
        if (!bins.length) continue;
        matchedAnySide = true;
        for (const move of replay.moves) {
          if (move.ply < merged.minPly || move.ply > merged.maxPly) continue;
          if (move.beforeFen.split(/\s+/)[1] !== side) continue;
          for (const bin of bins) addPriorMove(positionMap, move.beforeFen, bin.profileId, move.uci);
        }
      }

      if (!matchedAnySide) skippedByEloCount += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: {
      dataset: 'Local public PGN files',
      files: [...sourceFiles].filter(Boolean).sort(),
      gameCount,
      replayErrorCount,
      skippedByEloCount,
      skippedFastEventCount
    },
    settings: {
      minPly: merged.minPly,
      maxPly: merged.maxPly,
      minGames: merged.minGames,
      excludeFastEvents: merged.excludeFastEvents,
      bins: ELO_BINS
    },
    positions: finalizePositions(positionMap, merged.minGames)
  };
}

export function buildOpeningPriors(options = {}) {
  const merged = {
    sourceDir: DEFAULT_SOURCE_DIR,
    ...options
  };
  const files = listPgnFiles(merged.sourceDir);
  return collectOpeningPriorsFromPgnTexts(
    files.map((file) => ({ sourceFile: file, text: readFileSync(file, 'utf8') })),
    merged
  );
}

function listPgnFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listPgnFiles(fullPath);
    return /\.pgn$/i.test(entry.name) ? [fullPath] : [];
  }).sort();
}

function addPriorMove(positionMap, fen, profileId, move) {
  if (!positionMap.has(fen)) positionMap.set(fen, new Map());
  const byProfile = positionMap.get(fen);
  if (!byProfile.has(profileId)) byProfile.set(profileId, new Map());
  const byMove = byProfile.get(profileId);
  byMove.set(move, (byMove.get(move) || 0) + 1);
}

function finalizePositions(positionMap, minGames) {
  const positions = {};
  for (const [fen, byProfile] of positionMap.entries()) {
    const profiles = {};
    for (const [profileId, byMove] of byProfile.entries()) {
      const games = [...byMove.values()].reduce((sum, count) => sum + count, 0);
      if (games < minGames) continue;
      profiles[profileId] = {
        games,
        moves: [...byMove.entries()]
          .map(([move, count]) => ({
            move,
            count,
            frequency: roundFrequency(count / games)
          }))
          .sort((a, b) => b.count - a.count || a.move.localeCompare(b.move))
      };
    }
    if (Object.keys(profiles).length) positions[fen] = { profiles };
  }
  return positions;
}

function roundFrequency(value) {
  return Math.round(value * 10000) / 10000;
}

function sideElo(headers, side) {
  const value = Number(headers[side === 'w' ? 'WhiteElo' : 'BlackElo']);
  return Number.isFinite(value) ? value : null;
}

function binsForElo(elo) {
  if (!Number.isFinite(elo)) return [];
  return ELO_BINS.filter((bin) => elo >= bin.min && elo <= bin.max);
}

function isFastOrOnlineEvent(headers) {
  return FAST_EVENT_PATTERN.test([
    headers.Event || '',
    headers.Site || ''
  ].join(' '));
}

export async function main() {
  const args = parseArgs(process.argv);
  const result = buildOpeningPriors(args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    positions: Object.keys(result.positions).length,
    source: result.source,
    settings: result.settings
  }, null, 2));
  console.log(`Wrote ${args.output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
