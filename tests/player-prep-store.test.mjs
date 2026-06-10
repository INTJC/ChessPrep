import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendOfflineStoreSources,
  buildOfflineStoreFromPgn,
  decodeStoredGameMoves,
  dedupeOfflineStore,
  loadOfflineStore
} from '../tools/player-prep/offline-store.mjs';

const pgn = `[Event "Eligible Match"]
[Site "London"]
[Date "2024.03.01"]
[Round "1"]
[White "Alpha Player"]
[Black "Beta Player"]
[Result "1-0"]
[WhiteElo "2550"]
[BlackElo "2450"]
[ECO "C50"]

1. e4 e5 2. Nf3 Nc6 1-0

[Event "Old Match"]
[Date "2008.03.01"]
[White "Old Player"]
[Black "Beta Player"]
[Result "0-1"]
[WhiteElo "2550"]
[BlackElo "2450"]

1. d4 d5 0-1`;

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'chessprep-store-'));
}

test('buildOfflineStoreFromPgn writes only eligible games into json and move bin files', () => {
  const dir = tempDir();
  try {
    const summary = buildOfflineStoreFromPgn(pgn, { storeDir: dir, sourceName: 'sample.pgn' });
    assert.equal(summary.games, 1);
    assert.equal(summary.skippedByFilter, 1);
    assert.equal(summary.moves, 4);

    const manifest = JSON.parse(readFileSync(join(dir, 'offline-games.json'), 'utf8'));
    assert.equal(manifest.games.length, 1);
    assert.equal(manifest.stringTable[manifest.games[0].white], 'Alpha Player');
    assert.equal(manifest.stringTable[manifest.games[0].black], 'Beta Player');
    assert.equal(readFileSync(join(dir, 'offline-games.bin')).length, 8);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadOfflineStore decodes stored move bytes without original PGN text', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(pgn, { storeDir: dir, sourceName: 'sample.pgn' });
    const store = loadOfflineStore({ storeDir: dir });
    assert.equal(store.games.length, 1);
    assert.deepEqual(decodeStoredGameMoves(store, store.games[0]), ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildOfflineStoreFromPgn appends eligible games while preserving string dictionary ids', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(pgn, { storeDir: dir, sourceName: 'sample-a.pgn' });
    const summary = buildOfflineStoreFromPgn(`[Event "Second"]
[Date "2024.04.01"]
[White "Alpha Player"]
[Black "Gamma Player"]
[Result "1/2-1/2"]
[WhiteElo "2550"]
[BlackElo "2300"]

1. c4 e5 1/2-1/2`, { storeDir: dir, sourceName: 'sample-b.pgn' });

    const store = loadOfflineStore({ storeDir: dir });
    assert.equal(summary.importedGames, 1);
    assert.equal(summary.totalGames, 2);
    assert.equal(store.games.length, 2);
    assert.equal(store.games[0].white, store.games[1].white);
    assert.deepEqual(decodeStoredGameMoves(store, store.games[1]), ['c2c4', 'e7e5']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendOfflineStoreSources appends missing batches with dedupe and progress events', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(pgn, { storeDir: dir, sourceName: 'sample-a.pgn', dedupe: true });
    const firstSource = join(dir, 'duplicate.pgn');
    const secondSource = join(dir, 'fresh.pgn');
    writeFileSync(firstSource, pgn, 'utf8');
    writeFileSync(secondSource, `[Event "Fresh"]
[Date "2024.05.01"]
[White "Delta Player"]
[Black "Beta Player"]
[Result "0-1"]
[WhiteElo "2550"]
[BlackElo "2450"]

1. d4 Nf6 0-1`, 'utf8');
    const progress = [];

    const summary = appendOfflineStoreSources([
      { path: firstSource, name: 'duplicate.pgn' },
      { path: secondSource, name: 'fresh.pgn' }
    ], {
      storeDir: dir,
      dedupe: true,
      onProgress: (event) => progress.push(event)
    });

    const store = loadOfflineStore({ storeDir: dir });
    assert.equal(summary.importedSources, 2);
    assert.equal(summary.importedGames, 1);
    assert.equal(summary.duplicateGames, 1);
    assert.equal(store.games.length, 2);
    assert.equal(store.sources.at(-2).duplicateGames, 1);
    assert.deepEqual(decodeStoredGameMoves(store, store.games[1]), ['d2d4', 'g8f6']);
    assert.deepEqual(progress.map((event) => event.sourceName), ['duplicate.pgn', 'fresh.pgn']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendOfflineStoreSources can flush appended batches during long imports', () => {
  const dir = tempDir();
  try {
    const firstSource = join(dir, 'first.pgn');
    const secondSource = join(dir, 'second.pgn');
    writeFileSync(firstSource, pgn, 'utf8');
    writeFileSync(secondSource, `[Event "Second"]
[Date "2024.06.01"]
[White "Echo Player"]
[Black "Beta Player"]
[Result "1-0"]
[WhiteElo "2550"]
[BlackElo "2450"]

1. Nf3 d5 1-0`, 'utf8');
    const flushed = [];

    const summary = appendOfflineStoreSources([
      { path: firstSource, name: 'first.pgn' },
      { path: secondSource, name: 'second.pgn' }
    ], {
      storeDir: dir,
      flushEverySources: 1,
      onFlush: (event) => flushed.push(event)
    });

    const store = loadOfflineStore({ storeDir: dir });
    assert.equal(summary.importedSources, 2);
    assert.equal(summary.importedGames, 2);
    assert.equal(flushed.length, 2);
    assert.deepEqual(flushed.map((event) => event.sourcesWritten), [1, 2]);
    assert.deepEqual(decodeStoredGameMoves(store, store.games[1]), ['g1f3', 'd7d5']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendOfflineStoreSources shards large game manifests while preserving transparent loads', () => {
  const dir = tempDir();
  try {
    const firstSource = join(dir, 'first.pgn');
    const secondSource = join(dir, 'second.pgn');
    writeFileSync(firstSource, pgn, 'utf8');
    writeFileSync(secondSource, `[Event "Shard"]
[Date "2024.07.01"]
[White "Foxtrot Player"]
[Black "Beta Player"]
[Result "1-0"]
[WhiteElo "2550"]
[BlackElo "2450"]

1. e4 c5 1-0`, 'utf8');

    const summary = appendOfflineStoreSources([
      { path: firstSource, name: 'first.pgn' },
      { path: secondSource, name: 'second.pgn' }
    ], {
      storeDir: dir,
      inlineGameLimit: 1
    });

    const manifest = JSON.parse(readFileSync(join(dir, 'offline-games.json'), 'utf8'));
    const store = loadOfflineStore({ storeDir: dir });
    const expectedBytes = ['offline-games.json', 'offline-games.bin', ...readdirSync(dir).filter((file) => /^offline-games\.games-\d+\.json$/.test(file))]
      .reduce((total, file) => total + statSync(join(dir, file)).size, 0);
    assert.equal(manifest.games, undefined);
    assert.equal(manifest.gameCount, 2);
    assert.deepEqual(manifest.gameShards, ['offline-games.games-0001.json']);
    assert.equal(summary.compactBytes, expectedBytes);
    assert.equal(store.games.length, 2);
    assert.deepEqual(decodeStoredGameMoves(store, store.games[1]), ['e2e4', 'c7c5']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dedupeOfflineStore removes existing duplicate games and rewrites source counts', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(pgn, { storeDir: dir, sourceName: 'sample-a.pgn' });
    buildOfflineStoreFromPgn(pgn.replace('Eligible Match', 'Same Game Elsewhere'), {
      storeDir: dir,
      sourceName: 'sample-b.pgn'
    });

    const summary = dedupeOfflineStore({ storeDir: dir });
    const store = loadOfflineStore({ storeDir: dir });

    assert.equal(summary.originalGames, 2);
    assert.equal(summary.keptGames, 1);
    assert.equal(summary.removedGames, 1);
    assert.equal(store.games.length, 1);
    assert.equal(store.sources[0].games, 1);
    assert.equal(store.sources[1].games, 0);
    assert.equal(store.sources[1].duplicateGames, 1);
    assert.equal(readFileSync(join(dir, 'offline-games.bin')).length, 8);
    assert.deepEqual(decodeStoredGameMoves(store, store.games[0]), ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
