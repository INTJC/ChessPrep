import { collectCompactGameBatch } from './compact-games.mjs';
import { buildOpponentOpeningTree } from './prep-report.mjs';
import { serializeOpponentOpeningTree } from './opening-tree.mjs';

function normalizedSide(side) {
  return side === 'b' ? 'b' : 'w';
}

function normalizedMaxPly(maxPly) {
  const value = Number(maxPly);
  return Number.isInteger(value) && value > 0 ? value : 40;
}

export function buildUploadedOpponentStore(pgn, {
  sourceName = 'uploaded-opponent.pgn',
  minYear = -1,
  minElo = -1
} = {}) {
  const batch = collectCompactGameBatch(pgn, { sourceName, minYear, minElo });
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stringTable: batch.stringTable,
    games: batch.games,
    sources: [{
      sourceName,
      importedAt: new Date().toISOString(),
      games: batch.games.length,
      duplicateGames: 0,
      skippedByFilter: batch.skippedByFilter || 0,
      skippedByError: batch.errors.length
    }],
    moveBuffer: batch.moveBuffer,
    uploadSummary: {
      sourceName,
      games: batch.games.length,
      skippedByFilter: batch.skippedByFilter || 0,
      skippedByError: batch.errors.length,
      errors: batch.errors
    }
  };
}

export function buildUploadedOpponentOpeningTreeArtifact(pgn, {
  opponent = '',
  opponentSide = 'w',
  maxPly = 40,
  sourceName = 'uploaded-opponent.pgn'
} = {}) {
  const store = buildUploadedOpponentStore(pgn, { sourceName, minYear: -1, minElo: -1 });
  const tree = buildOpponentOpeningTree(store, {
    opponent,
    opponentSide: normalizedSide(opponentSide),
    maxPly: normalizedMaxPly(maxPly)
  });
  const artifact = serializeOpponentOpeningTree(
    {
      ...tree,
      maxPly: normalizedMaxPly(maxPly)
    },
    {
      createdAt: store.updatedAt,
      storeUpdatedAt: null
    }
  );
  return {
    artifact,
    store,
    summary: store.uploadSummary
  };
}
