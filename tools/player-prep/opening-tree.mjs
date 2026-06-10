import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_STORE_DIR, loadOfflineStore } from './offline-store.mjs';
import { buildOpponentOpeningTree, normalizePlayerName, PLAYER_NAME_MATCH_VERSION } from './prep-report.mjs';

export const DEFAULT_OPENING_TREE_DIR = join(DEFAULT_STORE_DIR, 'opening-trees');

function normalizedSide(side) {
  return side === 'b' ? 'b' : 'w';
}

function normalizedMaxPly(maxPly) {
  const value = Number(maxPly);
  return Number.isInteger(value) && value > 0 ? value : 40;
}

function playerSlug(name) {
  const normalized = normalizePlayerName(name) || 'unknown';
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'player';
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10);
  return `${slug}-${hash}`;
}

export function openingTreePathFor({
  treeDir = DEFAULT_OPENING_TREE_DIR,
  opponent,
  opponentSide = 'w',
  maxPly = 40
} = {}) {
  const side = normalizedSide(opponentSide);
  const ply = normalizedMaxPly(maxPly);
  return join(treeDir, `${playerSlug(opponent)}-${side}-ply${ply}.json`);
}

function serializableMove(move) {
  return {
    uci: move.uci,
    count: Number(move.count) || 0,
    score: Number(move.score) || 0,
    scoreRate: Number.isFinite(move.scoreRate) ? move.scoreRate : 0,
    nextFen: move.nextFen || ''
  };
}

function serializableNode(node) {
  return {
    fen: node.fen,
    total: Number(node.total) || 0,
    moves: (Array.isArray(node.moves) ? node.moves : [])
      .map(serializableMove)
      .sort((a, b) => b.count - a.count || a.uci.localeCompare(b.uci))
  };
}

export function serializeOpponentOpeningTree(tree, {
  createdAt = new Date().toISOString(),
  storeUpdatedAt = null
} = {}) {
  const nodes = [...tree.nodes.values()]
    .map(serializableNode)
    .filter((node) => node.total > 0 || node.moves.length > 0 || node.fen === tree.root?.fen)
    .sort((a, b) => b.total - a.total || a.fen.localeCompare(b.fen));
  const root = serializableNode(tree.nodes.get(tree.root?.fen) || tree.root || nodes[0] || { fen: '', total: 0, moves: [] });

  return {
    version: 1,
    nameMatchVersion: PLAYER_NAME_MATCH_VERSION,
    createdAt,
    storeUpdatedAt,
    opponent: tree.opponent || '',
    normalizedOpponent: normalizePlayerName(tree.opponent),
    opponentSide: normalizedSide(tree.opponentSide),
    maxPly: normalizedMaxPly(tree.maxPly),
    sampleGames: Number(tree.sampleGames ?? tree.games?.length) || 0,
    root,
    nodes
  };
}

export function buildOpponentOpeningTreeArtifact(store, {
  opponent,
  opponentSide = 'w',
  maxPly = 40,
  createdAt
} = {}) {
  const tree = buildOpponentOpeningTree(store, { opponent, opponentSide, maxPly });
  return serializeOpponentOpeningTree(
    {
      ...tree,
      maxPly: normalizedMaxPly(maxPly)
    },
    {
      createdAt,
      storeUpdatedAt: store?.updatedAt || null
    }
  );
}

export function writeOpponentOpeningTreeArtifact(artifact, {
  treeDir = DEFAULT_OPENING_TREE_DIR
} = {}) {
  mkdirSync(treeDir, { recursive: true });
  const path = openingTreePathFor({
    treeDir,
    opponent: artifact.normalizedOpponent || artifact.opponent,
    opponentSide: artifact.opponentSide,
    maxPly: artifact.maxPly
  });
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { path, artifact };
}

export function loadOpponentOpeningTreeArtifact({
  treeDir = DEFAULT_OPENING_TREE_DIR,
  opponent,
  opponentSide = 'w',
  maxPly = 40
} = {}) {
  const path = openingTreePathFor({ treeDir, opponent, opponentSide, maxPly });
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadOrBuildOpponentOpeningTree({
  store = null,
  treeDir = DEFAULT_OPENING_TREE_DIR,
  opponent,
  opponentSide = 'w',
  maxPly = 40
} = {}) {
  const path = openingTreePathFor({ treeDir, opponent, opponentSide, maxPly });
  const cached = loadOpponentOpeningTreeArtifact({ treeDir, opponent, opponentSide, maxPly });
  const cacheMatchesStore = !store?.updatedAt || cached?.storeUpdatedAt === store.updatedAt;
  const cacheMatchesNameRules = cached?.nameMatchVersion === PLAYER_NAME_MATCH_VERSION;
  if (cached && cacheMatchesStore && cacheMatchesNameRules) {
    return { fromCache: true, path, artifact: cached };
  }
  if (!store) {
    throw new Error(`Opening tree cache not found for ${opponent || 'unknown player'}`);
  }

  const artifact = buildOpponentOpeningTreeArtifact(store, { opponent, opponentSide, maxPly });
  writeOpponentOpeningTreeArtifact(artifact, { treeDir });
  return { fromCache: false, path, artifact };
}

export function resetOpeningTreeCache({
  treeDir = DEFAULT_OPENING_TREE_DIR
} = {}) {
  rmSync(treeDir, { recursive: true, force: true });
}

function main(argv) {
  const command = argv[2] || 'build';
  if (command !== 'build') {
    console.error('Usage: node tools/player-prep/opening-tree.mjs build <opponent> [w|b] [maxPly]');
    process.exitCode = 1;
    return;
  }

  const opponent = argv[3];
  if (!opponent) {
    console.error('Usage: node tools/player-prep/opening-tree.mjs build <opponent> [w|b] [maxPly]');
    process.exitCode = 1;
    return;
  }

  const opponentSide = normalizedSide(argv[4]);
  const maxPly = normalizedMaxPly(Number(argv[5]) || 40);
  let result = null;
  try {
    result = loadOrBuildOpponentOpeningTree({ opponent, opponentSide, maxPly });
  } catch (error) {
    if (!/cache not found/i.test(error.message || '')) throw error;
    result = loadOrBuildOpponentOpeningTree({
      store: loadOfflineStore(),
      opponent,
      opponentSide,
      maxPly
    });
  }
  console.log(JSON.stringify({
    path: result.path,
    fromCache: result.fromCache,
    opponent: result.artifact.opponent,
    opponentSide: result.artifact.opponentSide,
    maxPly: result.artifact.maxPly,
    sampleGames: result.artifact.sampleGames,
    nodes: result.artifact.nodes.length
  }, null, 2));
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) : '';
if (invokedPath && process.argv[1] === invokedPath) {
  main(process.argv);
}
