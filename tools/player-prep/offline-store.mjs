import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  collectCompactGameBatch,
  decodeMoveBuffer,
  summarizeCompactBatch
} from './compact-games.mjs';

export const DEFAULT_STORE_DIR = join(process.cwd(), 'data', 'player-prep');
export const STORE_JSON = 'offline-games.json';
export const STORE_BIN = 'offline-games.bin';
const GAME_SHARD_PREFIX = 'offline-games.games-';
const GAME_SHARD_SIZE = 100000;
const DEFAULT_INLINE_GAME_LIMIT = 150000;

function emptyManifest() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stringTable: [],
    games: [],
    sources: []
  };
}

function ensureStoreDir(storeDir) {
  mkdirSync(storeDir, { recursive: true });
}

function manifestPath(storeDir) {
  return join(storeDir, STORE_JSON);
}

function movePath(storeDir) {
  return join(storeDir, STORE_BIN);
}

function gameShardName(index) {
  return `${GAME_SHARD_PREFIX}${String(index + 1).padStart(4, '0')}.json`;
}

function loadManifest(storeDir) {
  const path = manifestPath(storeDir);
  if (!existsSync(path)) return emptyManifest();
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  const manifest = {
    ...emptyManifest(),
    ...parsed
  };
  if (Array.isArray(parsed.gameShards) && !Object.hasOwn(parsed, 'games')) {
    delete manifest.games;
  }
  return manifest;
}

function loadManifestWithGames(storeDir) {
  const manifest = loadManifest(storeDir);
  if (Array.isArray(manifest.games)) return manifest;
  const games = [];
  for (const shard of Array.isArray(manifest.gameShards) ? manifest.gameShards : []) {
    const shardPath = join(storeDir, shard);
    if (existsSync(shardPath)) {
      const shardGames = JSON.parse(readFileSync(shardPath, 'utf8'));
      if (Array.isArray(shardGames)) games.push(...shardGames);
    }
  }
  return {
    ...manifest,
    games
  };
}

function removeExistingGameShards(storeDir, manifest) {
  for (const shard of Array.isArray(manifest.gameShards) ? manifest.gameShards : []) {
    const shardPath = join(storeDir, shard);
    if (existsSync(shardPath)) rmSync(shardPath, { force: true });
  }
}

function serializeManifest(manifest, storeDir, {
  inlineGameLimit = DEFAULT_INLINE_GAME_LIMIT
} = {}) {
  const games = Array.isArray(manifest.games) ? manifest.games : [];
  if (games.length <= inlineGameLimit) {
    removeExistingGameShards(storeDir, manifest);
    delete manifest.gameCount;
    delete manifest.gameShards;
    const inlineManifest = { ...manifest, games };
    return `${JSON.stringify(inlineManifest)}\n`;
  }

  removeExistingGameShards(storeDir, manifest);
  const gameShards = [];
  for (let offset = 0; offset < games.length; offset += GAME_SHARD_SIZE) {
    const shardName = gameShardName(gameShards.length);
    gameShards.push(shardName);
    writeFileSync(join(storeDir, shardName), `${JSON.stringify(games.slice(offset, offset + GAME_SHARD_SIZE))}\n`, 'utf8');
  }
  manifest.gameCount = games.length;
  manifest.gameShards = gameShards;

  const shardManifest = {
    ...manifest,
    games: undefined,
    gameCount: games.length,
    gameShards
  };
  delete shardManifest.games;
  return `${JSON.stringify(shardManifest)}\n`;
}

function writeStoreFiles(storeDir, manifest, moveBuffer, {
  inlineGameLimit = DEFAULT_INLINE_GAME_LIMIT
} = {}) {
  const serializedManifest = serializeManifest(manifest, storeDir, { inlineGameLimit });
  writeFileSync(manifestPath(storeDir), serializedManifest, 'utf8');
  writeFileSync(movePath(storeDir), moveBuffer);
  const shardBytes = Array.isArray(manifest.gameShards)
    ? manifest.gameShards.reduce((total, shard) => {
      const shardPath = join(storeDir, shard);
      return total + (existsSync(shardPath) ? statSync(shardPath).size : 0);
    }, 0)
    : 0;
  return Buffer.byteLength(serializedManifest, 'utf8') + moveBuffer.length + shardBytes;
}

function loadMoveBuffer(storeDir) {
  const path = movePath(storeDir);
  return existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
}

function stringTableIndex(stringTable) {
  return new Map(stringTable.map((value, index) => [value, index]));
}

function remapStringId(batchStringTable, targetStringTable, targetIndex, id) {
  const value = batchStringTable[id] || '';
  if (targetIndex.has(value)) return targetIndex.get(value);
  const nextId = targetStringTable.length;
  targetStringTable.push(value);
  targetIndex.set(value, nextId);
  return nextId;
}

function remapGame(game, batch, targetStringTable, targetIndex, moveOffsetDelta) {
  return {
    ...game,
    event: remapStringId(batch.stringTable, targetStringTable, targetIndex, game.event),
    site: remapStringId(batch.stringTable, targetStringTable, targetIndex, game.site),
    date: remapStringId(batch.stringTable, targetStringTable, targetIndex, game.date),
    round: remapStringId(batch.stringTable, targetStringTable, targetIndex, game.round),
    white: remapStringId(batch.stringTable, targetStringTable, targetIndex, game.white),
    black: remapStringId(batch.stringTable, targetStringTable, targetIndex, game.black),
    result: remapStringId(batch.stringTable, targetStringTable, targetIndex, game.result),
    eco: remapStringId(batch.stringTable, targetStringTable, targetIndex, game.eco),
    moveOffset: game.moveOffset + moveOffsetDelta
  };
}

function stringValue(table, id) {
  return table?.[id] || '';
}

function compactGameFingerprint(game, stringTable, moves) {
  const text = [
    stringValue(stringTable, game.white).trim().toLowerCase(),
    stringValue(stringTable, game.black).trim().toLowerCase(),
    stringValue(stringTable, game.date).trim(),
    stringValue(stringTable, game.result).trim(),
    (Array.isArray(moves) ? moves : []).join(' ')
  ].join('\u0001');
  return createHash('sha1').update(text).digest('hex');
}

export function existingGameFingerprints(manifest, moveBuffer) {
  const seen = new Set();
  for (const game of Array.isArray(manifest.games) ? manifest.games : []) {
    seen.add(compactGameFingerprint(
      game,
      manifest.stringTable,
      decodeMoveBuffer(moveBuffer, game.moveOffset, game.moveCount)
    ));
  }
  return seen;
}

export function buildOfflineStoreFromPgn(pgn, {
  storeDir = DEFAULT_STORE_DIR,
  sourceName = 'imported.pgn',
  minYear = 2010,
  minElo = 2000,
  dedupe = false,
  fingerprintSet = null,
  inlineGameLimit = DEFAULT_INLINE_GAME_LIMIT
} = {}) {
  ensureStoreDir(storeDir);
  const manifest = loadManifestWithGames(storeDir);
  const existingMoveBuffer = loadMoveBuffer(storeDir);
  const batch = collectCompactGameBatch(pgn, { sourceName, minYear, minElo });
  const targetIndex = stringTableIndex(manifest.stringTable);
  const importedAt = new Date().toISOString();
  const fingerprints = fingerprintSet || (dedupe ? existingGameFingerprints(manifest, existingMoveBuffer) : null);
  const remappedGames = [];
  const moveParts = [];
  let moveOffset = existingMoveBuffer.length / 2;
  let duplicateGames = 0;

  for (const game of batch.games) {
    const moves = decodeMoveBuffer(batch.moveBuffer, game.moveOffset, game.moveCount);
    if (fingerprints) {
      const fingerprint = compactGameFingerprint(game, batch.stringTable, moves);
      if (fingerprints.has(fingerprint)) {
        duplicateGames += 1;
        continue;
      }
      fingerprints.add(fingerprint);
    }

    const moveBuffer = Buffer.alloc(moves.length * 2);
    for (let index = 0; index < moves.length; index += 1) {
      batch.moveBuffer.copy(moveBuffer, index * 2, (game.moveOffset + index) * 2, (game.moveOffset + index + 1) * 2);
    }
    moveParts.push(moveBuffer);
    remappedGames.push({
      ...remapGame(game, batch, manifest.stringTable, targetIndex, moveOffset - game.moveOffset),
      source: sourceName,
      importedAt
    });
    moveOffset += moves.length;
  }

  manifest.games.push(...remappedGames);
  manifest.sources.push({
    sourceName,
    importedAt,
    games: remappedGames.length,
    duplicateGames,
    skippedByFilter: batch.skippedByFilter || 0,
    skippedByError: batch.errors.length
  });
  manifest.updatedAt = importedAt;

  const nextMoveBuffer = Buffer.concat([existingMoveBuffer, ...moveParts]);
  const compactBytes = writeStoreFiles(storeDir, manifest, nextMoveBuffer, { inlineGameLimit });

  return {
    ...summarizeCompactBatch(batch, Buffer.byteLength(String(pgn || ''), 'utf8')),
    importedGames: remappedGames.length,
    duplicateGames,
    totalGames: manifest.games.length,
    compactBytes,
    storeDir
  };
}

export function appendOfflineStoreSources(sources = [], {
  storeDir = DEFAULT_STORE_DIR,
  minYear = 2010,
  minElo = 2000,
  dedupe = false,
  fingerprintSet = null,
  onProgress = null,
  flushEverySources = 0,
  onFlush = null,
  inlineGameLimit = DEFAULT_INLINE_GAME_LIMIT
} = {}) {
  ensureStoreDir(storeDir);
  const manifest = loadManifestWithGames(storeDir);
  const existingMoveBuffer = loadMoveBuffer(storeDir);
  const targetIndex = stringTableIndex(manifest.stringTable);
  const startedAt = new Date().toISOString();
  const fingerprints = fingerprintSet || (dedupe ? existingGameFingerprints(manifest, existingMoveBuffer) : null);
  let moveParts = [];
  const sourceList = Array.isArray(sources) ? sources : [];
  const flushEvery = Math.max(0, Number(flushEverySources) || 0);
  const summary = {
    startedAt,
    completedAt: null,
    storeDir,
    sources: sourceList.length,
    importedSources: 0,
    importedGames: 0,
    skippedByFilter: 0,
    skippedByError: 0,
    duplicateGames: 0,
    sourceBytes: 0,
    compactBytes: 0,
    files: []
  };
  let moveOffset = existingMoveBuffer.length / 2;
  let persistedMoveBuffer = existingMoveBuffer;

  const flush = (sourcesWritten) => {
    if (!moveParts.length) return;
    persistedMoveBuffer = Buffer.concat([persistedMoveBuffer, ...moveParts]);
    moveParts = [];
    summary.compactBytes = writeStoreFiles(storeDir, manifest, persistedMoveBuffer, { inlineGameLimit });
    if (typeof onFlush === 'function') {
      onFlush({
        sourcesWritten,
        totalSources: sourceList.length,
        totalGames: manifest.games.length,
        compactBytes: summary.compactBytes
      });
    }
  };

  sourceList.forEach((source, sourceIndex) => {
    if (!source?.path) throw new Error('Offline store source is missing a path');
    const sourceName = source.name || source.sourceName || 'imported.pgn';
    const pgn = readFileSync(source.path, 'utf8');
    const sourceBytes = Number(source.bytes) || Buffer.byteLength(pgn, 'utf8');
    const batch = collectCompactGameBatch(pgn, { sourceName, minYear, minElo });
    const importedAt = new Date().toISOString();
    const importedGames = [];
    let duplicateGames = 0;

    for (const game of batch.games) {
      const moves = fingerprints
        ? decodeMoveBuffer(batch.moveBuffer, game.moveOffset, game.moveCount)
        : null;
      if (fingerprints) {
        const fingerprint = compactGameFingerprint(game, batch.stringTable, moves);
        if (fingerprints.has(fingerprint)) {
          duplicateGames += 1;
          continue;
        }
        fingerprints.add(fingerprint);
      }

      const moveStart = game.moveOffset * 2;
      const moveEnd = (game.moveOffset + game.moveCount) * 2;
      moveParts.push(Buffer.from(batch.moveBuffer.subarray(moveStart, moveEnd)));
      importedGames.push({
        ...remapGame(game, batch, manifest.stringTable, targetIndex, moveOffset - game.moveOffset),
        source: sourceName,
        importedAt
      });
      moveOffset += game.moveCount;
    }

    manifest.games.push(...importedGames);
    manifest.sources.push({
      sourceName,
      importedAt,
      games: importedGames.length,
      duplicateGames,
      skippedByFilter: batch.skippedByFilter || 0,
      skippedByError: batch.errors.length
    });

    summary.importedSources += 1;
    summary.importedGames += importedGames.length;
    summary.skippedByFilter += batch.skippedByFilter || 0;
    summary.skippedByError += batch.errors.length;
    summary.duplicateGames += duplicateGames;
    summary.sourceBytes += sourceBytes;
    summary.files.push({
      name: sourceName,
      bytes: sourceBytes,
      importedGames: importedGames.length,
      duplicateGames,
      skippedByFilter: batch.skippedByFilter || 0,
      skippedByError: batch.errors.length
    });

    if (typeof onProgress === 'function') {
      onProgress({
        index: sourceIndex + 1,
        total: sourceList.length,
        sourceName,
        importedGames: importedGames.length,
        duplicateGames,
        skippedByFilter: batch.skippedByFilter || 0,
        skippedByError: batch.errors.length,
        totalGames: manifest.games.length
      });
    }

    if (flushEvery && (sourceIndex + 1) % flushEvery === 0) {
      flush(sourceIndex + 1);
    }
  });

  summary.completedAt = new Date().toISOString();
  manifest.updatedAt = summary.completedAt;
  const nextMoveBuffer = moveParts.length
    ? Buffer.concat([persistedMoveBuffer, ...moveParts])
    : persistedMoveBuffer;
  summary.compactBytes = writeStoreFiles(storeDir, manifest, nextMoveBuffer, { inlineGameLimit });
  return summary;
}

export function dedupeOfflineStore({ storeDir = DEFAULT_STORE_DIR } = {}) {
  ensureStoreDir(storeDir);
  const manifest = loadManifestWithGames(storeDir);
  const moveBuffer = loadMoveBuffer(storeDir);
  const seen = new Set();
  const keptGames = [];
  const moveParts = [];
  const sourceStats = new Map();
  let moveOffset = 0;
  let removedGames = 0;

  for (const source of Array.isArray(manifest.sources) ? manifest.sources : []) {
    sourceStats.set(source.sourceName, {
      games: 0,
      duplicateGames: Number(source.duplicateGames) || 0
    });
  }

  for (const game of Array.isArray(manifest.games) ? manifest.games : []) {
    const moves = decodeMoveBuffer(moveBuffer, game.moveOffset, game.moveCount);
    const fingerprint = compactGameFingerprint(game, manifest.stringTable, moves);
    const sourceName = game.source || '';
    if (!sourceStats.has(sourceName)) {
      sourceStats.set(sourceName, { games: 0, duplicateGames: 0 });
    }

    if (seen.has(fingerprint)) {
      sourceStats.get(sourceName).duplicateGames += 1;
      removedGames += 1;
      continue;
    }

    seen.add(fingerprint);
    const moveStart = game.moveOffset * 2;
    const moveEnd = (game.moveOffset + game.moveCount) * 2;
    moveParts.push(Buffer.from(moveBuffer.subarray(moveStart, moveEnd)));
    keptGames.push({
      ...game,
      moveOffset
    });
    sourceStats.get(sourceName).games += 1;
    moveOffset += game.moveCount;
  }

  const completedAt = new Date().toISOString();
  const nextMoveBuffer = Buffer.concat(moveParts);
  manifest.games = keptGames;
  manifest.sources = (Array.isArray(manifest.sources) ? manifest.sources : []).map((source) => {
    const stats = sourceStats.get(source.sourceName) || { games: 0, duplicateGames: 0 };
    return {
      ...source,
      games: stats.games,
      duplicateGames: stats.duplicateGames
    };
  });
  manifest.updatedAt = completedAt;

  const compactBytes = writeStoreFiles(storeDir, manifest, nextMoveBuffer);
  return {
    storeDir,
    originalGames: keptGames.length + removedGames,
    keptGames: keptGames.length,
    removedGames,
    compactBytes,
    completedAt
  };
}

export function loadOfflineStore({ storeDir = DEFAULT_STORE_DIR } = {}) {
  const manifest = loadManifestWithGames(storeDir);
  return {
    ...manifest,
    storeDir,
    moveBuffer: loadMoveBuffer(storeDir)
  };
}

export function decodeStoredGameMoves(store, game) {
  if (!store?.moveBuffer || !game) return [];
  return decodeMoveBuffer(store.moveBuffer, game.moveOffset, game.moveCount);
}
