import test from 'node:test';
import assert from 'node:assert/strict';

test('opening prior builder aggregates common early moves by target profile', async () => {
  const { collectOpeningPriorsFromPgnTexts } = await import('../tools/engine-calibration/build-opening-priors.mjs');
  const makeGame = ({ event = 'Classical', whiteElo = 2410, blackElo = 2405, moves }) => [
    `[Event "${event}"]`,
    '[Site "Local"]',
    '[Date "2026.06.05"]',
    '[White "White Player"]',
    '[Black "Black Player"]',
    '[Result "*"]',
    `[WhiteElo "${whiteElo}"]`,
    `[BlackElo "${blackElo}"]`,
    '',
    moves
  ].join('\n');

  const result = collectOpeningPriorsFromPgnTexts([
    { text: makeGame({ moves: '1. e4 e5 2. Nf3 Nc6 *' }), sourceFile: 'one.pgn' },
    { text: makeGame({ moves: '1. e4 c5 2. Nf3 d6 *' }), sourceFile: 'two.pgn' },
    { text: makeGame({ moves: '1. d4 d5 2. c4 e6 *' }), sourceFile: 'three.pgn' },
    { text: makeGame({ event: 'Blitz Match', moves: '1. g4 d5 2. Bg2 *' }), sourceFile: 'fast.pgn' }
  ], {
    minPly: 1,
    maxPly: 4,
    minGames: 1,
    excludeFastEvents: true
  });

  const start = result.positions['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'];
  assert.equal(start.profiles['human-2400'].games, 3);
  assert.deepEqual(start.profiles['human-2400'].moves.slice(0, 2), [
    { move: 'e2e4', count: 2, frequency: 0.6667 },
    { move: 'd2d4', count: 1, frequency: 0.3333 }
  ]);
  assert.equal(start.profiles['human-2400'].moves.some((move) => move.move === 'g2g4'), false);
  assert.equal(result.source.gameCount, 4);
  assert.equal(result.source.skippedFastEventCount, 1);
});

test('real-game comparison applies the same opening prior override used by sparring', async () => {
  const { pickProfileMoveWithOpeningPrior } = await import('../tools/engine-calibration/compare-profiles-to-real-games.mjs');
  const stockfishLines = [
    { move: 'd2d4', scoreCp: 40 },
    { move: 'e2e4', scoreCp: 38 },
    { move: 'c2c4', scoreCp: 15 }
  ];
  const priors = {
    positions: {
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': {
        profiles: {
          'human-2400': {
            games: 90,
            moves: [
              { move: 'e2e4', count: 55 },
              { move: 'd2d4', count: 35 }
            ]
          }
        }
      }
    }
  };

  assert.deepEqual(
    pickProfileMoveWithOpeningPrior({
      profileId: 'human-2400',
      sample: {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
        ply: 1
      },
      stockfishLines,
      picked: {
        engine: 'maia3',
        rawMove: 'c2c4',
        move: 'c2c4',
        filtered: false
      },
      priors
    }),
    {
      engine: 'maia3',
      rawMove: 'c2c4',
      move: 'e2e4',
      filtered: false,
      openingPrior: {
        move: 'e2e4',
        source: 'opening-prior',
        games: 90,
        count: 55,
        lossCp: 2
      }
    }
  );
});
