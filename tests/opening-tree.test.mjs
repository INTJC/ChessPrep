import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildOfflineStoreFromPgn, loadOfflineStore } from '../tools/player-prep/offline-store.mjs';
import { buildPrepReport } from '../tools/player-prep/prep-report.mjs';
import {
  buildOpponentOpeningTreeArtifact,
  loadOpponentOpeningTreeArtifact,
  loadOrBuildOpponentOpeningTree,
  openingTreePathFor,
  resetOpeningTreeCache,
  writeOpponentOpeningTreeArtifact
} from '../tools/player-prep/opening-tree.mjs';

function tempDir(prefix = 'chessprep-opening-tree-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

const opponentGames = `[Event "Sicilian Win"]
[Date "2024.01.01"]
[White "Target GM"]
[Black "Other GM"]
[Result "1-0"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 c5 2. Nf3 d6 1-0

[Event "French Sample"]
[Date "2024.01.02"]
[White "Target GM"]
[Black "Other GM"]
[Result "1/2-1/2"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 e6 2. d4 d5 1/2-1/2

[Event "Wrong Side"]
[Date "2024.01.03"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. d4 Nf6 2. c4 e6 0-1`;

test('buildOpponentOpeningTreeArtifact serializes a reusable opponent-side opening tree', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(opponentGames, { storeDir: dir, sourceName: 'games.pgn' });
    const store = loadOfflineStore({ storeDir: dir });

    const artifact = buildOpponentOpeningTreeArtifact(store, {
      opponent: 'Target GM',
      opponentSide: 'w',
      maxPly: 6
    });

    assert.equal(artifact.version, 1);
    assert.equal(artifact.normalizedOpponent, 'target gm');
    assert.equal(artifact.opponentSide, 'w');
    assert.equal(artifact.sampleGames, 2);
    assert.equal(artifact.maxPly, 6);
    assert.ok(artifact.nodes.length > 1);
    assert.deepEqual(artifact.root.moves.map((move) => move.uci), ['e2e4']);
    const afterE4 = artifact.nodes.find((node) => node.fen.includes(' b '));
    assert.ok(afterE4);
    assert.deepEqual(afterE4.moves.map((move) => move.uci).sort(), ['c7c5', 'e7e6']);
    assert.equal(JSON.stringify(artifact).includes('"moveMap"'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('opening tree artifacts are written with stable player-side paths and reused for prep reports', () => {
  const storeDir = tempDir('chessprep-opening-store-');
  const treeDir = tempDir('chessprep-opening-cache-');
  try {
    buildOfflineStoreFromPgn(opponentGames, { storeDir, sourceName: 'games.pgn' });
    const store = loadOfflineStore({ storeDir });
    const artifact = buildOpponentOpeningTreeArtifact(store, {
      opponent: 'Target GM',
      opponentSide: 'w',
      maxPly: 6
    });

    const expectedPath = openingTreePathFor({ treeDir, opponent: 'target gm', opponentSide: 'w', maxPly: 6 });
    const written = writeOpponentOpeningTreeArtifact(artifact, { treeDir });
    assert.equal(written.path, expectedPath);
    assert.equal(existsSync(expectedPath), true);

    const loaded = loadOpponentOpeningTreeArtifact({ treeDir, opponent: 'TARGET   GM', opponentSide: 'w', maxPly: 6 });
    assert.equal(loaded.sampleGames, 2);

    const report = buildPrepReport({
      opponentTree: loaded,
      opponent: 'Target GM',
      ourSide: 'b',
      prepPgn: '[Event "Prep"]\n[Result "*"]\n\n1. e4 c5 *',
      maxPly: 6
    });
    assert.equal(report.sampleGames, 2);
    assert.equal(Object.keys(report.explorer.nodes).length, loaded.nodes.length);
    assert.equal(report.explorer.nodes[loaded.root.fen].total, 2);
    assert.ok(report.gaps.find((item) => item.uci === 'g1f3'));
    assert.equal(report.gaps.some((item) => item.uci === 'e7e6'), false);

    resetOpeningTreeCache({ treeDir });
    assert.equal(existsSync(expectedPath), false);
  } finally {
    rmSync(storeDir, { recursive: true, force: true });
    rmSync(treeDir, { recursive: true, force: true });
  }
});

test('loadOrBuildOpponentOpeningTree uses a cached tree without requiring the compact store', () => {
  const storeDir = tempDir('chessprep-opening-store-');
  const treeDir = tempDir('chessprep-opening-cache-');
  try {
    buildOfflineStoreFromPgn(opponentGames, { storeDir, sourceName: 'games.pgn' });
    const store = loadOfflineStore({ storeDir });

    const first = loadOrBuildOpponentOpeningTree({
      store,
      treeDir,
      opponent: 'Target GM',
      opponentSide: 'w',
      maxPly: 6
    });
    assert.equal(first.fromCache, false);
    assert.equal(first.artifact.sampleGames, 2);

    const second = loadOrBuildOpponentOpeningTree({
      treeDir,
      opponent: 'Target GM',
      opponentSide: 'w',
      maxPly: 6
    });
    assert.equal(second.fromCache, true);
    assert.equal(second.artifact.sampleGames, 2);

    const raw = JSON.parse(readFileSync(second.path, 'utf8'));
    assert.equal(raw.sampleGames, 2);
  } finally {
    rmSync(storeDir, { recursive: true, force: true });
    rmSync(treeDir, { recursive: true, force: true });
  }
});

test('loadOrBuildOpponentOpeningTree rebuilds cache created with stale name matching rules', () => {
  const storeDir = tempDir('chessprep-opening-store-');
  const treeDir = tempDir('chessprep-opening-cache-');
  try {
    buildOfflineStoreFromPgn(opponentGames, { storeDir, sourceName: 'games.pgn' });
    const store = loadOfflineStore({ storeDir });
    const first = loadOrBuildOpponentOpeningTree({
      store,
      treeDir,
      opponent: 'Target GM',
      opponentSide: 'w',
      maxPly: 6
    });
    const raw = JSON.parse(readFileSync(first.path, 'utf8'));
    delete raw.nameMatchVersion;
    raw.sampleGames = 0;
    raw.nodes = [raw.root];
    raw.root = { ...raw.root, total: 0, moves: [] };
    writeOpponentOpeningTreeArtifact(raw, { treeDir });

    const second = loadOrBuildOpponentOpeningTree({
      store,
      treeDir,
      opponent: 'Target GM',
      opponentSide: 'w',
      maxPly: 6
    });

    assert.equal(second.fromCache, false);
    assert.equal(second.artifact.sampleGames, 2);
  } finally {
    rmSync(storeDir, { recursive: true, force: true });
    rmSync(treeDir, { recursive: true, force: true });
  }
});
