import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as server from '../server.mjs';
import {
  buildEngineCommand,
  checkRateLimit,
  engineKindForProfile,
  pickOpeningPriorMove,
  pickMaiaProfileMove,
  pickQualityFilteredMove,
  formatEngineLaunchError,
  findMaiaExecutable,
  formatStockfishLaunchError,
  findStockfishExecutable,
  resolveListenOptions,
  types
} from '../server.mjs';
import { engineFen } from '../tools/engine-calibration/compare-profiles-to-real-games.mjs';
import { engineFen as calibrationEngineFen } from '../tools/engine-calibration/calibrate-human-profiles.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const maiaCacheDir = join(root, 'engines', 'maia3', 'hf-cache');
const defaultMaiaArgs = [
  '--model',
  'maia3-23m',
  '--cache-dir',
  maiaCacheDir,
  '--local-files-only',
  '--device',
  'cpu',
  '--no-use-amp'
];

test('server serves SVG files with image/svg+xml content type', () => {
  assert.equal(types['.svg'], 'image/svg+xml; charset=utf-8');
});

test('static assets are served without browser caching stale app code', () => {
  const source = readFileSync(join(root, 'server.mjs'), 'utf8');
  assert.match(source, /async function serveStatic/);
  assert.match(source, /'Cache-Control': 'no-store'/);
});

test('resolveListenOptions defaults to localhost and honors explicit HOST', () => {
  assert.deepEqual(resolveListenOptions({}), { port: 8788, host: '127.0.0.1', publicUrl: 'http://localhost:8788' });
  assert.deepEqual(resolveListenOptions({ PORT: '9000', HOST: '0.0.0.0' }), { port: 9000, host: '0.0.0.0', publicUrl: 'http://localhost:9000' });
});

test('checkRateLimit blocks bursts per client key', () => {
  const bucket = new Map();
  const now = 1000;
  assert.equal(checkRateLimit(bucket, 'client-a', { now, limit: 2, windowMs: 1000 }), true);
  assert.equal(checkRateLimit(bucket, 'client-a', { now: now + 100, limit: 2, windowMs: 1000 }), true);
  assert.equal(checkRateLimit(bucket, 'client-a', { now: now + 200, limit: 2, windowMs: 1000 }), false);
  assert.equal(checkRateLimit(bucket, 'client-a', { now: now + 1201, limit: 2, windowMs: 1000 }), true);
});

test('engine endpoint applies per-client rate limiting', () => {
  const source = readFileSync(join(root, 'server.mjs'), 'utf8');
  assert.match(source, /const engineRateLimitBucket = new Map\(\)/);
  assert.match(source, /checkRateLimit\(engineRateLimitBucket,\s*clientKey/);
  assert.match(source, /429/);
});

test('prep report endpoint accepts uploaded opponent PGN and builds reports', () => {
  const source = readFileSync(join(root, 'server.mjs'), 'utf8');
  assert.match(source, /\/prep-database-status/);
  assert.match(source, /\/prep-database-build/);
  assert.match(source, /\/prep-report/);
  assert.doesNotMatch(source, /\/offline-pgn-import/);
  assert.match(source, /getOfflineDatabaseStatus/);
  assert.match(source, /buildOfflineDatabase/);
  assert.match(source, /buildUploadedOpponentOpeningTreeArtifact/);
  assert.match(source, /buildPrepReport/);
  assert.match(source, /opponentTree:\s*openingTree\.artifact/);
  assert.match(source, /opponentPgn/);
  assert.match(source, /openingTree:\s*\{/);
});

test('engine endpoint allows longer sparring search windows', () => {
  const source = readFileSync(join(root, 'server.mjs'), 'utf8');
  assert.match(source, /const engineTimeoutMs = 30000/);
  assert.match(source, /searchMoveTimeMs: clampNumber\(payload\?\.searchMoveTimeMs,\s*120,\s*10000,\s*2200\)/);
});

test('findStockfishExecutable prefers explicit STOCKFISH_PATH', () => {
  const env = { STOCKFISH_PATH: 'C:\\Engines\\stockfish.exe' };
  assert.equal(findStockfishExecutable(env, () => false), 'C:\\Engines\\stockfish.exe');
});

test('findStockfishExecutable scans local engine folders before PATH names', () => {
  const found = findStockfishExecutable({}, (candidate) => candidate.endsWith('stockfish.exe'), 'win32');
  assert.match(found, /engines[\\/]stockfish\.exe$/);
});

test('findStockfishExecutable skips Windows binaries on macOS and Linux', () => {
  const stockfish = findStockfishExecutable(
    {},
    (candidate) => candidate.endsWith(join('engines', 'stockfish.exe')) || candidate.endsWith(join('engines', 'stockfish')),
    'darwin'
  );
  assert.match(stockfish, /engines[\\/]stockfish$/);
  assert.doesNotMatch(stockfish, /\.exe$/);

  assert.equal(
    findStockfishExecutable({}, (candidate) => candidate.endsWith(join('engines', 'stockfish.exe')), 'darwin'),
    'stockfish'
  );
});

test('engine discovery supports macOS executable names', () => {
  const stockfish = findStockfishExecutable({}, (candidate) => candidate.endsWith(join('engines', 'stockfish')));
  assert.match(stockfish, /engines[\\/]stockfish$/);

  const maia = findMaiaExecutable({}, (candidate) => candidate.endsWith(join('engines', 'maia3', '.venv', 'bin', 'maia3-uci')));
  assert.match(maia.command, /engines[\\/]maia3[\\/]\.venv[\\/]bin[\\/]maia3-uci$/);
  assert.deepEqual(maia.args.slice(0, 4), ['--model', 'maia3-23m', '--cache-dir', join(root, 'engines', 'maia3', 'hf-cache')]);
  assert.ok(maia.args.includes('--local-files-only'));
});

test('formatStockfishLaunchError gives a friendly message for launch failures', () => {
  assert.match(formatStockfishLaunchError(new Error('spawn EPERM')), /无法启动 Stockfish/);
  assert.match(formatStockfishLaunchError(new Error('spawn ENOENT')), /找不到 Stockfish/);
  assert.match(formatStockfishLaunchError(new Error('spawn ENOENT'), 'darwin'), /brew install stockfish/);
  assert.doesNotMatch(formatStockfishLaunchError(new Error('spawn EPERM'), 'darwin'), /stockfish\.exe|Windows/);
});

test('engineKindForProfile routes Maia profiles and keeps 2700 on Stockfish', () => {
  assert.equal(engineKindForProfile('stockfish-strong'), 'stockfish');
  assert.equal(engineKindForProfile('human-2200'), 'maia3');
  assert.equal(engineKindForProfile('human-2400'), 'maia3');
  assert.equal(engineKindForProfile('human-2600'), 'maia3');
  assert.equal(engineKindForProfile('human-2700'), 'stockfish');
});

test('resolveMaiaModel defaults to 23M and normalizes supported aliases', () => {
  assert.equal(typeof server.resolveMaiaModel, 'function');
  assert.equal(server.resolveMaiaModel({}), 'maia3-23m');
  assert.equal(server.resolveMaiaModel({ MAIA3_MODEL: '23m' }), 'maia3-23m');
  assert.equal(server.resolveMaiaModel({ MAIA3_MODEL: ' maia3-79m ' }), 'maia3-79m');
  assert.equal(server.resolveMaiaModel({ MAIA3_MODEL: '79m' }), 'maia3-79m');
  assert.equal(server.resolveMaiaModel({}, 'maia3-79m'), 'maia3-79m');
});

test('resolveMaiaModel rejects unsupported model names', () => {
  assert.equal(typeof server.resolveMaiaModel, 'function');
  assert.throws(
    () => server.resolveMaiaModel({ MAIA3_MODEL: '69m' }),
    /MAIA3_MODEL.*23m.*maia3-23m.*79m.*maia3-79m/
  );
});

test('findMaiaExecutable validates the model before selecting a project wrapper', () => {
  assert.throws(
    () => findMaiaExecutable(
      { MAIA3_MODEL: '69m' },
      (candidate) => candidate.endsWith('engines\\maia3\\maia3-uci.cmd')
    ),
    /Invalid MAIA3_MODEL/
  );
});

test('findMaiaExecutable adds model args for explicit MAIA3_PATH and local wrappers', () => {
  assert.deepEqual(findMaiaExecutable({ MAIA3_PATH: '/opt/maia3/bin/maia3-uci' }, () => false), {
    command: '/opt/maia3/bin/maia3-uci',
    args: defaultMaiaArgs
  });

  const conda = findMaiaExecutable({}, (candidate) => candidate.endsWith(`${join('engines', 'maia3', '.conda', 'Scripts', 'maia3-uci.exe')}`));
  assert.match(conda.command, /engines[\\/]maia3[\\/]\.conda[\\/]Scripts[\\/]maia3-uci\.exe$/);
  assert.deepEqual(conda.args, defaultMaiaArgs);

  const venv = findMaiaExecutable({}, (candidate) => candidate.endsWith(`${join('engines', 'maia3', '.venv', 'Scripts', 'maia3-uci.exe')}`));
  assert.match(venv.command, /engines[\\/]maia3[\\/]\.venv[\\/]Scripts[\\/]maia3-uci\.exe$/);
  assert.deepEqual(venv.args, defaultMaiaArgs);

  const found = findMaiaExecutable({}, (candidate) => candidate.endsWith(`${join('engines', 'maia3', 'maia3-uci.cmd')}`));
  assert.match(found.command, /engines[\\/]maia3[\\/]maia3-uci\.cmd$/);
  assert.deepEqual(found.args, []);
});

test('findMaiaExecutable forwards the selected 79M model to Maia launchers', () => {
  const explicit = findMaiaExecutable({
    MAIA3_PATH: '/opt/maia3/bin/maia3-uci',
    MAIA3_MODEL: '79m'
  }, () => false);
  assert.deepEqual(explicit.args.slice(0, 2), ['--model', 'maia3-79m']);

  const bundled = findMaiaExecutable(
    { MAIA3_MODEL: 'maia3-79m' },
    (candidate) => candidate.endsWith(`${join('engines', 'maia3', '.conda', 'python.exe')}`)
  );
  assert.deepEqual(bundled.args.slice(0, 4), ['-m', 'maia3.uci', '--model', 'maia3-79m']);

  const pipLauncher = findMaiaExecutable(
    { MAIA3_MODEL: '79m' },
    (candidate) => candidate.endsWith(`${join('engines', 'maia3', '.conda', 'Scripts', 'maia3-uci.exe')}`)
  );
  assert.deepEqual(pipLauncher.args.slice(0, 2), ['--model', 'maia3-79m']);

  const pathFallback = findMaiaExecutable({ MAIA3_MODEL: '79m' }, () => false);
  assert.equal(pathFallback.command, 'maia3-uci');
  assert.deepEqual(pathFallback.args.slice(0, 2), ['--model', 'maia3-79m']);
});

test('findMaiaExecutable prefers bundled Python module execution over pip script launchers', () => {
  const found = findMaiaExecutable({}, (candidate) => (
    candidate.endsWith(`${join('engines', 'maia3', '.conda', 'python.exe')}`)
      || candidate.endsWith(`${join('engines', 'maia3', 'maia3-uci.cmd')}`)
      || candidate.endsWith(`${join('engines', 'maia3', '.conda', 'Scripts', 'maia3-uci.exe')}`)
  ));

  assert.match(found.command, /engines[\\/]maia3[\\/]\.conda[\\/]python\.exe$/);
  assert.deepEqual(found.args.slice(0, 3), ['-m', 'maia3.uci', '--model']);
  assert.ok(found.args.includes('--local-files-only'));
});

test('prepareEngineSpawn launches Windows cmd wrappers through ComSpec', () => {
  assert.equal(typeof server.prepareEngineSpawn, 'function');
  const spawnConfig = server.prepareEngineSpawn(
    { command: 'C:\\ChessPrep Lab\\engines\\maia3\\maia3-uci.cmd', args: [] },
    { platform: 'win32', env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' } }
  );

  assert.equal(spawnConfig.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(spawnConfig.args, ['/d', '/s', '/c', 'C:\\ChessPrep Lab\\engines\\maia3\\maia3-uci.cmd']);
  assert.deepEqual(spawnConfig.options, { windowsHide: true });
});

test('buildEngineCommand includes Maia Elo option metadata', () => {
  const command = buildEngineCommand({
    profileId: 'human-2400',
    exists: (candidate) => candidate.endsWith('maia3-uci.cmd')
  });
  assert.equal(command.kind, 'maia3');
  assert.equal(command.elo, 2600);
  assert.match(command.command, /maia3-uci\.cmd$/);
});

test('buildEngineCommand uses calibrated Elo while preserving public profile labels', () => {
  const command = buildEngineCommand({ profileId: 'human-2600' });
  assert.equal(command.elo, 2800);
});

test('buildEngineCommand disables Stockfish Elo limiting for the top strict profile', () => {
  const command = buildEngineCommand({ profileId: 'human-2700' });
  assert.equal(command.kind, 'stockfish');
  assert.deepEqual(command.stockfish, { limitStrength: false, elo: null });
});

test('buildEngineCommand maps Maia profiles to tuned sampling options', () => {
  assert.deepEqual(buildEngineCommand({ profileId: 'human-2200' }).maia, { temperature: 0.7, topP: 0.65 });
  assert.deepEqual(buildEngineCommand({ profileId: 'human-2400' }).maia, { temperature: 0.22, topP: 0.35 });
  assert.deepEqual(buildEngineCommand({ profileId: 'human-2600' }).maia, { temperature: 0.08, topP: 0.18 });
});

test('buildEngineCommand reads Maia sampling from shared engine profile metadata', () => {
  const command = buildEngineCommand({ profileId: 'human-2600' });
  assert.deepEqual(command.maia, { temperature: 0.08, topP: 0.18 });
  assert.equal(command.elo, 2800);
});

test('buildEngineCommand adds Stockfish quality filters for serious Maia profiles', () => {
  assert.deepEqual(buildEngineCommand({ profileId: 'human-2200' }).qualityFilter, { maxLossCp: 35, fallbackRank: 2 });
  assert.deepEqual(buildEngineCommand({ profileId: 'human-2400' }).qualityFilter, { maxLossCp: 18, fallbackRank: 1 });
  assert.deepEqual(buildEngineCommand({ profileId: 'human-2600' }).qualityFilter, { maxLossCp: 8, fallbackRank: 1 });
});

test('pickMaiaProfileMove samples from Maia multipv using profile temperature and top-p', () => {
  const maiaLines = [
    { move: 'e2e4', scoreCp: 42 },
    { move: 'd2d4', scoreCp: 38 },
    { move: 'g1f3', scoreCp: 18 },
    { move: 'c2c4', scoreCp: -15 },
    { move: 'b2b3', scoreCp: -30 }
  ];
  const loose = buildEngineCommand({ profileId: 'human-2200' });
  const strict = buildEngineCommand({ profileId: 'human-2600' });
  assert.ok(new Set(Array.from({ length: 8 }, (_, index) => pickMaiaProfileMove(maiaLines, loose, `seed-${index}`))).size > 1);
  assert.ok(
    Array.from({ length: 8 }, (_, index) => pickMaiaProfileMove(maiaLines, strict, `seed-${index}`))
      .every((move) => ['e2e4', 'd2d4', 'g1f3', 'c2c4'].includes(move))
  );
});

test('pickQualityFilteredMove rejects Maia moves that lose too much engine value', () => {
  const stockfishLines = [
    { move: 'e2e4', scoreCp: 40 },
    { move: 'd2d4', scoreCp: 28 },
    { move: 'g1f3', scoreCp: 10 },
    { move: 'h2h3', scoreCp: -120 }
  ];
  assert.equal(pickQualityFilteredMove('h2h3', stockfishLines, { maxLossCp: 45, fallbackRank: 2 }), 'd2d4');
  assert.equal(pickQualityFilteredMove('d2d4', stockfishLines, { maxLossCp: 45, fallbackRank: 2 }), 'd2d4');
  assert.equal(pickQualityFilteredMove('g1f3', stockfishLines, { maxLossCp: 20, fallbackRank: 1 }), 'e2e4');
});

test('pickQualityFilteredMove deduplicates repeated engine PV moves before ranking', () => {
  const stockfishLines = [
    { move: 'e2e4', scoreCp: 40 },
    { move: 'e2e4', scoreCp: 39 },
    { move: 'd2d4', scoreCp: 35 },
    { move: 'g1f3', scoreCp: 30 }
  ];

  assert.equal(pickQualityFilteredMove('g1f3', stockfishLines, { maxLossCp: 6, fallbackRank: 2 }), 'd2d4');
});

test('pickOpeningPriorMove prefers common human opening moves only when still engine-safe', () => {
  const priors = {
    positions: {
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': {
        profiles: {
          'human-2400': {
            games: 100,
            moves: [
              { move: 'e2e4', count: 60 },
              { move: 'g2g4', count: 25 },
              { move: 'd2d4', count: 15 }
            ]
          }
        }
      }
    }
  };
  const stockfishLines = [
    { move: 'd2d4', scoreCp: 40 },
    { move: 'e2e4', scoreCp: 35 },
    { move: 'g2g4', scoreCp: -160 }
  ];

  assert.deepEqual(
    pickOpeningPriorMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      profileId: 'human-2400',
      ply: 0,
      stockfishLines,
      priors,
      randomSeed: 'stable'
    }),
    {
      move: 'e2e4',
      source: 'opening-prior',
      games: 100,
      count: 60,
      lossCp: 5
    }
  );
});

test('pickOpeningPriorMove is disabled for the top strict Stockfish profile', () => {
  const priors = {
    positions: {
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': {
        profiles: {
          'human-2700': {
            games: 1000,
            moves: [
              { move: 'e2e4', count: 100, frequency: 0.1 },
              { move: 'd2d4', count: 600, frequency: 0.6 }
            ]
          }
        }
      }
    }
  };
  const stockfishLines = [
    { move: 'e2e4', scoreCp: 40 },
    { move: 'd2d4', scoreCp: 31 }
  ];

  assert.equal(
    pickOpeningPriorMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      profileId: 'human-2700',
      ply: 0,
      stockfishLines,
      priors
    }),
    null
  );
});

test('pickOpeningPriorMove rejects rare opening priors even when shallow search says they are safe', () => {
  const priors = {
    positions: {
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': {
        profiles: {
          'human-2400': {
            games: 12000,
            moves: [
              { move: 'e2e4', count: 5600, frequency: 0.4667 },
              { move: 'd2d3', count: 5, frequency: 0.0004 }
            ]
          }
        }
      }
    }
  };
  const stockfishLines = [
    { move: 'e2e4', scoreCp: 52 },
    { move: 'd2d3', scoreCp: 20 }
  ];

  assert.equal(
    pickOpeningPriorMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
      profileId: 'human-2400',
      ply: 1,
      stockfishLines,
      priors
    }).move,
    'e2e4'
  );

  assert.equal(
    pickOpeningPriorMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
      profileId: 'human-2400',
      ply: 1,
      stockfishLines: [{ move: 'd2d3', scoreCp: 20 }],
      priors
    }),
    null
  );
});

test('real-game calibration sends six-field FEN strings to UCI engines', () => {
  assert.equal(
    engineFen('2r2r1k/4q1p1/4pp1p/1Q1pP3/1p1P4/8/1P3PPP/2RR2K1 w - -'),
    '2r2r1k/4q1p1/4pp1p/1Q1pP3/1p1P4/8/1P3PPP/2RR2K1 w - - 0 1'
  );
  assert.equal(
    calibrationEngineFen('2r2r1k/4q1p1/4pp1p/1Q1pP3/1p1P4/8/1P3PPP/2RR2K1 w - -'),
    '2r2r1k/4q1p1/4pp1p/1Q1pP3/1p1P4/8/1P3PPP/2RR2K1 w - - 0 1'
  );
  assert.equal(
    engineFen('8/8/8/8/8/8/8/8 b - - 12 40'),
    '8/8/8/8/8/8/8/8 b - - 12 40'
  );
});

test('formatEngineLaunchError names the selected engine', () => {
  assert.match(formatEngineLaunchError('maia3', new Error('spawn ENOENT')), /找不到 Maia-3/);
  assert.match(formatEngineLaunchError('stockfish', new Error('spawn EPERM')), /无法启动 Stockfish/);
});

test('formatEngineExitError names the selected engine', () => {
  assert.equal(typeof server.formatEngineExitError, 'function');
  assert.equal(server.formatEngineExitError('maia3', 1), 'Maia-3 已退出，代码 1。');
  assert.equal(server.formatEngineExitError('stockfish', 1), 'Stockfish 已退出，代码 1。');
});

test('runEngineMove keeps Maia move when Stockfish quality filter exits', async () => {
  assert.equal(typeof server.runEngineMove, 'function');
  const calls = [];
  const result = await server.runEngineMove(
    {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      profileId: 'human-2400',
      multipv: 6,
      depth: 12,
      searchMoveTimeMs: 2600,
      ply: 30,
      randomSeed: 'stable-filter-failure'
    },
    async (payload) => {
      calls.push(payload.profileId);
      if (payload.profileId === 'stockfish-strong') {
        throw Object.assign(new Error('Stockfish 已退出，代码 1。'), { statusCode: 500 });
      }
      return {
        bestmove: 'e2e4',
        engine: 'maia3',
        output: 'info depth 1 multipv 1 score cp 30 pv e2e4\nbestmove e2e4',
        lines: ['info depth 1 multipv 1 score cp 30 pv e2e4', 'bestmove e2e4']
      };
    }
  );

  assert.deepEqual(calls, ['human-2400', 'stockfish-strong']);
  assert.equal(result.engine, 'maia3');
  assert.equal(result.bestmove, 'e2e4');
  assert.equal(result.unfilteredBestmove, 'e2e4');
  assert.deepEqual(result.qualityFilter, { maxLossCp: 18, fallbackRank: 1 });
  assert.equal(result.openingPrior, null);
  assert.equal(result.stockfishFilter, null);
  assert.match(result.stockfishFilterError, /Stockfish 已退出，代码 1/);
});
