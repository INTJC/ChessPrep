import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { spawnSync } from 'node:child_process';

export const DEFAULT_RAW_DIR = join(process.cwd(), 'data', 'endgame-expansion', 'sources', 'raw');
export const LICHESS_BROADCAST_DIR = join(DEFAULT_RAW_DIR, 'lichess-broadcast-db');
export const TWIC_DIR = join(DEFAULT_RAW_DIR, 'twic');
export const PGNMENTOR_DIR = join(DEFAULT_RAW_DIR, 'pgnmentor');
export const DOWNLOAD_LOG = join(DEFAULT_RAW_DIR, 'public-source-downloads.json');

const LICHESS_BASE_URL = 'https://database.lichess.org/broadcast';
const TWIC_BASE_URL = 'https://theweekinchess.com';
const PGNMENTOR_PLAYERS_URL = 'https://www.pgnmentor.com/players/';
const PGNMENTOR_FILES_URL = 'https://www.pgnmentor.com/files.html';

function padMonth(value) {
  return String(value).padStart(2, '0');
}

function parseMonth(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Invalid month ${value}`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

function compareMonthDesc(a, b) {
  if (a.year !== b.year) return b.year - a.year;
  return b.month - a.month;
}

function monthKey({ year, month }) {
  return `${year}-${padMonth(month)}`;
}

function currentMonthKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${padMonth(now.getUTCMonth() + 1)}`;
}

function monthRangeDesc(from, to) {
  const start = parseMonth(from);
  const end = parseMonth(to);
  const months = [];
  for (let year = start.year; year <= end.year; year += 1) {
    const firstMonth = year === start.year ? start.month : 1;
    const lastMonth = year === end.year ? end.month : 12;
    for (let month = firstMonth; month <= lastMonth; month += 1) {
      months.push({ year, month });
    }
  }
  return months.sort(compareMonthDesc);
}

export function buildLichessBroadcastPlan({
  from = '2021-11',
  to = currentMonthKey(),
  baseUrl = LICHESS_BASE_URL,
  targetDir = LICHESS_BROADCAST_DIR
} = {}) {
  return monthRangeDesc(from, to).map((month) => {
    const key = monthKey(month);
    return {
      id: `lichess-broadcast-${key}`,
      source: 'lichess-broadcast',
      dateKey: key,
      url: `${baseUrl.replace(/\/$/, '')}/lichess_db_broadcast_${key}.pgn.zst`,
      targetDir,
      expectedPgnName: `lichess_db_broadcast_${key}.pgn`
    };
  });
}

export function buildTwicPlan({
  firstIssue = 920,
  latestIssue = 9999,
  baseUrl = TWIC_BASE_URL,
  targetDir = TWIC_DIR
} = {}) {
  const items = [];
  for (let issue = Number(latestIssue); issue >= Number(firstIssue); issue -= 1) {
    items.push({
      id: `twic-${issue}`,
      source: 'twic',
      dateKey: String(issue),
      url: `${baseUrl.replace(/\/$/, '')}/zips/twic${issue}g.zip`,
      fallbackPageUrl: `${baseUrl.replace(/\/$/, '')}/html/twic${issue}.html`,
      targetDir,
      expectedPgnName: `twic${issue}.pgn`
    });
  }
  return items;
}

export function parseTwicDownloadLink(html, pageUrl) {
  const links = [...String(html || '').matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => /\.(?:zip|pgn)(?:[?#].*)?$/i.test(href));
  const preferred = links.find((href) => /twic\d+g?\.zip(?:[?#].*)?$/i.test(href))
    || links.find((href) => /twic\d+\.pgn(?:[?#].*)?$/i.test(href))
    || links[0];
  return preferred ? new URL(preferred, pageUrl).href : '';
}

function sanitizeFilename(value) {
  return String(value || '')
    .replace(/^https?:\/\//, '')
    .replace(/[?#].*$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function sourcePathForUrl(item) {
  const name = item.expectedPgnName || basename(new URL(item.url).pathname) || `${item.id}.pgn`;
  const safeName = sanitizeFilename(name);
  return join(item.targetDir, safeName);
}

function downloadPathForUrl(item) {
  const name = basename(new URL(item.url).pathname) || `${item.id}${extname(sourcePathForUrl(item))}`;
  return join(item.targetDir, sanitizeFilename(name));
}

export function filterPendingDownloads(items) {
  return items.filter((item) => !existsSync(sourcePathForUrl(item)));
}

function readLog(logPath = DOWNLOAD_LOG) {
  if (!existsSync(logPath)) return { version: 1, updatedAt: null, entries: [] };
  return JSON.parse(readFileSync(logPath, 'utf8'));
}

function appendLog(entry, logPath = DOWNLOAD_LOG) {
  mkdirSync(join(logPath, '..'), { recursive: true });
  const log = readLog(logPath);
  log.entries.push({ ...entry, at: new Date().toISOString() });
  log.updatedAt = new Date().toISOString();
  writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
}

async function fetchToFile(url, path) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  await pipeline(response.body, createWriteStream(path));
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

async function extractDownloadedFile(item, downloadedPath) {
  const targetPath = sourcePathForUrl(item);
  if (/\.zip$/i.test(downloadedPath)) {
    runCommand('tar', ['-xf', downloadedPath, '-C', item.targetDir]);
    const pgn = readdirSync(item.targetDir)
      .find((name) => name.toLowerCase() === item.expectedPgnName.toLowerCase());
    if (pgn && join(item.targetDir, pgn) !== targetPath) {
      return join(item.targetDir, pgn);
    }
    return targetPath;
  }
  if (/\.gz$/i.test(downloadedPath)) {
    await pipeline(readFileSync(downloadedPath), createGunzip(), createWriteStream(targetPath));
    return targetPath;
  }
  if (/\.zst$/i.test(downloadedPath)) {
    runCommand('zstd', ['-d', '-f', downloadedPath, '-o', targetPath]);
    return targetPath;
  }
  return downloadedPath;
}

export async function downloadSource(item, { keepArchives = false, logPath = DOWNLOAD_LOG } = {}) {
  mkdirSync(item.targetDir, { recursive: true });
  const targetPath = sourcePathForUrl(item);
  if (existsSync(targetPath)) {
    appendLog({ id: item.id, source: item.source, status: 'skipped', targetPath }, logPath);
    return { ...item, status: 'skipped', targetPath };
  }

  const archivePath = downloadPathForUrl(item);
  let downloadedPath = archivePath;
  try {
    await fetchToFile(item.url, archivePath);
  } catch (error) {
    if (!item.fallbackPageUrl || !/HTTP 404/.test(error?.message || '')) throw error;
    const pageHtml = await fetchText(item.fallbackPageUrl);
    const fallbackUrl = parseTwicDownloadLink(pageHtml, item.fallbackPageUrl);
    if (!fallbackUrl) throw error;
    const fallbackItem = { ...item, url: fallbackUrl };
    downloadedPath = downloadPathForUrl(fallbackItem);
    await fetchToFile(fallbackUrl, downloadedPath);
  }
  const extractedPath = await extractDownloadedFile(item, downloadedPath);
  if (!keepArchives && downloadedPath !== extractedPath && existsSync(downloadedPath)) {
    rmSync(downloadedPath, { force: true });
  }
  appendLog({ id: item.id, source: item.source, status: 'downloaded', targetPath: extractedPath }, logPath);
  return { ...item, status: 'downloaded', targetPath: extractedPath };
}

export async function downloadSources(items, {
  limit = Infinity,
  keepArchives = false,
  logPath = DOWNLOAD_LOG
} = {}) {
  const pending = filterPendingDownloads(items).slice(0, limit);
  const results = [];
  for (const item of pending) {
    try {
      results.push(await downloadSource(item, { keepArchives, logPath }));
    } catch (error) {
      appendLog({
        id: item.id,
        source: item.source,
        status: 'failed',
        url: item.url,
        message: error?.message || String(error)
      }, logPath);
      results.push({ ...item, status: 'failed', message: error?.message || String(error) });
    }
  }
  return results;
}

function parseLatestTwicIssue(html) {
  const matches = [...String(html || '').matchAll(/twic(\d+)g\.zip/gi)].map((match) => Number(match[1]));
  return matches.length ? Math.max(...matches) : 0;
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

export async function discoverLatestTwicIssue({ archiveUrl = `${TWIC_BASE_URL}/twic` } = {}) {
  const html = await fetchText(archiveUrl);
  const latest = parseLatestTwicIssue(html);
  if (!latest) throw new Error('Could not discover latest TWIC issue');
  return latest;
}

export function buildPgnMentorPlayerPlan(playerNames, {
  baseUrl = PGNMENTOR_PLAYERS_URL,
  targetDir = PGNMENTOR_DIR
} = {}) {
  return [...new Set(playerNames.map((name) => String(name || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      id: `pgnmentor-player-${name.toLowerCase()}`,
      source: 'pgnmentor-player',
      dateKey: name,
      url: `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(name)}.zip`,
      targetDir: join(targetDir, 'players'),
      expectedPgnName: `${name}.pgn`
    }));
}

export function discoverPgnMentorPlayersFromHtml(html) {
  return [...new Set([...String(html || '').matchAll(/players\/([A-Za-z0-9._-]+)\.(?:zip|pgn)/gi)]
    .map((match) => match[1]))]
    .sort((a, b) => a.localeCompare(b));
}

export async function discoverPgnMentorPlayers({ filesUrl = PGNMENTOR_FILES_URL } = {}) {
  const html = await fetchText(filesUrl);
  return discoverPgnMentorPlayersFromHtml(html);
}

export async function buildPublicSourcePlan({
  lichessTo = currentMonthKey(),
  latestTwicIssue = null,
  includePgnMentor = true
} = {}) {
  const twicIssue = latestTwicIssue || await discoverLatestTwicIssue();
  const plan = [
    ...buildLichessBroadcastPlan({ to: lichessTo }),
    ...buildTwicPlan({ latestIssue: twicIssue })
  ];
  if (includePgnMentor) {
    const players = await discoverPgnMentorPlayers();
    plan.push(...buildPgnMentorPlayerPlan(players));
  }
  return plan;
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 3; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key.slice(2), true);
    } else {
      args.set(key.slice(2), next);
      index += 1;
    }
  }
  return args;
}

async function main(argv) {
  const command = argv[2] || 'plan';
  const args = parseArgs(argv);
  const latestTwicIssue = args.has('latest-twic') ? Number(args.get('latest-twic')) : null;
  const limit = args.has('limit') ? Number(args.get('limit')) : Infinity;
  const plan = await buildPublicSourcePlan({
    latestTwicIssue,
    includePgnMentor: !args.has('no-pgnmentor')
  });

  if (command === 'download') {
    const results = await downloadSources(plan, { limit, keepArchives: Boolean(args.get('keep-archives')) });
    console.log(JSON.stringify({
      planned: plan.length,
      attempted: results.length,
      downloaded: results.filter((item) => item.status === 'downloaded').length,
      failed: results.filter((item) => item.status === 'failed').length,
      skipped: plan.length - filterPendingDownloads(plan).length
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    planned: plan.length,
    pending: filterPendingDownloads(plan).length,
    first: plan.slice(0, 10).map((item) => ({ id: item.id, url: item.url }))
  }, null, 2));
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) : '';
if (invokedPath && process.argv[1] === invokedPath) {
  main(process.argv).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
