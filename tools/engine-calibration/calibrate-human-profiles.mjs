import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getEngineProfile, listEngineProfiles } from '../../engine-profiles.mjs';
import { buildEngineCommand, findStockfishExecutable, pickMaiaProfileMove, pickQualityFilteredMove } from '../../server.mjs';
import { parseUciInfoLines } from '../../app.js';

const DEFAULT_OUTPUT = 'data/engine-calibration/latest-human-profile-calibration.json';
const DEFAULT_REPEATS = 2;
const DEFAULT_STOCKFISH_TIME_MS = 220;
const DEFAULT_ENGINE_TIME_MS = 260;

const POSITIONS = [
  {
    id: 'start',
    phase: 'opening',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  },
  {
    id: 'sicilian-rossolimo',
    phase: 'opening',
    fen: 'r1bqkbnr/pp1ppppp/p1n5/1p6/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4'
  },
  {
    id: 'isolated-queen-pawn',
    phase: 'middlegame',
    fen: 'r2q1rk1/pp2bppp/2n1pn2/2bp4/3P4/2NBPN2/PPQ2PPP/R1B2RK1 w - - 0 10'
  },
  {
    id: 'kingside-pressure',
    phase: 'middlegame',
    fen: 'r1bq1rk1/pp3ppp/2n1pn2/2bp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 b - - 0 9'
  },
  {
    id: 'rook-endgame-activity',
    phase: 'endgame',
    fen: '8/5pk1/6pp/8/2R5/6PP/5PK1/r7 w - - 0 40'
  },
  {
    id: 'queen-endgame-checks',
    phase: 'endgame',
    fen: '6k1/5pp1/7p/8/8/6P1/5P1P/4Q1K1 w - - 0 38'
  },
  {
    id: 'minor-piece-fortress',
    phase: 'endgame',
    fen: '8/5k2/3b1pp1/3Pp3/4P3/2B2PPP/5K2/8 w - - 0 44'
  },
  {
    id: 'rook-minor-conversion',
    phase: 'endgame',
    fen: '8/3R1pk1/5bp1/5n2/2N3p1/7P/6K1/8 w - - 0 54'
  },
  {
    id: 'king-safety-punish',
    phase: 'tactical',
    fen: 'r2q1rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQR1K1 w - - 0 9'
  },
  {
    id: 'hanging-piece-tension',
    phase: 'tactical',
    fen: 'r1bq1rk1/pp2bppp/2n2n2/2pp4/3P4/2NBPN2/PPQ1BPPP/R1B2RK1 w - - 0 9'
  },
  {
    id: 'back-rank-rook-choice',
    phase: 'tactical',
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 30'
  },
  {
    id: 'queen-check-precision',
    phase: 'tactical',
    fen: '6k1/5ppp/8/8/8/6P1/5P1P/4Q1K1 b - - 0 38'
  }
];

function parseArgs(argv) {
  const args = {
    output: DEFAULT_OUTPUT,
    repeats: DEFAULT_REPEATS,
    stockfishTimeMs: DEFAULT_STOCKFISH_TIME_MS,
    engineTimeMs: DEFAULT_ENGINE_TIME_MS,
    profiles: ['human-2200', 'human-2400', 'human-2600', 'human-2700']
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') args.output = argv[++index];
    else if (arg === '--repeats') args.repeats = Number(argv[++index]) || args.repeats;
    else if (arg === '--stockfish-time-ms') args.stockfishTimeMs = Number(argv[++index]) || args.stockfishTimeMs;
    else if (arg === '--engine-time-ms') args.engineTimeMs = Number(argv[++index]) || args.engineTimeMs;
    else if (arg === '--profiles') args.profiles = String(argv[++index] || '').split(',').map((item) => item.trim()).filter(Boolean);
  }
  return args;
}

function runUciCommand({ command, args = [], setup = [], fen, movetimeMs, depth = 1, multipv = 1, timeoutMs = 30000 }) {
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
        engine.stdin.write(`go movetime ${movetimeMs} depth ${depth}\n`);
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
  const command = findStockfishExecutable();
  const result = await runUciCommand({
    command,
    fen,
    movetimeMs: options.stockfishTimeMs,
    depth: 9,
    multipv: 8,
    timeoutMs: 20000
  });
  return parseUciInfoLines(result.lines);
}

async function chooseProfileMove(profileId, fen, options) {
  const profile = getEngineProfile(profileId);
  const engineCommand = buildEngineCommand({ profileId });
  if (engineCommand.kind === 'maia3') {
    const result = await runUciCommand({
      command: engineCommand.command,
      args: engineCommand.args,
      fen,
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
    const rawMove = pickMaiaProfileMove(maiaLines, engineCommand, `${fen}:${options.sampleIndex}`) || result.bestmove;
    const stockfishLines = await analyzeWithStockfish(fen, options);
    const filteredMove = pickQualityFilteredMove(rawMove, stockfishLines, engineCommand.qualityFilter);
    return { move: filteredMove || rawMove, engine: 'maia3', rawMove };
  }

  const stockfishLines = await analyzeWithStockfish(fen, options);
  const picked = pickHumanizedStockfishMove(stockfishLines, profile, seededRandom(`${profileId}:${fen}:${options.sampleIndex}`));
  return { move: picked, engine: 'stockfish-humanized', rawMove: picked };
}

function pickHumanizedStockfishMove(stockfishLines, profile, random) {
  const lines = [...stockfishLines].sort((a, b) => b.scoreCp - a.scoreCp);
  if (!lines.length) return null;
  if (profile.mode === 'stockfish') return lines[0].move;
  if (profile.strictEngineMove) return lines[0].move;
  const bestScore = lines[0].scoreCp;
  const tolerance = Number(profile.toleranceCp) || 0;
  const limitedLines = Number.isInteger(profile.stockfishCandidateLimit)
    ? lines.slice(0, profile.stockfishCandidateLimit)
    : lines;
  const pool = limitedLines.filter((line) => bestScore - line.scoreCp <= tolerance);
  const viable = pool.length ? pool : [lines[0]];
  return viable[Math.min(viable.length - 1, Math.floor(random() * viable.length))].move;
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scoreMove(move, stockfishLines) {
  const lines = [...stockfishLines].sort((a, b) => b.scoreCp - a.scoreCp);
  const best = lines[0];
  const selected = lines.find((line) => line.move === move);
  const rank = selected ? lines.findIndex((line) => line.move === move) + 1 : null;
  const lossCp = best && selected ? Math.max(0, best.scoreCp - selected.scoreCp) : null;
  return {
    bestMove: best?.move || null,
    move,
    rank,
    lossCp,
    selectedScoreCp: selected?.scoreCp ?? null,
    bestScoreCp: best?.scoreCp ?? null
  };
}

function summarize(samples) {
  const scored = samples.filter((sample) => Number.isFinite(sample.lossCp));
  const losses = scored.map((sample) => sample.lossCp);
  const averageLossCp = losses.length ? losses.reduce((sum, value) => sum + value, 0) / losses.length : null;
  const sortedLosses = [...losses].sort((a, b) => a - b);
  const percentile = (p) => {
    if (!sortedLosses.length) return null;
    const index = Math.min(sortedLosses.length - 1, Math.floor((sortedLosses.length - 1) * p));
    return sortedLosses[index];
  };
  return {
    samples: samples.length,
    scoredSamples: scored.length,
    averageLossCp,
    medianLossCp: percentile(0.5),
    p80LossCp: percentile(0.8),
    bestMoveRate: rate(scored, (sample) => sample.rank === 1),
    top2Rate: rate(scored, (sample) => sample.rank && sample.rank <= 2),
    acceptableRate: rate(scored, (sample) => sample.lossCp <= 50),
    inaccuracyRate: rate(scored, (sample) => sample.lossCp > 50 && sample.lossCp <= 120),
    blunderRate: rate(scored, (sample) => sample.lossCp > 120)
  };
}

function rate(items, predicate) {
  if (!items.length) return null;
  return items.filter(predicate).length / items.length;
}

export async function calibrateHumanProfiles(options = {}) {
  const merged = {
    repeats: DEFAULT_REPEATS,
    stockfishTimeMs: DEFAULT_STOCKFISH_TIME_MS,
    engineTimeMs: DEFAULT_ENGINE_TIME_MS,
    profiles: ['human-2200', 'human-2400', 'human-2600', 'human-2700'],
    ...options
  };
  const stockfishByFen = new Map();
  const profileSamples = Object.fromEntries(merged.profiles.map((profile) => [profile, []]));
  const allProfiles = Object.fromEntries(listEngineProfiles().map((profile) => [profile.id, profile]));

  for (const position of POSITIONS) {
    const stockfishLines = await analyzeWithStockfish(position.fen, merged);
    stockfishByFen.set(position.fen, stockfishLines);

    for (const profileId of merged.profiles) {
      for (let repeat = 0; repeat < merged.repeats; repeat += 1) {
        const moveResult = await chooseProfileMove(profileId, position.fen, { ...merged, sampleIndex: repeat });
        const scored = scoreMove(moveResult.move, stockfishLines);
        profileSamples[profileId].push({
          positionId: position.id,
          phase: position.phase,
          repeat,
          profileId,
          engine: moveResult.engine,
          rawMove: moveResult.rawMove,
          ...scored
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    settings: {
      repeats: merged.repeats,
      stockfishTimeMs: merged.stockfishTimeMs,
      engineTimeMs: merged.engineTimeMs,
      positions: POSITIONS.map(({ id, phase, fen }) => ({ id, phase, fen }))
    },
    profiles: Object.fromEntries(
      merged.profiles.map((profileId) => [
        profileId,
        {
          profile: allProfiles[profileId],
          summary: summarize(profileSamples[profileId]),
          samples: profileSamples[profileId]
        }
      ])
    )
  };
}

export async function main() {
  const args = parseArgs(process.argv);
  const result = await calibrateHumanProfiles(args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result.profiles).map(([id, data]) => [id, data.summary])), null, 2));
  console.log(`Wrote ${args.output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
