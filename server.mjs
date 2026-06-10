import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEngineProfile } from './engine-profiles.mjs';
import { loadOfflineStore } from './tools/player-prep/offline-store.mjs';
import { buildOfflineDatabase, getOfflineDatabaseStatus } from './tools/player-prep/database-builder.mjs';
import { loadOrBuildOpponentOpeningTree, resetOpeningTreeCache } from './tools/player-prep/opening-tree.mjs';
import { buildPrepReport } from './tools/player-prep/prep-report.mjs';

const root = process.cwd();
const engineTimeoutMs = 30000;
const stockfishFilterTimeMs = 900;
const openingPriorMaxPly = 24;
const openingPriorMaxLossCp = 35;
const openingPriorMinMoveCount = 20;
const openingPriorMinFrequency = 0.005;
const openingPriorPath = join(root, 'data', 'engine-calibration', 'opening-priors.json');
const engineRateLimitBucket = new Map();
let openingPriorsCache = undefined;

export const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

export function resolveListenOptions(env = process.env) {
  const port = Number(env.PORT || 8788);
  const host = String(env.HOST || '127.0.0.1').trim() || '127.0.0.1';
  const displayHost = host === '127.0.0.1' || host === '0.0.0.0' ? 'localhost' : host;
  return {
    port,
    host,
    publicUrl: `http://${displayHost}:${port}`
  };
}

export function checkRateLimit(bucket, key, { now = Date.now(), limit = 18, windowMs = 60000 } = {}) {
  const clientKey = key || 'unknown';
  const current = bucket.get(clientKey);
  if (!current || now >= current.resetAt) {
    bucket.set(clientKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function createTrainerServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

      if (url.pathname === '/lichess-study') {
        await proxyStudyPgn(url, response);
        return;
      }

      if (url.pathname === '/engine-move') {
        await handleEngineMove(request, response);
        return;
      }

      if (url.pathname === '/prep-database-status') {
        await handlePrepDatabaseStatus(request, response);
        return;
      }

      if (url.pathname === '/prep-database-build') {
        await handlePrepDatabaseBuild(request, response);
        return;
      }

      if (url.pathname === '/prep-report') {
        await handlePrepReport(request, response);
        return;
      }

      await serveStatic(url.pathname, response);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`Server error: ${error.message}`);
    }
  });
}

export function findStockfishExecutable(env = process.env, exists = existsSync, platform = process.platform) {
  if (env.STOCKFISH_PATH) return env.STOCKFISH_PATH;

  const candidates = platform === 'win32'
    ? [
        join(root, 'engines', 'stockfish.exe'),
        join(root, 'engines', 'stockfish-windows-x86-64-avx2.exe'),
        join(root, 'engines', 'stockfish-windows-x86-64.exe'),
        join(root, 'bin', 'stockfish.exe'),
        join(root, 'engines', 'stockfish'),
        join(root, 'bin', 'stockfish')
      ]
    : [
        join(root, 'engines', 'stockfish'),
        join(root, 'bin', 'stockfish')
      ];

  const found = candidates.find((candidate) => exists(candidate));
  return found || 'stockfish';
}

function defaultMaiaArgs() {
  return ['--model', 'maia3-23m', '--cache-dir', join(root, 'engines', 'maia3', 'hf-cache'), '--local-files-only', '--device', 'cpu', '--no-use-amp'];
}

function maiaPythonModuleArgs() {
  return ['-m', 'maia3.uci', ...defaultMaiaArgs()];
}

export function findMaiaExecutable(env = process.env, exists = existsSync) {
  if (env.MAIA3_PATH) return { command: env.MAIA3_PATH, args: defaultMaiaArgs() };

  const pythonRuntimes = [
    join(root, 'engines', 'maia3', '.conda', 'python.exe'),
    join(root, 'engines', 'maia3', '.conda', 'bin', 'python'),
    join(root, 'engines', 'maia3', '.venv', 'Scripts', 'python.exe'),
    join(root, 'engines', 'maia3', '.venv', 'bin', 'python')
  ];
  const python = pythonRuntimes.find((candidate) => exists(candidate));
  if (python) {
    return {
      command: python,
      args: maiaPythonModuleArgs()
    };
  }

  const wrappers = [
    join(root, 'engines', 'maia3', 'maia3-uci.cmd'),
    join(root, 'engines', 'maia3', '.conda', 'Scripts', 'maia3-uci.exe'),
    join(root, 'engines', 'maia3', '.conda', 'bin', 'maia3-uci'),
    join(root, 'engines', 'maia3', '.venv', 'Scripts', 'maia3-uci.exe'),
    join(root, 'engines', 'maia3', '.venv', 'bin', 'maia3-uci'),
    join(root, 'engines', 'maia3', 'Scripts', 'maia3-uci.exe'),
    join(root, 'engines', 'maia3', 'bin', 'maia3-uci')
  ];
  const found = wrappers.find((candidate) => exists(candidate));
  if (found) {
    const needsModelArgs = found.includes(`${join('engines', 'maia3', '.venv')}`) || found.includes(`${join('engines', 'maia3', '.conda')}`);
    return {
      command: found,
      args: needsModelArgs ? defaultMaiaArgs() : []
    };
  }
  return { command: 'maia3-uci', args: defaultMaiaArgs() };
}

export function engineKindForProfile(profileId) {
  const profile = getEngineProfile(profileId);
  return profile?.mode === 'maia3' ? 'maia3' : 'stockfish';
}

export function buildEngineCommand({ profileId, env = process.env, exists = existsSync } = {}) {
  const selectedProfile = getEngineProfile(profileId) || getEngineProfile('human-2400');
  const kind = engineKindForProfile(profileId);
  if (kind === 'maia3') {
    return {
      kind,
      elo: selectedProfile.calibratedElo || selectedProfile.estimatedElo,
      maia: {
        temperature: selectedProfile.maiaTemperature,
        topP: selectedProfile.maiaTopP
      },
      qualityFilter: selectedProfile.qualityFilter || null,
      ...findMaiaExecutable(env, exists)
    };
  }

  return {
    kind,
    elo: null,
    maia: null,
    qualityFilter: null,
    stockfish: selectedProfile.mode === 'humanized-stockfish'
      ? {
          limitStrength: selectedProfile.stockfishLimitStrength !== false,
          elo: selectedProfile.stockfishLimitStrength === false
            ? null
            : selectedProfile.calibratedElo || selectedProfile.estimatedElo
        }
      : null,
    command: findStockfishExecutable(env, exists),
    args: []
  };
}

export function pickQualityFilteredMove(maiaMove, stockfishLines, filter) {
  const lines = dedupeEngineLines(stockfishLines);
  if (!lines.length || !filter) return maiaMove || null;

  const bestScore = lines[0].scoreCp;
  const maiaLine = lines.find((line) => line.move === maiaMove);
  if (maiaLine && bestScore - maiaLine.scoreCp <= filter.maxLossCp) return maiaMove;

  const allowed = lines.filter((line) => bestScore - line.scoreCp <= filter.maxLossCp);
  const fallbackIndex = Math.max(0, Math.min((filter.fallbackRank || 1) - 1, allowed.length - 1));
  return (allowed[fallbackIndex] || lines[0]).move;
}

export function normalizeEngineFen(fen) {
  const parts = String(fen || '').trim().split(/\s+/);
  if (parts.length < 4) return String(fen || '').trim();
  return `${parts[0]} ${parts[1]} ${parts[2] || '-'} ${parts[3] || '-'}`;
}

export function pickOpeningPriorMove({ fen, profileId, ply, stockfishLines, priors, randomSeed = '' } = {}) {
  if (!profileId || Number(ply) > openingPriorMaxPly) return null;
  const profile = getEngineProfile(profileId);
  if (profile?.disableOpeningPrior) return null;
  const maxLossCp = Number.isFinite(Number(profile?.openingPriorMaxLossCp))
    ? Number(profile.openingPriorMaxLossCp)
    : openingPriorMaxLossCp;
  const normalizedFen = normalizeEngineFen(fen);
  const profilePrior = priors?.positions?.[normalizedFen]?.profiles?.[profileId];
  const priorMoves = Array.isArray(profilePrior?.moves)
    ? profilePrior.moves.filter((move) => isCommonOpeningPrior(move, profilePrior.games))
    : [];
  const lines = dedupeEngineLines(stockfishLines);
  if (!priorMoves.length || !lines.length) return null;

  const scoreByMove = new Map(lines.map((line) => [line.move, line.scoreCp]));
  const bestScore = lines[0].scoreCp;
  const safePriors = priorMoves
    .map((prior) => ({
      ...prior,
      lineScoreCp: scoreByMove.get(prior.move)
    }))
    .filter((prior) => Number.isFinite(prior.lineScoreCp))
    .map((prior) => ({
      ...prior,
      lossCp: Math.max(0, bestScore - prior.lineScoreCp)
    }))
    .filter((prior) => prior.lossCp <= maxLossCp)
    .sort((a, b) => {
      if (profile?.openingPriorSort === 'engine-first') {
        return a.lossCp - b.lossCp || b.count - a.count || a.move.localeCompare(b.move);
      }
      return b.count - a.count || a.lossCp - b.lossCp || a.move.localeCompare(b.move);
    });
  if (!safePriors.length) return null;

  const fallback = safePriors[0];
  return {
    move: fallback.move,
    source: 'opening-prior',
    games: profilePrior.games,
    count: fallback.count,
    lossCp: fallback.lossCp
  };
}

function dedupeEngineLines(stockfishLines) {
  const byMove = new Map();
  for (const line of Array.isArray(stockfishLines) ? stockfishLines : []) {
    if (!line?.move || !Number.isFinite(line.scoreCp)) continue;
    const current = byMove.get(line.move);
    if (!current || line.scoreCp > current.scoreCp) byMove.set(line.move, line);
  }
  return [...byMove.values()].sort((a, b) => b.scoreCp - a.scoreCp);
}

function isCommonOpeningPrior(move, games) {
  const count = Number(move?.count) || 0;
  const frequency = Number.isFinite(Number(move?.frequency))
    ? Number(move.frequency)
    : Number(games) > 0
      ? count / Number(games)
      : 0;
  return count >= openingPriorMinMoveCount && frequency >= openingPriorMinFrequency;
}

export function formatStockfishLaunchError(error, platform = process.platform) {
  const message = String(error?.message || error || '');
  if (/ENOENT/i.test(message)) {
    return platform === 'win32'
      ? '找不到 Stockfish。请把 stockfish.exe 放到项目 engines 文件夹，或设置 STOCKFISH_PATH。'
      : '找不到 Stockfish。请先运行 brew install stockfish，或把 macOS/Linux 版 stockfish 放到项目 engines 文件夹，或设置 STOCKFISH_PATH。';
  }
  return platform === 'win32'
    ? '无法启动 Stockfish。请确认 stockfish.exe 存在、未被系统拦截，并且可以在 Windows 上运行。'
    : '无法启动 Stockfish。请确认安装的是 macOS/Linux 版 Stockfish，并且文件有可执行权限。';
}

export function formatEngineLaunchError(kind, error) {
  if (kind === 'maia3') {
    const message = String(error?.message || error || '');
    if (/ENOENT/i.test(message)) {
      return '找不到 Maia-3。请先完成 engines\\maia3 本地环境安装，或设置 MAIA3_PATH。';
    }
    return '无法启动 Maia-3。请确认 Python 环境、模型缓存和 maia3-uci 命令可用。';
  }
  return formatStockfishLaunchError(error);
}

export function formatEngineExitError(kind, code) {
  const engineName = kind === 'maia3' ? 'Maia-3' : 'Stockfish';
  return `${engineName} 已退出，代码 ${code}。`;
}

export function prepareEngineSpawn(engineCommand, { platform = process.platform, env = process.env } = {}) {
  const command = String(engineCommand?.command || '');
  const args = Array.isArray(engineCommand?.args) ? engineCommand.args : [];
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
    return {
      command: env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', command, ...args],
      options: { windowsHide: true }
    };
  }
  return {
    command,
    args,
    options: { windowsHide: true }
  };
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const listenOptions = resolveListenOptions(process.env);
  createTrainerServer().listen(listenOptions.port, listenOptions.host, () => {
    console.log(`ChessPrep Lab running at ${listenOptions.publicUrl}`);
  });
}

async function proxyStudyPgn(url, response) {
  const study = url.searchParams.get('study');
  const chapter = url.searchParams.get('chapter');

  if (!/^[A-Za-z0-9_-]+$/.test(study || '') || (chapter && !/^[A-Za-z0-9_-]+$/.test(chapter))) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Invalid study or chapter id');
    return;
  }

  const path = chapter ? `${study}/${chapter}` : study;
  const lichessUrl = `https://lichess.org/api/study/${path}.pgn`;
  const upstream = await fetch(lichessUrl, {
    headers: {
      Accept: 'application/x-chess-pgn,text/plain,*/*',
      'User-Agent': 'local-lichess-study-trainer'
    }
  });

  const body = await upstream.text();
  response.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/x-chess-pgn; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

async function handleEngineMove(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const clientKey = getClientKey(request);
  if (!checkRateLimit(engineRateLimitBucket, clientKey)) {
    response.writeHead(429, {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': '60'
    });
    response.end(JSON.stringify({ error: 'Engine request rate limit exceeded. Please wait and try again.' }));
    return;
  }

  try {
    const payload = JSON.parse(await readRequestBody(request));
    const result = await runEngineMove(payload);
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
}

async function handlePrepDatabaseStatus(request, response) {
  if (request.method !== 'GET') {
    response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const status = getOfflineDatabaseStatus();
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(status));
  } catch (error) {
    response.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
}

async function handlePrepDatabaseBuild(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    resetOpeningTreeCache();
    const summary = buildOfflineDatabase();
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(summary));
  } catch (error) {
    response.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
}

async function handlePrepReport(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const payload = JSON.parse(await readRequestBody(request));
    const opponent = String(payload?.opponent || '');
    const ourSide = payload?.ourSide === 'b' ? 'b' : 'w';
    const maxPly = clampNumber(payload?.maxPly, 2, 60, 40);
    const opponentSide = ourSide === 'w' ? 'b' : 'w';
    let store = null;
    let openingTree = null;

    try {
      openingTree = loadOrBuildOpponentOpeningTree({ opponent, opponentSide, maxPly });
    } catch (error) {
      if (!/cache not found/i.test(error.message || '')) throw error;
      store = loadOfflineStore();
      openingTree = loadOrBuildOpponentOpeningTree({ store, opponent, opponentSide, maxPly });
    }

    const report = buildPrepReport({
      store,
      opponent,
      opponentTree: openingTree.artifact,
      ourSide,
      prepPgn: String(payload?.prepPgn || ''),
      focusFen: String(payload?.focusFen || ''),
      focusPly: clampNumber(payload?.focusPly, 0, 60, 0),
      focusLine: String(payload?.focusLine || ''),
      maxPly
    });
    const responsePayload = {
      ...report,
      openingTree: {
        fromCache: openingTree.fromCache,
        path: openingTree.path,
        nodes: openingTree.artifact.nodes.length,
        sampleGames: openingTree.artifact.sampleGames
      }
    };
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(responsePayload));
  } catch (error) {
    response.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
}

function getClientKey(request) {
  const cfIp = request.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return request.socket?.remoteAddress || 'unknown';
}

function readRequestBody(request, { maxBytes = 20000 } = {}) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        rejectBody(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => resolveBody(body || '{}'));
    request.on('error', rejectBody);
  });
}

export async function runEngineMove(payload, engineRunner = runUciEngine) {
  const primary = await engineRunner(payload);

  const engineCommand = buildEngineCommand({ profileId: payload?.profileId });
  const needsStockfishFilter = primary.engine === 'maia3' && engineCommand.qualityFilter;
  const needsOpeningPrior = isOpeningPriorEligible(payload);
  if (primary.engine !== 'maia3' && !needsOpeningPrior) return primary;

  if (!needsStockfishFilter && needsOpeningPrior) {
    const primaryLines = parseEngineInfoLines(primary.lines);
    const openingPrior = pickOpeningPriorMove({
      fen: payload?.fen,
      profileId: payload?.profileId,
      ply: payload?.ply,
      stockfishLines: primaryLines,
      priors: loadOpeningPriors(),
      randomSeed: payload?.randomSeed
    });
    if (!openingPrior) return primary;
    return {
      ...primary,
      bestmove: openingPrior.move,
      openingPrior
    };
  }

  const primaryLines = parseEngineInfoLines(primary.lines);
  const sampledMove = pickMaiaProfileMove(primaryLines, engineCommand, payload?.randomSeed) || primary.bestmove;
  primary.bestmove = sampledMove;
  if (!primary.bestmove && !needsOpeningPrior) return primary;

  const filterPayload = {
    ...payload,
    profileId: 'stockfish-strong',
    multipv: Math.max(4, Number(payload?.multipv) || 1),
    depth: Math.max(12, Number(payload?.depth) || 1),
    searchMoveTimeMs: Math.max(stockfishFilterTimeMs, Number(payload?.searchMoveTimeMs) || 0)
  };
  let stockfish = null;
  try {
    stockfish = await engineRunner(filterPayload);
  } catch (error) {
    return {
      ...primary,
      bestmove: primary.bestmove,
      unfilteredBestmove: primary.bestmove,
      qualityFilter: engineCommand.qualityFilter,
      openingPrior: null,
      stockfishFilter: null,
      stockfishFilterError: error.message || String(error)
    };
  }
  const stockfishLines = parseEngineInfoLines(stockfish.lines);
  const filteredMove = pickQualityFilteredMove(primary.bestmove, stockfishLines, engineCommand.qualityFilter);
  const openingPrior = pickOpeningPriorMove({
    fen: payload?.fen,
    profileId: payload?.profileId,
    ply: payload?.ply,
    stockfishLines,
    priors: loadOpeningPriors(),
    randomSeed: payload?.randomSeed
  });
  return {
    ...primary,
    bestmove: openingPrior?.move || filteredMove || primary.bestmove,
    unfilteredBestmove: primary.bestmove,
    qualityFilter: engineCommand.qualityFilter,
    openingPrior: openingPrior || null,
    stockfishFilter: {
      bestmove: stockfish.bestmove,
      lines: stockfish.lines
    }
  };
}

function isOpeningPriorEligible(payload) {
  const profileId = String(payload?.profileId || '');
  if (!/^human-/.test(profileId)) return false;
  return Number(payload?.ply ?? openingPriorMaxPly + 1) <= openingPriorMaxPly;
}

function loadOpeningPriors() {
  if (openingPriorsCache !== undefined) return openingPriorsCache;
  try {
    openingPriorsCache = JSON.parse(readFileSyncCompat(openingPriorPath));
  } catch {
    openingPriorsCache = null;
  }
  return openingPriorsCache;
}

function readFileSyncCompat(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

export function pickMaiaProfileMove(maiaLines, engineCommand, randomSeed = '') {
  const lines = (Array.isArray(maiaLines) ? maiaLines : [])
    .filter((line) => line?.move && Number.isFinite(line.scoreCp))
    .sort((a, b) => b.scoreCp - a.scoreCp);
  if (!lines.length) return null;

  const topP = Number(engineCommand?.maia?.topP) || 1;
  const temperature = Math.max(0.05, Number(engineCommand?.maia?.temperature) || 1);
  const maxPool = Math.max(1, Math.min(lines.length, Math.ceil(lines.length * Math.max(0.2, Math.min(1, topP)))));
  const pool = lines.slice(0, maxPool);
  const bestScore = pool[0].scoreCp;
  const weights = pool.map((line) => Math.exp(-Math.max(0, bestScore - line.scoreCp) / (80 * temperature)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let roll = seededRandom(`maia:${engineCommand?.elo || ''}:${randomSeed}`) * totalWeight;
  for (let index = 0; index < pool.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return pool[index].move;
  }
  return pool.at(-1).move;
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (const char of String(seedText || '')) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  seed += 0x6D2B79F5;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function runUciEngine(payload) {
  const fen = String(payload?.fen || '').trim();
  if (!fen) {
    throw Object.assign(new Error('Missing FEN'), { statusCode: 400 });
  }

  const profile = {
    multipv: clampNumber(payload?.multipv, 1, 8, 1),
    skillLevel: clampNumber(payload?.skillLevel, 0, 20, 20),
    depth: clampNumber(payload?.depth, 1, 26, 14),
    searchMoveTimeMs: clampNumber(payload?.searchMoveTimeMs, 120, 10000, 2200)
  };
  const engineCommand = buildEngineCommand({ profileId: payload?.profileId });

  return new Promise((resolveEngine, rejectEngine) => {
    let settled = false;
    let output = '';
    let bestmove = null;
    let readySeen = false;
    let searchStarted = false;
    let engine = null;
    try {
      const spawnConfig = prepareEngineSpawn(engineCommand);
      engine = spawn(spawnConfig.command, spawnConfig.args, spawnConfig.options);
    } catch (error) {
      rejectEngine(Object.assign(new Error(formatEngineLaunchError(engineCommand.kind, error)), { statusCode: 503 }));
      return;
    }

    const timer = setTimeout(() => {
      finish(new Error('Stockfish 响应超时，请检查引擎文件是否可用。'));
    }, engineTimeoutMs);

    function finish(error, result = null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!engine.killed) engine.kill();
      if (error) {
        rejectEngine(Object.assign(error, { statusCode: error.statusCode || 500 }));
      } else {
        resolveEngine(result);
      }
    }

    engine.on('error', (error) => {
      finish(Object.assign(new Error(formatEngineLaunchError(engineCommand.kind, error)), { statusCode: 503 }));
    });

    engine.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;

      if (!readySeen && output.includes('uciok')) {
        readySeen = true;
        engine.stdin.write(`setoption name MultiPV value ${profile.multipv}\n`);
        if (engineCommand.kind === 'maia3') {
          engine.stdin.write(`setoption name Elo value ${engineCommand.elo}\n`);
          engine.stdin.write(`setoption name Temperature value ${engineCommand.maia.temperature}\n`);
          engine.stdin.write(`setoption name TopP value ${engineCommand.maia.topP}\n`);
        } else {
          if (engineCommand.stockfish?.limitStrength) {
            engine.stdin.write('setoption name UCI_LimitStrength value true\n');
            engine.stdin.write(`setoption name UCI_Elo value ${engineCommand.stockfish.elo}\n`);
          }
          engine.stdin.write(`setoption name Skill Level value ${profile.skillLevel}\n`);
        }
        engine.stdin.write('isready\n');
      }

      if (output.includes('readyok') && !bestmove && !searchStarted) {
        searchStarted = true;
        engine.stdin.write(`position fen ${fen}\n`);
        engine.stdin.write(`go movetime ${profile.searchMoveTimeMs} depth ${profile.depth}\n`);
      }

      const match = output.match(/(?:^|\n)bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?|0000)\b/);
      if (match) {
        bestmove = match[1] === '0000' ? null : match[1];
        finish(null, {
          bestmove,
          engine: engineCommand.kind,
          output,
          lines: output.split(/\r?\n/).filter(Boolean)
        });
      }
    });

    engine.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    engine.on('exit', (code) => {
      if (!settled && code !== 0) {
        finish(new Error(formatEngineExitError(engineCommand.kind, code)));
      }
    });

    engine.stdin.write('uci\n');
  });
}

function parseEngineInfoLines(lines) {
  return (Array.isArray(lines) ? lines : String(lines || '').split(/\r?\n/))
    .map((line) => {
      const cpMatch = String(line).match(/\bscore\s+cp\s+(-?\d+)/);
      const mateMatch = String(line).match(/\bscore\s+mate\s+(-?\d+)/);
      const pvMove = String(line).match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1];
      if (!pvMove || (!cpMatch && !mateMatch)) return null;
      const mate = mateMatch ? Number(mateMatch[1]) : null;
      return {
        move: pvMove,
        scoreCp: cpMatch ? Number(cpMatch[1]) : mate > 0 ? 200000 : -200000
      };
    })
    .filter(Boolean);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

async function serveStatic(pathname, response) {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(root, cleanPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': types[extname(filePath)] || 'application/octet-stream'
    });
    response.end(content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}
