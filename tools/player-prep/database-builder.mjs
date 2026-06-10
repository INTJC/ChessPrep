import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendOfflineStoreSources,
  DEFAULT_STORE_DIR,
  dedupeOfflineStore,
  loadOfflineStore,
  STORE_BIN,
  STORE_JSON
} from './offline-store.mjs';

export const DEFAULT_SOURCE_DIRS = [
  join(process.cwd(), 'data', 'endgame-expansion', 'sources', 'raw', 'lichess-broadcast-db'),
  join(process.cwd(), 'data', 'endgame-expansion', 'sources', 'raw', 'twic'),
  join(process.cwd(), 'data', 'endgame-expansion', 'sources', 'raw')
];

function walkFiles(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(path, results);
    } else if (/\.pgn$/i.test(entry.name)) {
      results.push(path);
    }
  }
  return results;
}

export function discoverOfflinePgnSources({ sourceDirs = DEFAULT_SOURCE_DIRS } = {}) {
  const seen = new Set();
  return sourceDirs
    .flatMap((dir) => walkFiles(dir))
    .filter((path) => {
      if (seen.has(path)) return false;
      seen.add(path);
      return true;
    })
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({
      path,
      name: basename(path),
      bytes: statSync(path).size
    }));
}

function resetStore(storeDir) {
  mkdirSync(storeDir, { recursive: true });
  for (const file of readdirSync(storeDir)) {
    if (file !== STORE_JSON && file !== STORE_BIN && !/^offline-games\.games-\d+\.json$/.test(file)) continue;
    const path = join(storeDir, file);
    if (existsSync(path)) rmSync(path, { force: true });
  }
}

export function buildOfflineDatabase({
  sourceDirs = DEFAULT_SOURCE_DIRS,
  storeDir = DEFAULT_STORE_DIR,
  minYear = 2010,
  minElo = 2000,
  onProgress = null
} = {}) {
  const sources = discoverOfflinePgnSources({ sourceDirs });
  resetStore(storeDir);
  const startedAt = new Date().toISOString();
  const summary = {
    startedAt,
    completedAt: null,
    storeDir,
    sources: sources.length,
    importedGames: 0,
    skippedByFilter: 0,
    skippedByError: 0,
    duplicateGames: 0,
    sourceBytes: 0,
    compactBytes: 0,
    files: []
  };

  const appendSummary = appendOfflineStoreSources(sources, {
    storeDir,
    minYear,
    minElo,
    dedupe: true,
    onProgress
  });
  summary.importedGames = appendSummary.importedGames || 0;
  summary.skippedByFilter = appendSummary.skippedByFilter || 0;
  summary.skippedByError = appendSummary.skippedByError || 0;
  summary.duplicateGames = appendSummary.duplicateGames || 0;
  summary.sourceBytes = appendSummary.sourceBytes || 0;
  summary.files = appendSummary.files || [];

  const jsonPath = join(storeDir, STORE_JSON);
  const binPath = join(storeDir, STORE_BIN);
  summary.compactBytes = (existsSync(jsonPath) ? statSync(jsonPath).size : 0)
    + (existsSync(binPath) ? statSync(binPath).size : 0);
  summary.completedAt = new Date().toISOString();
  return summary;
}

export function appendMissingOfflineDatabaseSources({
  sourceDirs = DEFAULT_SOURCE_DIRS,
  storeDir = DEFAULT_STORE_DIR,
  minYear = 2010,
  minElo = 2000,
  onProgress = null,
  flushEverySources = 10,
  onFlush = null,
  limitSources = 0
} = {}) {
  const sources = discoverOfflinePgnSources({ sourceDirs });
  const store = loadOfflineStore({ storeDir });
  const importedSourceNames = new Set((store.sources || []).map((source) => source.sourceName));
  const missingSources = sources.filter((source) => !importedSourceNames.has(source.name));
  const limitedSources = Number(limitSources) > 0
    ? missingSources.slice(0, Number(limitSources))
    : missingSources;
  const startedAt = new Date().toISOString();
  const summary = {
    startedAt,
    completedAt: null,
    storeDir,
    sources: sources.length,
    alreadyImportedSources: importedSourceNames.size,
    missingSources: missingSources.length,
    limitedSources: limitedSources.length,
    importedSources: 0,
    importedGames: 0,
    skippedByFilter: 0,
    skippedByError: 0,
    duplicateGames: 0,
    sourceBytes: 0,
    compactBytes: 0,
    files: []
  };

  const appendSummary = appendOfflineStoreSources(limitedSources, {
    storeDir,
    minYear,
    minElo,
    dedupe: true,
    onProgress,
    flushEverySources,
    onFlush
  });
  summary.importedSources = appendSummary.importedSources || 0;
  summary.importedGames = appendSummary.importedGames || 0;
  summary.skippedByFilter = appendSummary.skippedByFilter || 0;
  summary.skippedByError = appendSummary.skippedByError || 0;
  summary.duplicateGames = appendSummary.duplicateGames || 0;
  summary.sourceBytes = appendSummary.sourceBytes || 0;
  summary.files = appendSummary.files || [];

  const jsonPath = join(storeDir, STORE_JSON);
  const binPath = join(storeDir, STORE_BIN);
  summary.compactBytes = (existsSync(jsonPath) ? statSync(jsonPath).size : 0)
    + (existsSync(binPath) ? statSync(binPath).size : 0);
  summary.completedAt = new Date().toISOString();
  return summary;
}

export function getOfflineDatabaseStatus({
  storeDir = DEFAULT_STORE_DIR,
  sourceDirs = DEFAULT_SOURCE_DIRS
} = {}) {
  const sources = discoverOfflinePgnSources({ sourceDirs });
  const jsonPath = join(storeDir, STORE_JSON);
  const binPath = join(storeDir, STORE_BIN);
  if (!existsSync(jsonPath) || !existsSync(binPath)) {
    return {
      ready: false,
      games: 0,
      sources: sources.length,
      storeBytes: 0,
      updatedAt: null
    };
  }

  const manifest = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const gameCount = Array.isArray(manifest.games)
    ? manifest.games.length
    : Number(manifest.gameCount) || 0;
  const shardBytes = Array.isArray(manifest.gameShards)
    ? manifest.gameShards.reduce((total, shard) => {
      const shardPath = join(storeDir, shard);
      return total + (existsSync(shardPath) ? statSync(shardPath).size : 0);
    }, 0)
    : 0;
  return {
    ready: true,
    games: gameCount,
    sources: sources.length,
    importedSources: Array.isArray(manifest.sources) ? manifest.sources.length : 0,
    duplicateGames: Array.isArray(manifest.sources)
      ? manifest.sources.reduce((total, source) => total + (Number(source.duplicateGames) || 0), 0)
      : 0,
    storeBytes: statSync(jsonPath).size + statSync(binPath).size + shardBytes,
    updatedAt: manifest.updatedAt || null
  };
}

function main(argv) {
  const command = argv[2] || 'status';
  if (command === 'build') {
    console.log(JSON.stringify(buildOfflineDatabase(), null, 2));
    return;
  }
  if (command === 'append-missing') {
    const limitSources = Number.parseInt(process.env.APPEND_MISSING_LIMIT || '', 10) || 0;
    const summary = appendMissingOfflineDatabaseSources({
      limitSources,
      flushEverySources: limitSources > 0 ? Math.min(10, limitSources) : 10,
      onProgress: (event) => {
        console.error([
          `[${event.index}/${event.total}]`,
          event.sourceName,
          `games=${event.importedGames}`,
          `dupes=${event.duplicateGames}`,
          `filtered=${event.skippedByFilter}`,
          `errors=${event.skippedByError}`,
          `total=${event.totalGames}`
        ].join(' '));
      },
      onFlush: (event) => {
        console.error([
          `[flush ${event.sourcesWritten}/${event.totalSources}]`,
          `total=${event.totalGames}`,
          `bytes=${event.compactBytes}`
        ].join(' '));
      }
    });
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (command === 'dedupe') {
    console.log(JSON.stringify(dedupeOfflineStore(), null, 2));
    return;
  }
  console.log(JSON.stringify(getOfflineDatabaseStatus(), null, 2));
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) : '';
if (invokedPath && process.argv[1] === invokedPath) {
  main(process.argv);
}
