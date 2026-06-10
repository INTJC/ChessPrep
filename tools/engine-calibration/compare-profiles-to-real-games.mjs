import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getEngineProfile } from '../../engine-profiles.mjs';
import { buildEngineCommand, findStockfishExecutable, pickMaiaProfileMove, pickOpeningPriorMove, pickQualityFilteredMove } from '../../server.mjs';
import { parseUciInfoLines, pickHumanizedEngineMove, replayPgnGame, splitPgnGames } from '../../app.js';

const DEFAULT_SOURCE_DIR = 'data/endgame-expansion/sources/raw';
const DEFAULT_OUTPUT = 'data/engine-calibration/real-game-profile-comparison.json';
const DEFAULT_OPENING_PRIORS = 'data/engine-calibration/opening-priors.json';
const DEFAULT_SAMPLES_PER_BIN = 6;
const DEFAULT_MIN_PLY = 18;
const DEFAULT_MAX_PLY = 120;
const DEFAULT_STOCKFISH_TIME_MS = 180;
const DEFAULT_ENGINE_TIME_MS = 240;
const FAST_EVENT_PATTERN = /\b(blitz|rapid|bullet|armageddon|banter|titled|3-0|1-0|hyperbullet|speed|chess\.com|chess24|clutch|pro league|charity cup|cct|online|internet|superrapid)\b/i;

const ELO_BINS = [
  { id: 'real-2200', targetProfile: 'human-2200', min: 2150, max: 2250 },
  { id: 'real-2400', targetProfile: 'human-2400', min: 2350, max: 2450 },
  { id: 'real-2600', targetProfile: 'human-2600', min: 2550, max: 2650 },
  { id: 'real-2700', targetProfile: 'human-2700', min: 2680, max: 2760 }
];

const PROFILE_IDS = ['human-2200', 'human-2400', 'human-2600', 'human-2700'];

export function parseArgs(argv) {
  const args = {
    sourceDir: DEFAULT_SOURCE_DIR,
    output: DEFAULT_OUTPUT,
    samplesPerBin: DEFAULT_SAMPLES_PER_BIN,
    minPly: DEFAULT_MIN_PLY,
    maxPly: DEFAULT_MAX_PLY,
    stockfishTimeMs: DEFAULT_STOCKFISH_TIME_MS,
    engineTimeMs: DEFAULT_ENGINE_TIME_MS,
    bins: ELO_BINS,
    profiles: PROFILE_IDS,
    targetOnly: false,
    excludeFastEvents: false,
    openingPriors: DEFAULT_OPENING_PRIORS
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source-dir') args.sourceDir = argv[++index] || args.sourceDir;
    else if (arg === '--output') args.output = argv[++index] || args.output;
    else if (arg === '--samples-per-bin') args.samplesPerBin = Number(argv[++index]) || args.samplesPerBin;
    else if (arg === '--min-ply') args.minPly = Number(argv[++index]) || args.minPly;
    else if (arg === '--max-ply') args.maxPly = Number(argv[++index]) || args.maxPly;
    else if (arg === '--stockfish-time-ms') args.stockfishTimeMs = Number(argv[++index]) || args.stockfishTimeMs;
    else if (arg === '--engine-time-ms') args.engineTimeMs = Number(argv[++index]) || args.engineTimeMs;
    else if (arg === '--profiles') args.profiles = String(argv[++index] || '').split(',').map((item) => item.trim()).filter(Boolean);
    else if (arg === '--target-only') args.targetOnly = true;
    else if (arg === '--exclude-fast-events') args.excludeFastEvents = true;
    else if (arg === '--opening-priors') args.openingPriors = argv[++index] || args.openingPriors;
    else if (arg === '--no-opening-priors') args.openingPriors = null;
  }

  return args;
}

function listPgnFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listPgnFiles(fullPath);
    return /\.pgn$/i.test(entry.name) ? [fullPath] : [];
  }).sort();
}

function sideElo(headers, side) {
  const value = Number(headers[side === 'w' ? 'WhiteElo' : 'BlackElo']);
  return Number.isFinite(value) ? value : null;
}

function parseHeaders(gameText) {
  const headers = {};
  for (const line of String(gameText || '').split(/\r?\n/)) {
    const match = line.match(/^\[([A-Za-z0-9_]+)\s+"(.*)"\]$/);
    if (match) headers[match[1]] = match[2];
  }
  return headers;
}

function sideName(headers, side) {
  return headers[side === 'w' ? 'White' : 'Black'] || '';
}

function binForElo(elo, bins = ELO_BINS) {
  return bins.find((bin) => elo >= bin.min && elo <= bin.max) || null;
}

function gameIdFromHeaders(headers, sourceFile, gameIndex) {
  return [
    sourceFile.replace(/\\/g, '/').split('/').slice(-2).join('/'),
    gameIndex + 1,
    headers.Event || '',
    headers.Date || '',
    headers.White || '',
    headers.Black || ''
  ].join('|');
}

export function collectRealMoveCandidates({ sourceDir = DEFAULT_SOURCE_DIR, bins = ELO_BINS, minPly = DEFAULT_MIN_PLY, maxPly = DEFAULT_MAX_PLY, excludeFastEvents = false } = {}) {
  const byBin = Object.fromEntries(bins.map((bin) => [bin.id, []]));
  const files = listPgnFiles(sourceDir);
  let gameCount = 0;
  let replayErrorCount = 0;
  let skippedByEloCount = 0;
  let skippedFastEventCount = 0;

  for (const file of files) {
    const games = splitPgnGames(readFileSync(file, 'utf8'));
    for (let gameIndex = 0; gameIndex < games.length; gameIndex += 1) {
      gameCount += 1;
      const headers = parseHeaders(games[gameIndex]);
      if (excludeFastEvents && isFastOrOnlineEvent(headers)) {
        skippedFastEventCount += 1;
        continue;
      }
      const matchingSides = ['w', 'b']
        .map((side) => ({ side, elo: sideElo(headers, side), bin: binForElo(sideElo(headers, side), bins) }))
        .filter((item) => item.elo && item.bin);
      if (!matchingSides.length) {
        skippedByEloCount += 1;
        continue;
      }

      let replay = null;
      try {
        replay = replayPgnGame(games[gameIndex]);
      } catch {
        replayErrorCount += 1;
        continue;
      }

      const gameId = gameIdFromHeaders(replay.headers, file, gameIndex);
      for (const { side, elo, bin } of matchingSides) {
        const sideMoves = replay.moves
          .filter((move) => move.ply >= minPly && move.ply <= maxPly && move.beforeFen.split(/\s+/)[1] === side);
        if (!sideMoves.length) continue;
        const move = sideMoves
          .sort((a, b) => (
            stableHash(`${bin.id}:${gameId}:${side}:${a.ply}:${a.uci}`) -
            stableHash(`${bin.id}:${gameId}:${side}:${b.ply}:${b.uci}`)
          ))[0];
        byBin[bin.id].push({
          binId: bin.id,
          targetProfile: bin.targetProfile,
          sourceFile: file,
          gameId,
          event: replay.headers.Event || '',
          site: replay.headers.Site || '',
          date: replay.headers.Date || '',
          round: replay.headers.Round || '',
          white: replay.headers.White || '',
          black: replay.headers.Black || '',
          result: replay.headers.Result || '',
          player: sideName(replay.headers, side),
          side,
          elo,
          ply: move.ply,
          san: move.san,
          move: move.uci,
          fen: move.beforeFen,
          afterFen: move.afterFen
        });
      }
    }
  }

  return { byBin, files, gameCount, replayErrorCount, skippedByEloCount, skippedFastEventCount };
}

function isFastOrOnlineEvent(headers) {
  return FAST_EVENT_PATTERN.test([
    headers.Event || '',
    headers.Site || ''
  ].join(' '));
}

export function selectBalancedSamples(byBin, samplesPerBin = DEFAULT_SAMPLES_PER_BIN, seedText = 'real-game-profile-calibration') {
  return Object.fromEntries(
    Object.entries(byBin).map(([binId, candidates]) => {
      const perGame = new Map();
      for (const candidate of candidates) {
        const key = candidate.gameId;
        const existing = perGame.get(key);
        if (!existing || stableHash(`${seedText}:${candidate.binId}:${candidate.gameId}:${candidate.ply}`) < stableHash(`${seedText}:${existing.binId}:${existing.gameId}:${existing.ply}`)) {
          perGame.set(key, candidate);
        }
      }

      const selected = [...perGame.values()]
        .sort((a, b) => (
          stableHash(`${seedText}:${binId}:${a.gameId}:${a.ply}:${a.move}`) -
          stableHash(`${seedText}:${binId}:${b.gameId}:${b.ply}:${b.move}`)
        ))
        .slice(0, samplesPerBin);

      return [binId, selected];
    })
  );
}

function runUciCommand({ command, args = [], setup = [], fen, movetimeMs, depth = 1, multipv = 1, searchMoves = [], timeoutMs = 30000 }) {
  return new Promise((resolveRun, rejectRun) => {
    let output = '';
    let stderr = '';
    let readySeen = false;
    let searchStarted = false;
    let settled = false;
    let engine = null;
    const timer = setTimeout(() => finish(new Error(`engine timeout after ${timeoutMs}ms`)), timeoutMs);

    function finish(error, result = null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (engine && !engine.killed) engine.kill();
      } catch {}
      if (error) rejectRun(error);
      else resolveRun(result);
    }

    try {
      engine = spawn(command, args, { windowsHide: true });
    } catch (error) {
      finish(error);
      return;
    }

    engine.on('error', finish);
    engine.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    engine.stdout.on('data', (chunk) => {
      output += chunk.toString();

      if (!readySeen && output.includes('uciok')) {
        readySeen = true;
        engine.stdin.write(`setoption name MultiPV value ${multipv}\n`);
        for (const commandText of setup) engine.stdin.write(`${commandText}\n`);
        engine.stdin.write('isready\n');
      }

      if (output.includes('readyok') && !searchStarted) {
        searchStarted = true;
        engine.stdin.write(`position fen ${engineFen(fen)}\n`);
        const searchMovesText = searchMoves.length ? `searchmoves ${searchMoves.join(' ')} ` : '';
        engine.stdin.write(`go ${searchMovesText}movetime ${movetimeMs} depth ${depth}\n`);
      }

      const match = output.match(/(?:^|\n)bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?|0000)\b/);
      if (match) {
        finish(null, {
          bestmove: match[1] === '0000' ? null : match[1],
          lines: output.split(/\r?\n/).filter(Boolean),
          stderr
        });
      }
    });

    engine.on('exit', (code) => {
      if (!settled && code !== 0) finish(new Error(`engine exited with code ${code}: ${stderr}`));
    });

    engine.stdin.write('uci\n');
  });
}

export function engineFen(fen) {
  const parts = String(fen || '').trim().split(/\s+/);
  if (parts.length >= 6) return parts.slice(0, 6).join(' ');
  if (parts.length >= 4) return `${parts.slice(0, 4).join(' ')} 0 1`;
  return String(fen || '').trim();
}

async function analyzeWithStockfish(fen, options) {
  const result = await runUciCommand({
    command: findStockfishExecutable(),
    fen,
    movetimeMs: options.stockfishTimeMs,
    depth: 9,
    multipv: 8,
    timeoutMs: 20000
  });
  return parseUciInfoLines(result.lines);
}

async function evaluateForcedStockfishMove(fen, move, options) {
  const result = await runUciCommand({
    command: findStockfishExecutable(),
    fen,
    movetimeMs: options.stockfishTimeMs,
    depth: 9,
    multipv: 1,
    searchMoves: [move],
    timeoutMs: 20000
  });
  const lines = parseUciInfoLines(result.lines);
  return lines.find((line) => line.move === move) || lines[0] || null;
}

async function scoreMoveAgainstReference(fen, move, stockfishLines, options) {
  const sorted = [...stockfishLines].sort((a, b) => b.scoreCp - a.scoreCp);
  const best = sorted[0] || null;
  let selected = sorted.find((line) => line.move === move) || null;
  let forced = false;
  if (!selected) {
    try {
      selected = await evaluateForcedStockfishMove(fen, move, options);
      forced = Boolean(selected);
    } catch {
      selected = null;
      forced = false;
    }
  }
  const rank = sorted.findIndex((line) => line.move === move);
  return {
    bestMove: best?.move || null,
    move,
    rank: rank >= 0 ? rank + 1 : null,
    selectedScoreCp: selected?.scoreCp ?? null,
    bestScoreCp: best?.scoreCp ?? null,
    lossCp: best && selected ? Math.max(0, best.scoreCp - selected.scoreCp) : null,
    forcedEvaluation: forced
  };
}

async function chooseProfileMove(profileId, sample, stockfishLines, options) {
  const profile = getEngineProfile(profileId);
  const engineCommand = buildEngineCommand({ profileId });
  if (engineCommand.kind === 'maia3') {
    const result = await runUciCommand({
      command: engineCommand.command,
      args: engineCommand.args,
      fen: sample.fen,
      setup: [
        `setoption name Elo value ${engineCommand.elo}`,
        `setoption name Temperature value ${engineCommand.maia.temperature}`,
        `setoption name TopP value ${engineCommand.maia.topP}`
      ],
      movetimeMs: options.engineTimeMs,
      depth: profile.depth,
      multipv: profile.multipv,
      timeoutMs: 45000
    });
    const maiaLines = parseUciInfoLines(result.lines);
    const rawMove = pickMaiaProfileMove(maiaLines, engineCommand, `${sample.binId}:${sample.gameId}:${sample.ply}`) || result.bestmove;
    const filteredMove = pickQualityFilteredMove(rawMove, stockfishLines, engineCommand.qualityFilter);
    return pickProfileMoveWithOpeningPrior({
      profileId,
      sample,
      stockfishLines,
      priors: options.openingPriorsData,
      picked: {
        engine: 'maia3',
        rawMove,
        move: filteredMove || rawMove,
        filtered: Boolean(filteredMove && filteredMove !== rawMove)
      }
    });
  }

  const move = pickHumanizedEngineMove(stockfishLines, profile, seededRandom(`${profileId}:${sample.gameId}:${sample.ply}`));
  return pickProfileMoveWithOpeningPrior({
    profileId,
    sample,
    stockfishLines,
    priors: options.openingPriorsData,
    picked: { engine: 'stockfish-humanized', rawMove: move, move, filtered: false }
  });
}

export function pickProfileMoveWithOpeningPrior({ profileId, sample, stockfishLines, picked, priors } = {}) {
  const openingPrior = pickOpeningPriorMove({
    fen: sample?.fen,
    profileId,
    ply: sample?.ply,
    stockfishLines,
    priors,
    randomSeed: `${sample?.binId || ''}:${sample?.gameId || ''}:${sample?.ply || ''}`
  });
  if (!openingPrior) return picked;
  return {
    ...picked,
    move: openingPrior.move,
    openingPrior
  };
}

async function analyzeSample(sample, options) {
  let stockfishLines = [];
  try {
    stockfishLines = await analyzeWithStockfish(sample.fen, options);
  } catch (error) {
    return {
      ...sample,
      error: `reference analysis failed: ${error.message}`,
      stockfishTop: [],
      real: {
        move: sample.move,
        bestMove: null,
        rank: null,
        selectedScoreCp: null,
        bestScoreCp: null,
        lossCp: null,
        forcedEvaluation: false
      },
      profiles: {}
    };
  }

  const real = await scoreMoveAgainstReference(sample.fen, sample.move, stockfishLines, options);
  const profiles = {};
  const profileIds = options.targetOnly ? [sample.targetProfile] : options.profiles;

  for (const profileId of profileIds) {
    try {
      const picked = await chooseProfileMove(profileId, sample, stockfishLines, options);
      profiles[profileId] = {
        ...picked,
        ...(await scoreMoveAgainstReference(sample.fen, picked.move, stockfishLines, options))
      };
    } catch (error) {
      profiles[profileId] = {
        engine: null,
        rawMove: null,
        move: null,
        filtered: false,
        error: error.message,
        bestMove: stockfishLines[0]?.move || null,
        rank: null,
        selectedScoreCp: null,
        bestScoreCp: stockfishLines[0]?.scoreCp ?? null,
        lossCp: null,
        forcedEvaluation: false
      };
    }
  }

  return {
    ...sample,
    stockfishTop: stockfishLines.slice(0, 5).map(({ move, scoreCp }) => ({ move, scoreCp })),
    real,
    profiles
  };
}

function summarize(items) {
  const scored = items.filter((item) => Number.isFinite(item.lossCp));
  const losses = scored.map((item) => item.lossCp);
  const sortedLosses = [...losses].sort((a, b) => a - b);
  const percentile = (p) => {
    if (!sortedLosses.length) return null;
    return sortedLosses[Math.min(sortedLosses.length - 1, Math.floor((sortedLosses.length - 1) * p))];
  };
  return {
    samples: items.length,
    scoredSamples: scored.length,
    averageLossCp: losses.length ? losses.reduce((sum, value) => sum + value, 0) / losses.length : null,
    medianLossCp: percentile(0.5),
    p80LossCp: percentile(0.8),
    bestMoveRate: rate(scored, (sample) => sample.rank === 1),
    top2Rate: rate(scored, (sample) => sample.rank && sample.rank <= 2),
    acceptableRate: rate(scored, (sample) => sample.lossCp <= 50),
    inaccuracyRate: rate(scored, (sample) => sample.lossCp > 50 && sample.lossCp <= 120),
    blunderRate: rate(scored, (sample) => sample.lossCp > 120),
    forcedEvaluationRate: rate(scored, (sample) => sample.forcedEvaluation)
  };
}

function rate(items, predicate) {
  if (!items.length) return null;
  return items.filter(predicate).length / items.length;
}

function summarizeByBin(analyses, profiles) {
  const byBin = new Map();
  for (const analysis of analyses) {
    if (!byBin.has(analysis.binId)) byBin.set(analysis.binId, []);
    byBin.get(analysis.binId).push(analysis);
  }

  return Object.fromEntries([...byBin.entries()].map(([binId, samples]) => {
    const realSummary = summarize(samples.map((sample) => sample.real));
    const profileSummaries = Object.fromEntries(profiles.map((profileId) => [
      profileId,
      summarize(samples.map((sample) => sample.profiles[profileId]).filter(Boolean))
    ]));
    const targetProfile = samples[0]?.targetProfile || null;
    const targetSummary = targetProfile ? profileSummaries[targetProfile] : null;
    return [
      binId,
      {
        range: ELO_BINS.find((bin) => bin.id === binId),
        real: realSummary,
        profiles: profileSummaries,
        targetComparison: targetSummary
          ? {
              targetProfile,
              averageLossDeltaCp: Number.isFinite(targetSummary.averageLossCp) && Number.isFinite(realSummary.averageLossCp)
                ? targetSummary.averageLossCp - realSummary.averageLossCp
                : null,
              bestMoveRateDelta: Number.isFinite(targetSummary.bestMoveRate) && Number.isFinite(realSummary.bestMoveRate)
                ? targetSummary.bestMoveRate - realSummary.bestMoveRate
                : null,
              top2RateDelta: Number.isFinite(targetSummary.top2Rate) && Number.isFinite(realSummary.top2Rate)
                ? targetSummary.top2Rate - realSummary.top2Rate
                : null
            }
          : null
      }
    ];
  }));
}

export async function compareProfilesToRealGames(options = {}) {
  const merged = {
    sourceDir: DEFAULT_SOURCE_DIR,
    samplesPerBin: DEFAULT_SAMPLES_PER_BIN,
    minPly: DEFAULT_MIN_PLY,
    maxPly: DEFAULT_MAX_PLY,
    stockfishTimeMs: DEFAULT_STOCKFISH_TIME_MS,
    engineTimeMs: DEFAULT_ENGINE_TIME_MS,
    profiles: PROFILE_IDS,
    bins: ELO_BINS,
    targetOnly: false,
    excludeFastEvents: false,
    openingPriors: DEFAULT_OPENING_PRIORS,
    ...options
  };
  merged.openingPriorsData = options.openingPriorsData || loadOpeningPriorsForComparison(merged.openingPriors);

  const collected = collectRealMoveCandidates(merged);
  const selectedByBin = selectBalancedSamples(collected.byBin, merged.samplesPerBin);
  const selectedSamples = Object.values(selectedByBin).flat();
  const analyses = [];

  for (let index = 0; index < selectedSamples.length; index += 1) {
    const sample = selectedSamples[index];
    console.error(`[${index + 1}/${selectedSamples.length}] ${sample.binId} ${sample.player} ${sample.elo} ply ${sample.ply} ${sample.san}`);
    analyses.push(await analyzeSample(sample, merged));
  }

  return {
    generatedAt: new Date().toISOString(),
    source: {
      dataset: 'PGN Mentor public player PGN files stored under data/endgame-expansion/sources/raw',
      files: collected.files,
      gameCount: collected.gameCount,
      replayErrorCount: collected.replayErrorCount,
      skippedByEloCount: collected.skippedByEloCount,
      skippedFastEventCount: collected.skippedFastEventCount,
      candidateCounts: Object.fromEntries(Object.entries(collected.byBin).map(([binId, candidates]) => [binId, candidates.length]))
    },
    settings: {
      samplesPerBin: merged.samplesPerBin,
      minPly: merged.minPly,
      maxPly: merged.maxPly,
      stockfishTimeMs: merged.stockfishTimeMs,
      engineTimeMs: merged.engineTimeMs,
      profiles: merged.profiles,
      targetOnly: merged.targetOnly,
      excludeFastEvents: merged.excludeFastEvents,
      openingPriors: merged.openingPriors,
      bins: merged.bins
    },
    summary: summarizeByBin(analyses, merged.profiles),
    samples: analyses
  };
}

function loadOpeningPriorsForComparison(filePath) {
  if (!filePath) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function stableHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seedText) {
  let seed = stableHash(seedText);
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function main() {
  const args = parseArgs(process.argv);
  const result = await compareProfilesToRealGames(args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result.summary, null, 2));
  console.log(`Wrote ${args.output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
