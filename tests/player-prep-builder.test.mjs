import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendOfflineStoreSources } from '../tools/player-prep/offline-store.mjs';
import {
  appendMissingOfflineDatabaseSources,
  buildOfflineDatabase,
  discoverOfflinePgnSources,
  getOfflineDatabaseStatus
} from '../tools/player-prep/database-builder.mjs';

const eligiblePgn = `[Event "Eligible"]
[Date "2024.01.01"]
[White "Target GM"]
[Black "Other GM"]
[Result "1-0"]
[WhiteElo "2400"]
[BlackElo "2300"]

1. e4 e5 1-0`;

const exactly2000Pgn = `[Event "Exactly 2000"]
[Date "2024.01.01"]
[White "Boundary Player"]
[Black "Other Boundary"]
[Result "1-0"]
[WhiteElo "2000"]
[BlackElo "2000"]

1. e4 e5 1-0`;

const filteredPgn = `[Event "Filtered"]
[Date "2009.01.01"]
[White "Old GM"]
[Black "Other GM"]
[Result "1-0"]
[WhiteElo "2400"]
[BlackElo "2300"]

1. d4 d5 1-0`;

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'chessprep-builder-'));
}

test('discoverOfflinePgnSources finds pgn files under configured source directories', () => {
  const root = tempRoot();
  try {
    const sourceDir = join(root, 'sources', 'broadcast');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'a.pgn'), eligiblePgn, 'utf8');
    writeFileSync(join(sourceDir, 'ignore.txt'), eligiblePgn, 'utf8');

    const sources = discoverOfflinePgnSources({ sourceDirs: [sourceDir] });

    assert.equal(sources.length, 1);
    assert.equal(sources[0].name, 'a.pgn');
    assert.match(sources[0].path, /a\.pgn$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildOfflineDatabase builds a compact store from discovered public sources', () => {
  const root = tempRoot();
  try {
    const sourceDir = join(root, 'sources');
    const storeDir = join(root, 'store');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'eligible.pgn'), eligiblePgn, 'utf8');
    writeFileSync(join(sourceDir, 'filtered.pgn'), filteredPgn, 'utf8');

    const summary = buildOfflineDatabase({ sourceDirs: [sourceDir], storeDir });
    const status = getOfflineDatabaseStatus({ storeDir, sourceDirs: [sourceDir] });

    assert.equal(summary.sources, 2);
    assert.equal(summary.importedGames, 1);
    assert.equal(summary.skippedByFilter, 1);
    assert.equal(status.ready, true);
    assert.equal(status.games, 1);
    assert.equal(status.sources, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildOfflineDatabase deduplicates the same game across public sources', () => {
  const root = tempRoot();
  try {
    const sourceDir = join(root, 'sources');
    const storeDir = join(root, 'store');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'first.pgn'), eligiblePgn, 'utf8');
    writeFileSync(join(sourceDir, 'second.pgn'), eligiblePgn.replace('Eligible', 'Same Game Elsewhere'), 'utf8');

    const summary = buildOfflineDatabase({ sourceDirs: [sourceDir], storeDir });
    const status = getOfflineDatabaseStatus({ storeDir, sourceDirs: [sourceDir] });

    assert.equal(summary.sources, 2);
    assert.equal(summary.importedGames, 1);
    assert.equal(summary.duplicateGames, 1);
    assert.equal(status.games, 1);
    assert.equal(status.duplicateGames, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendMissingOfflineDatabaseSources adds downloaded sources without resetting the store', () => {
  const root = tempRoot();
  try {
    const firstDir = join(root, 'first');
    const secondDir = join(root, 'second');
    const storeDir = join(root, 'store');
    mkdirSync(firstDir, { recursive: true });
    mkdirSync(secondDir, { recursive: true });
    writeFileSync(join(firstDir, 'first.pgn'), eligiblePgn, 'utf8');
    writeFileSync(join(secondDir, 'second.pgn'), eligiblePgn.replace('Target GM', 'Fresh GM'), 'utf8');

    buildOfflineDatabase({ sourceDirs: [firstDir], storeDir });
    const summary = appendMissingOfflineDatabaseSources({ sourceDirs: [firstDir, secondDir], storeDir });
    const status = getOfflineDatabaseStatus({ storeDir, sourceDirs: [firstDir, secondDir] });

    assert.equal(summary.sources, 2);
    assert.equal(summary.alreadyImportedSources, 1);
    assert.equal(summary.importedSources, 1);
    assert.equal(summary.importedGames, 1);
    assert.equal(status.games, 2);
    assert.equal(status.importedSources, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendMissingOfflineDatabaseSources can limit each incremental import batch', () => {
  const root = tempRoot();
  try {
    const firstDir = join(root, 'first');
    const secondDir = join(root, 'second');
    const thirdDir = join(root, 'third');
    const storeDir = join(root, 'store');
    mkdirSync(firstDir, { recursive: true });
    mkdirSync(secondDir, { recursive: true });
    mkdirSync(thirdDir, { recursive: true });
    writeFileSync(join(firstDir, 'first.pgn'), eligiblePgn, 'utf8');
    writeFileSync(join(secondDir, 'second.pgn'), eligiblePgn.replace('Target GM', 'Second GM'), 'utf8');
    writeFileSync(join(thirdDir, 'third.pgn'), eligiblePgn.replace('Target GM', 'Third GM'), 'utf8');

    buildOfflineDatabase({ sourceDirs: [firstDir], storeDir });
    const summary = appendMissingOfflineDatabaseSources({
      sourceDirs: [firstDir, secondDir, thirdDir],
      storeDir,
      limitSources: 1
    });
    const status = getOfflineDatabaseStatus({ storeDir, sourceDirs: [firstDir, secondDir, thirdDir] });

    assert.equal(summary.missingSources, 2);
    assert.equal(summary.importedSources, 1);
    assert.equal(summary.importedGames, 1);
    assert.equal(status.importedSources, 2);
    assert.equal(status.games, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildOfflineDatabase filters 2000-rated players from the public prep database', () => {
  const root = tempRoot();
  try {
    const sourceDir = join(root, 'sources');
    const storeDir = join(root, 'store');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'boundary.pgn'), exactly2000Pgn, 'utf8');

    const summary = buildOfflineDatabase({ sourceDirs: [sourceDir], storeDir });
    const status = getOfflineDatabaseStatus({ storeDir, sourceDirs: [sourceDir] });

    assert.equal(summary.importedGames, 0);
    assert.equal(summary.skippedByFilter, 1);
    assert.equal(status.games, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getOfflineDatabaseStatus reports missing database without failing', () => {
  const root = tempRoot();
  try {
    const status = getOfflineDatabaseStatus({ storeDir: join(root, 'missing'), sourceDirs: [] });
    assert.equal(status.ready, false);
    assert.equal(status.games, 0);
    assert.equal(status.sources, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getOfflineDatabaseStatus includes sharded game metadata bytes', () => {
  const root = tempRoot();
  try {
    const sourceDir = join(root, 'sources');
    const storeDir = join(root, 'store');
    mkdirSync(sourceDir, { recursive: true });
    const first = join(sourceDir, 'first.pgn');
    const second = join(sourceDir, 'second.pgn');
    writeFileSync(first, eligiblePgn, 'utf8');
    writeFileSync(second, eligiblePgn.replace('Target GM', 'Shard GM'), 'utf8');

    appendOfflineStoreSources([
      { path: first, name: 'first.pgn' },
      { path: second, name: 'second.pgn' }
    ], { storeDir, inlineGameLimit: 1 });
    const status = getOfflineDatabaseStatus({ storeDir, sourceDirs: [sourceDir] });
    const expectedBytes = ['offline-games.json', 'offline-games.bin', ...readdirSync(storeDir).filter((file) => /^offline-games\.games-\d+\.json$/.test(file))]
      .reduce((total, file) => total + statSync(join(storeDir, file)).size, 0);

    assert.equal(status.ready, true);
    assert.equal(status.games, 2);
    assert.equal(status.storeBytes, expectedBytes);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
