import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrepReport } from '../tools/player-prep/prep-report.mjs';
import { buildUploadedOpponentOpeningTreeArtifact } from '../tools/player-prep/uploaded-pgn-tree.mjs';

const opponentPgn = `[Event "Uploaded White"]
[Date "2024.01.01"]
[White "Target GM"]
[Black "Other GM"]
[Result "1-0"]

1. e4 c5 2. Nf3 d6 1-0

[Event "Uploaded French"]
[Date "2024.01.02"]
[White "Target GM"]
[Black "Other GM"]
[Result "1/2-1/2"]

1. e4 e6 2. d4 d5 1/2-1/2

[Event "Uploaded Black"]
[Date "2024.01.03"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]

1. d4 Nf6 2. c4 e6 0-1`;

test('uploaded opponent PGN builds a reusable opening tree without offline database filters', () => {
  const uploaded = buildUploadedOpponentOpeningTreeArtifact(opponentPgn, {
    opponent: 'Target GM',
    opponentSide: 'w',
    maxPly: 6
  });

  assert.equal(uploaded.artifact.sampleGames, 2);
  assert.equal(uploaded.artifact.opponentSide, 'w');
  assert.equal(uploaded.summary.games, 3);
  assert.deepEqual(uploaded.artifact.root.moves.map((move) => move.uci), ['e2e4']);
});

test('uploaded opponent tree keeps existing prep report classifications', () => {
  const uploaded = buildUploadedOpponentOpeningTreeArtifact(opponentPgn, {
    opponent: 'Target GM',
    opponentSide: 'w',
    maxPly: 6
  });

  const report = buildPrepReport({
    opponentTree: uploaded.artifact,
    opponent: 'Target GM',
    ourSide: 'b',
    prepPgn: '[Event "Prep"]\n[Result "*"]\n\n1. e4 c5 *\n\n[Event "Root"]\n[Result "*"]\n\n1. d4 d5 *',
    maxPly: 6
  });

  assert.equal(report.sampleGames, 2);
  assert.ok(report.gaps.find((item) => item.uci === 'g1f3'));
  assert.ok(report.unseen.find((item) => item.uci === 'd2d4'));
});

test('blank opponent name analyzes all uploaded games for the selected opponent side', () => {
  const uploaded = buildUploadedOpponentOpeningTreeArtifact(opponentPgn, {
    opponent: '',
    opponentSide: 'b',
    maxPly: 4
  });

  assert.equal(uploaded.artifact.sampleGames, 3);
  assert.deepEqual(uploaded.artifact.root.moves.map((move) => move.uci).sort(), ['d2d4', 'e2e4']);
});
