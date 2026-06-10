import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectCompactGameBatch,
  decodeMoveBuffer,
  encodeMoveList,
  packMove,
  squareCode,
  summarizeCompactBatch
} from '../tools/player-prep/compact-games.mjs';

const samplePgn = `[Event "Classical One"]
[Site "Wijk aan Zee"]
[Date "2024.01.15"]
[Round "1"]
[White "Alpha Player"]
[Black "Beta Player"]
[Result "1-0"]
[WhiteElo "2750"]
[BlackElo "2680"]
[ECO "C50"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0

[Event "Classical Two"]
[Site "Berlin"]
[Date "2024.02.20"]
[Round "2"]
[White "Beta Player"]
[Black "Alpha Player"]
[Result "1/2-1/2"]
[WhiteElo "2680"]
[BlackElo "2750"]
[ECO "D02"]

1. d4 d5 2. Nf3 Nf6 1/2-1/2`;

test('packMove stores UCI moves in two bytes and decodes them losslessly', () => {
  assert.equal(squareCode('a1'), 0);
  assert.equal(squareCode('h8'), 63);
  assert.equal(packMove('e2e4'), 1804);
  assert.equal(packMove('e7e8q'), 7988);

  const moves = ['e2e4', 'e7e5', 'g1f3', 'e7e8q', 'a7a8n'];
  const buffer = encodeMoveList(moves);
  assert.equal(buffer.length, moves.length * 2);
  assert.deepEqual(decodeMoveBuffer(buffer), moves);
});

test('collectCompactGameBatch dictionaries repeated metadata and stores move bytes', () => {
  const batch = collectCompactGameBatch(samplePgn);

  assert.equal(batch.games.length, 2);
  assert.equal(batch.errors.length, 0);
  assert.equal(batch.stringTable[batch.games[0].white], 'Alpha Player');
  assert.equal(batch.stringTable[batch.games[1].black], 'Alpha Player');
  assert.equal(batch.games[0].white, batch.games[1].black);
  assert.deepEqual(decodeMoveBuffer(batch.moveBuffer, batch.games[0].moveOffset, batch.games[0].moveCount), [
    'e2e4',
    'e7e5',
    'g1f3',
    'b8c6',
    'f1c4',
    'f8c5'
  ]);
});

test('summarizeCompactBatch reports storage reduction against source PGN bytes', () => {
  const largerPgn = `${samplePgn}\n\n`.repeat(20);
  const batch = collectCompactGameBatch(largerPgn);
  const summary = summarizeCompactBatch(batch, Buffer.byteLength(largerPgn, 'utf8'));

  assert.equal(summary.games, 40);
  assert.equal(summary.moves, 200);
  assert.ok(summary.compactBytes > 0);
  assert.ok(summary.sourceBytes > summary.compactBytes);
  assert.ok(summary.ratio < 1);
});

test('collectCompactGameBatch records parse errors without stopping the batch', () => {
  const pgn = `${samplePgn}\n\n[Event "Broken"]\n\n1. e4 e5 2. IllegalMove *`;
  const batch = collectCompactGameBatch(pgn);

  assert.equal(batch.games.length, 2);
  assert.equal(batch.errors.length, 1);
  assert.match(batch.errors[0].message, /Illegal|No legal move|Cannot parse/i);
});

test('collectCompactGameBatch filters offline prep games to post-2010 and both Elo above 2000', () => {
  const pgn = `[Event "Too Old"]
[Date "2009.12.31"]
[White "Old White"]
[Black "Old Black"]
[WhiteElo "2600"]
[BlackElo "2600"]
[Result "1-0"]

1. e4 e5 1-0

[Event "Low Rated"]
[Date "2024.01.01"]
[White "Low White"]
[Black "High Black"]
[WhiteElo "2000"]
[BlackElo "2600"]
[Result "0-1"]

1. d4 d5 0-1

[Event "Eligible"]
[Date "2024.01.02"]
[White "Strong White"]
[Black "Strong Black"]
[WhiteElo "2001"]
[BlackElo "2600"]
[Result "1/2-1/2"]

1. Nf3 Nf6 1/2-1/2`;

  const batch = collectCompactGameBatch(pgn);

  assert.equal(batch.games.length, 1);
  assert.equal(batch.skippedByFilter, 2);
  assert.equal(batch.stringTable[batch.games[0].event], 'Eligible');
  assert.deepEqual(decodeMoveBuffer(batch.moveBuffer, batch.games[0].moveOffset, batch.games[0].moveCount), ['g1f3', 'g8f6']);
});
