import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { playLegalUciMove } from '../app.js';

const TEST_ENDGAME_FEN = '7k/5br1/7p/8/8/P7/1RBP4/K7 w - -';
const TEST_ENDGAME_CYCLE = ['b2b4', 'g7g5', 'b4b2', 'g5g7'];

function formatClock(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function eliteEndgameMoves({ plies = 52, withClock = true } = {}) {
  let fen = TEST_ENDGAME_FEN;
  const tokens = [];
  for (let index = 0; index < plies; index += 1) {
    const uci = TEST_ENDGAME_CYCLE[index % TEST_ENDGAME_CYCLE.length];
    const played = playLegalUciMove(fen, uci);
    const prefix = index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : '';
    const evalValue = (2.0 + index * 0.04).toFixed(2);
    const clock = formatClock(2700 - index * 30);
    const comment = withClock
      ? ` { [%eval ${evalValue}] [%clk ${clock}] }`
      : ` { [%eval ${evalValue}] }`;
    tokens.push(`${prefix}${played.move.san}${comment}`);
    fen = played.nextFen;
  }
  return `${tokens.join(' ')} *`;
}

function eliteEndgamePgn(extraHeaders = [], options = {}) {
  return [
    '[Event "FIDE Candidates 2026"]',
    '[Site "Local"]',
    '[Date "2026.06.04"]',
    '[Round "?"]',
    '[White "GM Alpha"]',
    '[Black "GM Beta"]',
    '[Result "*"]',
    '[SetUp "1"]',
    `[FEN "${TEST_ENDGAME_FEN} 0 1"]`,
    '[TimeControl "40/7200:1800+30"]',
    '[Variant "Standard"]',
    ...extraHeaders,
    '',
    eliteEndgameMoves(options)
  ].join('\n');
}

test('listRawPgnFiles recursively finds PGN files and ignores archives', async () => {
  const { listRawPgnFiles } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');
  const root = await mkdtemp(join(tmpdir(), 'endgame-raw-'));
  const nested = join(root, 'pgnmentor-carlsen');
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(root, 'root.pgn'), '[Event "Root"]\n\n1. e4 e5 1/2-1/2\n');
  writeFileSync(join(nested, 'Carlsen.pgn'), '[Event "Nested"]\n\n1. d4 d5 1/2-1/2\n');
  writeFileSync(join(root, 'Carlsen.zip'), 'not a pgn');

  const files = listRawPgnFiles(root).map((file) => file.replaceAll('\\', '/')).sort();

  assert.equal(files.length, 2);
  assert.ok(files.some((file) => file.endsWith('/root.pgn')));
  assert.ok(files.some((file) => file.endsWith('/pgnmentor-carlsen/Carlsen.pgn')));
  assert.ok(!files.some((file) => file.endsWith('.zip')));
});

test('scanGame candidate ids include the source PGN file stem', async () => {
  const { scanGame } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');
  const game = eliteEndgamePgn();

  const first = scanGame(game, join('raw', 'alpha.pgn'), 1, 'pgnmentor-files').candidates[0];
  const second = scanGame(game, join('raw', 'beta.pgn'), 1, 'pgnmentor-files').candidates[0];

  assert.notEqual(first.id, second.id);
  assert.match(first.id, /alpha/);
  assert.match(second.id, /beta/);
});

test('scanGame keeps only the strongest candidate per game by default', async () => {
  const { scanGame } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');
  const game = eliteEndgamePgn();

  const result = scanGame(game, join('raw', 'alpha.pgn'), 1, 'pgnmentor-files');
  const expanded = scanGame(game, join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', { maxCandidatesPerGame: 10 });
  const highestScore = Math.max(...expanded.candidates.map((candidate) => candidate.complexityScore));

  assert.equal(result.candidates.length, 1);
  assert.ok(expanded.candidates.length > result.candidates.length);
  assert.equal(result.candidates[0].complexityScore, highestScore);
});

test('scanGame records the real PGN continuation for candidate source lines', async () => {
  const { scanGame } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');
  const { replayPgnGame } = await import('../app.js');
  const game = eliteEndgamePgn();


  const candidate = scanGame(game, join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', {
    sourceLineLength: 8
  }).candidates[0];
  const replay = replayPgnGame(game);
  const expected = replay.moves.slice(candidate.startPly, candidate.startPly + 8);

  assert.equal(candidate.sourceLine.length, 8);
  assert.equal(candidate.sourceLine[0].uci, candidate.suggestedFirstMove);
  assert.deepEqual(candidate.sourceLine.map((move) => move.uci), expected.map((move) => move.uci));
  assert.deepEqual(candidate.sourceLine.map((move) => move.ply), expected.map((move) => move.ply));
});

test('parseArgs accepts a per-file game limit for balanced scans', async () => {
  const { parseArgs } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');

  assert.equal(parseArgs(['node', 'scan', '--max-games-per-file', '75']).maxGamesPerFile, 75);
  assert.equal(parseArgs(['node', 'scan', '--max-candidates-per-game', '2']).maxCandidatesPerGame, 2);
});

test('parseArgs enables strict elite PGN scan gates', async () => {
  const { parseArgs } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');

  const args = parseArgs(['node', 'scan', '--strict-elite']);

  assert.equal(args.minComplexity, 9);
  assert.equal(args.sourceLineLength, 10);
  assert.equal(args.minBothElo, 2650);
  assert.equal(args.preferBothElo, 2700);
  assert.equal(args.requireTimeControl, false);
  assert.equal(args.requireClassicalEvidence, true);
  assert.equal(args.preferResultTargets, true);
  assert.match(args.classicalEventPattern, /Tata Steel/i);
  assert.equal(args.requireClockAtStart, false);
  assert.equal(args.minStartClockSeconds, 0);
  assert.match(args.rejectEventPattern, /rapid/i);
  assert.equal(args.requireEventPattern, null);
});

test('scanGame applies 2650+ classical Elo and event gates before emitting PGN candidates', async () => {
  const { scanGame } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');
  const game = (extraHeaders = [], pgnOptions = {}) => eliteEndgamePgn(extraHeaders, pgnOptions);
  const options = {
    minBothElo: 2650,
    minComplexity: 7,
    sourceLineLength: 4,
    requireClassicalEvidence: true,
    classicalEventPattern: 'Candidates|Tata Steel',
    rejectEventPattern: 'rapid|blitz'
  };
  const withoutTimeControl = game(['[Event "Local Classical Invitational"]', '[WhiteElo "2800"]', '[BlackElo "2700"]']).replace(/\n\[TimeControl "[^"]+"\]/, '');
  const classicalWithoutTimeControl = game(['[Event "Tata Steel Masters"]', '[WhiteElo "2800"]', '[BlackElo "2700"]']).replace(/\n\[TimeControl "[^"]+"\]/, '');

  assert.equal(scanGame(game(['[WhiteElo "2700"]', '[BlackElo "2649"]']), join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', options).candidates.length, 0);
  assert.equal(scanGame(game(['[Event "Rapid Match"]', '[WhiteElo "2800"]', '[BlackElo "2700"]']), join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', options).candidates.length, 0);
  assert.equal(scanGame(withoutTimeControl, join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', options).candidates.length, 0);
  assert.ok(scanGame(classicalWithoutTimeControl, join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', options).candidates.length > 0);
  assert.ok(scanGame(game(['[WhiteElo "2800"]', '[BlackElo "2700"]']), join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', options).candidates.length > 0);
  assert.ok(scanGame(game(['[WhiteElo "2800"]', '[BlackElo "2700"]'], { withClock: false }), join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', options).candidates.length > 0);
  assert.equal(
    scanGame(game(['[Event "Classical Invitational"]', '[WhiteElo "2800"]', '[BlackElo "2700"]']), join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', { ...options, requireEventPattern: 'Candidates|Tata Steel' }).candidates.length,
    0
  );
  assert.ok(
    scanGame(game(['[Event "FIDE Candidates 2026"]', '[WhiteElo "2800"]', '[BlackElo "2700"]']), join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', { ...options, requireEventPattern: 'Candidates|Tata Steel' }).candidates.length > 0
  );

  const accepted = scanGame(game(['[WhiteElo "2800"]', '[BlackElo "2700"]']), join('raw', 'alpha.pgn'), 1, 'pgnmentor-files', options).candidates[0];
  assert.equal(accepted.source.whiteElo, 2800);
  assert.equal(accepted.source.blackElo, 2700);
  assert.equal(accepted.source.timeControl, '40/7200:1800+30');
  assert.equal(accepted.source.variant, 'Standard');
  assert.ok(Number.isFinite(accepted.audit.startEvalCp));
});

test('scanGame rejects positions outside the simplified endgame material boundary', async () => {
  const { classifyPosition, isEndgameMaterial } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');

  assert.equal(isEndgameMaterial('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'), false);
  assert.equal(isEndgameMaterial('6k1/8/8/8/1q6/8/8/5BK1 w - -'), true);
  assert.equal(classifyPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -').score, 0);
});

test('shortlistCandidates removes low-score and duplicate raw positions with file caps', async () => {
  const { shortlistCandidates } = await import('../tools/endgame-expansion/shortlist-candidates.mjs');
  const base = {
    category: 'rook-activity',
    sourceId: 'pgnmentor-files',
    sourceGameId: 'Alpha.pgn|Event|2026.01.01|A|B|1',
    source: { event: 'Event', date: '2026.01.01' },
    fen: '8/8/8/8/8/8/R7/K6k w - -',
    suggestedFirstMove: 'a2a8',
    complexityScore: 8,
    startPly: 70
  };
  const report = {
    candidates: [
      { ...base, id: 'keep-high', complexityScore: 10 },
      { ...base, id: 'drop-duplicate', complexityScore: 9 },
      { ...base, id: 'drop-low', fen: '8/8/8/8/8/8/1R6/K6k w - -', suggestedFirstMove: 'b2b8', complexityScore: 7 },
      { ...base, id: 'drop-file-cap', fen: '8/8/8/8/8/8/2R5/K6k w - -', suggestedFirstMove: 'c2c8', complexityScore: 9 },
      { ...base, id: 'keep-other-file', sourceGameId: 'Beta.pgn|Event|2026.01.01|A|B|1', fen: '8/8/8/8/8/8/3R4/K6k w - -', suggestedFirstMove: 'd2d8', complexityScore: 9 }
    ]
  };

  const result = shortlistCandidates(report, { minScore: 8, perFileCap: 1, target: 10 });

  assert.deepEqual(result.shortlist.map((candidate) => candidate.id), ['keep-high', 'keep-other-file']);
  assert.equal(result.rejections.lowScore, 1);
  assert.equal(result.rejections.duplicateFenMove, 1);
  assert.equal(result.rejections.perFileCap, 1);
});

test('shortlistCandidates keeps only one strict candidate from the same source game by default', async () => {
  const { shortlistCandidates } = await import('../tools/endgame-expansion/shortlist-candidates.mjs');
  const base = {
    category: 'queen-endgames',
    sourceId: 'pgnmentor-files',
    sourceGameId: 'Alpha.pgn|Elite Event|2026.01.01|A|B|1',
    source: { event: 'Elite Event', date: '2026.01.01' },
    fen: '8/8/8/8/8/8/R7/K6k w - -',
    suggestedFirstMove: 'a2a8',
    complexityScore: 10
  };

  const result = shortlistCandidates({
    candidates: [
      { ...base, id: 'same-game-first', startPly: 80 },
      { ...base, id: 'same-game-later', fen: '8/8/8/8/8/8/1R6/K6k w - -', suggestedFirstMove: 'b2b8', startPly: 82 },
      { ...base, id: 'other-game', sourceGameId: 'Beta.pgn|Elite Event|2026.01.01|C|D|1', fen: '8/8/8/8/8/8/2R5/K6k w - -', suggestedFirstMove: 'c2c8', startPly: 80 }
    ]
  }, { minScore: 9, target: 10 });

  assert.deepEqual(result.shortlist.map((candidate) => candidate.id), ['same-game-first', 'other-game']);
  assert.equal(result.rejections.perSourceGameCap, 1);
});

test('shortlistCandidates can reserve a minimum number per category', async () => {
  const { shortlistCandidates } = await import('../tools/endgame-expansion/shortlist-candidates.mjs');
  const fens = {
    'queen-1': '8/8/8/8/8/8/R7/K6k w - -',
    'queen-2': '8/8/8/8/8/8/1R6/K6k w - -',
    'rook-1': '8/8/8/8/8/8/2R5/K6k w - -',
    'single-1': '8/8/8/8/8/8/3R4/K6k w - -'
  };
  const moves = {
    'queen-1': 'a2a8',
    'queen-2': 'b2b8',
    'rook-1': 'c2c8',
    'single-1': 'd2d8'
  };
  const makeCandidate = (id, category, score) => ({
    id,
    category,
    sourceId: 'pgnmentor-files',
    sourceGameId: `${id}.pgn|Event|2026.01.01|A|B|1`,
    source: { event: 'Event', date: '2026.01.01' },
    fen: fens[id],
    suggestedFirstMove: moves[id],
    complexityScore: score,
    startPly: 70
  });
  const report = {
    candidates: [
      makeCandidate('queen-1', 'queen-endgames', 10),
      makeCandidate('queen-2', 'queen-endgames', 10),
      makeCandidate('rook-1', 'rook-activity', 8),
      makeCandidate('single-1', 'single-rook-defense', 8)
    ]
  };

  const result = shortlistCandidates(report, { minScore: 8, target: 3, perFileCap: 10, minPerCategory: 1 });

  assert.deepEqual(new Set(result.shortlist.map((candidate) => candidate.category)), new Set([
    'queen-endgames',
    'rook-activity',
    'single-rook-defense'
  ]));
});

test('classifyPosition prioritizes queen and opposite-bishop themes over generic rook labels', async () => {
  const { classifyPosition } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');

  assert.equal(
    classifyPosition('6k1/8/8/8/1q6/8/8/5BK1 w - -').category,
    'queen-minor-endgames'
  );
  assert.equal(
    classifyPosition('6k1/8/8/8/1q6/8/8/5NK1 w - -').category,
    'queen-minor-endgames'
  );
  assert.equal(
    classifyPosition('8/8/2b2k2/3p1p2/3P1P2/2B2K2/8/8 w - -').category,
    'opposite-bishop-initiative'
  );
});

test('classifyPosition separates underfilled non-queen endgame themes', async () => {
  const { classifyPosition } = await import('../tools/endgame-expansion/scan-pgn-endgames.mjs');

  assert.equal(
    classifyPosition('8/8/5k2/2p3p1/2R1B3/1P3P2/5K2/6r1 w - -').category,
    'rook-minor-activity'
  );
  assert.equal(
    classifyPosition('8/3k4/3P4/5p2/4pP2/4K3/8/8 w - -').category,
    'pawn-race-transitions'
  );
  assert.equal(
    classifyPosition('8/8/4p3/1p1k1p2/1P1P1P2/3K4/8/8 w - -').category,
    'king-activity'
  );
});

test('buildCandidateContext finds source game and returns nearby move window', async () => {
  const { buildCandidateContext } = await import('../tools/endgame-expansion/build-candidate-context.mjs');
  const gameText = [
    '[Event "Tiny"]',
    '[Site "Local"]',
    '[Date "2026.06.03"]',
    '[Round "?"]',
    '[White "White"]',
    '[Black "Black"]',
    '[Result "*"]',
    '',
    '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *'
  ].join('\n');
  const candidate = {
    id: 'tiny-context',
    category: 'rook-minor-activity',
    sourceGameId: 'tiny.pgn|Tiny|2026.06.03|White|Black|1',
    startPly: 5,
    suggestedFirstMove: 'f1b5'
  };

  const context = buildCandidateContext(candidate, gameText, 'tiny.pgn', 1, { before: 2, after: 2 });

  assert.equal(context.id, 'tiny-context');
  assert.equal(context.category, 'rook-minor-activity');
  assert.equal(context.headers.Event, 'Tiny');
  assert.equal(context.focusMove.uci, 'f1b5');
  assert.deepEqual(context.window.map((move) => move.san), ['Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4']);
});

test('buildCandidateContext preserves the real source continuation line', async () => {
  const { buildCandidateContext } = await import('../tools/endgame-expansion/build-candidate-context.mjs');
  const gameText = [
    '[Event "Line"]',
    '[Site "Local"]',
    '[Date "2026.06.04"]',
    '[Round "?"]',
    '[White "White"]',
    '[Black "Black"]',
    '[Result "*"]',
    '',
    '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *'
  ].join('\n');
  const candidate = {
    id: 'line-context',
    category: 'rook-minor-activity',
    sourceGameId: 'line.pgn|Line|2026.06.04|White|Black|1',
    startPly: 4,
    suggestedFirstMove: 'g1f3',
    sourceLine: [
      { ply: 5, san: 'Nf3', uci: 'g1f3' },
      { ply: 6, san: 'Nc6', uci: 'b8c6' },
      { ply: 7, san: 'Bb5', uci: 'f1b5' },
      { ply: 8, san: 'a6', uci: 'a7a6' }
    ]
  };

  const context = buildCandidateContext(candidate, gameText, 'line.pgn', 1, { before: 1, after: 2 });

  assert.deepEqual(context.sourceLine.map((move) => move.uci), ['g1f3', 'b8c6', 'f1b5', 'a7a6']);
});

test('buildContexts can start from an offset into a shortlist batch', async () => {
  const { buildContexts } = await import('../tools/endgame-expansion/build-candidate-context.mjs');
  const root = await mkdtemp(join(tmpdir(), 'endgame-context-'));
  const gameText = [
    '[Event "Offset"]',
    '[Site "Local"]',
    '[Date "2026.06.05"]',
    '[Round "?"]',
    '[White "White"]',
    '[Black "Black"]',
    '[Result "*"]',
    '',
    '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'
  ].join('\n');
  writeFileSync(join(root, 'offset.pgn'), gameText);
  const shortlist = {
    shortlist: [
      { id: 'first', sourceGameId: 'offset.pgn|Offset|2026.06.05|White|Black|1', startPly: 0, suggestedFirstMove: 'e2e4' },
      { id: 'second', sourceGameId: 'offset.pgn|Offset|2026.06.05|White|Black|1', startPly: 2, suggestedFirstMove: 'g1f3' }
    ]
  };

  const result = buildContexts(shortlist, root, { offset: 1, limit: 1 });

  assert.equal(result.offset, 1);
  assert.deepEqual(result.contexts.map((context) => context.id), ['second']);
});

test('sourceGameLookupKey extracts file and game number from sourceGameId', async () => {
  const { sourceGameLookupKey } = await import('../tools/endgame-expansion/build-candidate-context.mjs');

  assert.deepEqual(sourceGameLookupKey('Carlsen.pgn|Event|2020.01.01|White|Black|27'), {
    fileName: 'Carlsen.pgn',
    gameIndex: 27
  });
});

test('parseStockfishAnalysis sorts multipv lines by engine preference', async () => {
  const { parseStockfishAnalysis } = await import('../tools/endgame-expansion/evaluate-candidates.mjs');
  const output = [
    'info depth 12 multipv 2 score cp 20 pv a2a4 h7h5',
    'info depth 12 multipv 1 score cp 55 pv b2b4 h7h5',
    'bestmove b2b4'
  ].join('\n');

  assert.deepEqual(parseStockfishAnalysis(output).map((line) => [line.move, line.scoreCp]), [
    ['b2b4', 55],
    ['a2a4', 20]
  ]);
});

test('parseStockfishAnalysis keeps only the deepest line for each multipv slot', async () => {
  const { parseStockfishAnalysis } = await import('../tools/endgame-expansion/evaluate-candidates.mjs');
  const output = [
    'info depth 4 multipv 1 score cp 10 pv a2a4',
    'info depth 8 multipv 1 score cp 35 pv b2b4',
    'info depth 8 multipv 2 score cp 20 pv c2c4',
    'bestmove b2b4'
  ].join('\n');

  assert.deepEqual(parseStockfishAnalysis(output).map((line) => [line.multipv, line.move, line.scoreCp]), [
    [1, 'b2b4', 35],
    [2, 'c2c4', 20]
  ]);
});

test('buildReviewRows classifies source move ranks and evaluation gaps', async () => {
  const { buildReviewRows } = await import('../tools/endgame-expansion/build-review-sheet.mjs');
  const contexts = {
    contexts: [
      { id: 'keep', headers: { Event: 'A', White: 'W', Black: 'B' }, focusMove: { san: 'Ra1' } },
      { id: 'review', headers: { Event: 'B', White: 'W', Black: 'B' }, focusMove: { san: 'Ra2' } },
      { id: 'reject', headers: { Event: 'C', White: 'W', Black: 'B' }, focusMove: { san: 'Ra3' } }
    ]
  };
  const evaluations = {
    evaluations: [
      { id: 'keep', suggestedFirstMove: 'a1a2', suggestedMoveRank: 1, lines: [{ move: 'a1a2', scoreCp: 10 }] },
      { id: 'review', suggestedFirstMove: 'a1a3', suggestedMoveRank: 2, lines: [{ move: 'a1a2', scoreCp: 30 }, { move: 'a1a3', scoreCp: 20 }] },
      { id: 'reject', suggestedFirstMove: 'a1a4', suggestedMoveRank: null, lines: [{ move: 'a1a2', scoreCp: 100 }] }
    ]
  };

  const result = buildReviewRows(evaluations, contexts);

  assert.deepEqual(result.rows.map((row) => row.initialDecision), [
    'keep-for-original-analysis',
    'human-review-multiple-plans',
    'reject-or-deep-review'
  ]);
  assert.deepEqual(result.counts, {
    keepForOriginalAnalysis: 1,
    humanReviewMultiplePlans: 1,
    rejectOrDeepReview: 1
  });
});

test('createDraftLessons builds non-importable original-analysis placeholders from keep rows', async () => {
  const { createDraftLessons } = await import('../tools/endgame-expansion/create-draft-lessons.mjs');
  const review = {
    rows: [
      {
        id: 'candidate-1',
        initialDecision: 'keep-for-original-analysis',
        event: 'Event',
        players: 'White - Black',
        suggestedFirstMove: 'a2a4',
        sourceMoveSan: 'a4',
        engineRank: 1,
        gapCp: 0
      },
      {
        id: 'candidate-2',
        initialDecision: 'human-review-multiple-plans',
        suggestedFirstMove: 'b2b4'
      }
    ]
  };
  const contexts = {
    contexts: [
      {
        id: 'candidate-1',
        category: 'rook-minor-activity',
        candidateFen: '8/8/8/8/8/8/P7/K6k w - -',
        suggestedFirstMove: 'a2a4',
        sourceGameId: 'test',
        headers: { Event: 'Event', White: 'White', Black: 'Black', Date: '2026.06.03' },
        window: [{ ply: 1, san: 'a4', uci: 'a2a4' }]
      }
    ]
  };
  const evals = {
    evaluations: [
      { id: 'candidate-1', lines: [{ move: 'a2a4', scoreCp: 10, pv: ['a2a4'] }] }
    ]
  };

  const result = createDraftLessons(review, contexts, evals);

  assert.equal(result.drafts.length, 1);
  assert.equal(result.drafts[0].id, 'draft-candidate-1');
  assert.equal(result.drafts[0].category, 'rook-minor-activity');
  assert.equal(result.drafts[0].importStatus, 'draft-not-ready');
  assert.equal(result.drafts[0].teaching.principle, 'TODO_ORIGINAL_ANALYSIS');
});

test('createDraftLessons uses source PGN continuation as the draft main line', async () => {
  const { createDraftLessons } = await import('../tools/endgame-expansion/create-draft-lessons.mjs');
  const review = {
    rows: [
      {
        id: 'candidate-source-line',
        initialDecision: 'keep-for-original-analysis',
        suggestedFirstMove: 'a2a4',
        engineRank: 2,
        gapCp: 12
      }
    ]
  };
  const contexts = {
    contexts: [
      {
        id: 'candidate-source-line',
        category: 'rook-minor-activity',
        candidateFen: '8/8/8/8/8/8/P7/K6k w - -',
        suggestedFirstMove: 'a2a4',
        sourceGameId: 'test',
        headers: { Event: 'Event', White: 'White', Black: 'Black', Date: '2026.06.04' },
        sourceLine: [
          { ply: 1, san: 'a4', uci: 'a2a4' },
          { ply: 2, san: 'Kh2', uci: 'h1h2' },
          { ply: 3, san: 'a5', uci: 'a4a5' },
          { ply: 4, san: 'Kh3', uci: 'h2h3' }
        ],
        window: []
      }
    ]
  };
  const evals = {
    evaluations: [
      { id: 'candidate-source-line', lines: [{ move: 'b2b4', scoreCp: 50, pv: ['b2b4'] }] }
    ]
  };

  const result = createDraftLessons(review, contexts, evals);

  assert.deepEqual(result.drafts[0].steps, [
    { move: 'a2a4', reply: 'h1h2', note: 'TODO_ORIGINAL_STEP_NOTE' },
    { move: 'a4a5', reply: 'h2h3', note: 'TODO_ORIGINAL_STEP_NOTE' }
  ]);
  assert.deepEqual(result.drafts[0].sourceLine.map((move) => move.uci), ['a2a4', 'h1h2', 'a4a5', 'h2h3']);
});

test('selectBalancedShortlistBatch interleaves source files and categories', async () => {
  const { selectBalancedShortlistBatch } = await import('../tools/endgame-expansion/select-balanced-batch.mjs');
  const make = (id, sourceFile, category) => ({ id, sourceFile, category });
  const shortlist = {
    shortlist: [
      make('a1', 'A.pgn', 'queen-endgames'),
      make('a2', 'A.pgn', 'queen-endgames'),
      make('b1', 'B.pgn', 'rook-activity'),
      make('b2', 'B.pgn', 'rook-activity'),
      make('c1', 'C.pgn', 'queen-endgames')
    ]
  };

  const result = selectBalancedShortlistBatch(shortlist, { offset: 0, limit: 4 });

  assert.deepEqual(result.selected.map((candidate) => candidate.id), ['a1', 'b1', 'c1', 'a2']);
});

test('selectBalancedShortlistBatch can prefer categories and filter unwanted events', async () => {
  const { selectBalancedShortlistBatch } = await import('../tools/endgame-expansion/select-balanced-batch.mjs');
  const make = (id, sourceFile, category, event = 'Classical Event') => ({
    id,
    sourceFile,
    category,
    source: { event }
  });
  const shortlist = {
    shortlist: [
      make('queen-1', 'A.pgn', 'queen-endgames'),
      make('rook-minor-1', 'B.pgn', 'rook-minor-activity'),
      make('rook-minor-blitz', 'C.pgn', 'rook-minor-activity', 'Online Blitz Cup'),
      make('rook-1', 'D.pgn', 'rook-activity')
    ]
  };

  const result = selectBalancedShortlistBatch(shortlist, {
    limit: 3,
    preferCategories: ['rook-minor-activity', 'rook-activity'],
    rejectEventPattern: 'blitz'
  });

  assert.deepEqual(result.selected.map((candidate) => candidate.id), ['rook-minor-1', 'rook-1', 'queen-1']);
});

test('select-balanced parseArgs accepts repeated review exclusions', async () => {
  const { parseArgs: parseBalancedArgs } = await import('../tools/endgame-expansion/select-balanced-batch.mjs');

  const args = parseBalancedArgs([
    'node',
    'select',
    '--exclude-review',
    'review-a.json',
    '--exclude-review',
    'review-b.json'
  ]);

  assert.deepEqual(args.excludeReview, ['review-a.json', 'review-b.json']);
});

test('summarizeDraftReadiness counts only drafts without TODO placeholders as analyzed', async () => {
  const { summarizeDraftReadiness } = await import('../tools/endgame-expansion/summarize-drafts.mjs');
  const result = summarizeDraftReadiness({
    drafts: [
      { id: 'ready', teaching: { principle: '原创判断足够具体', method: '具体计划说明足够完整', mistake: '常见错误解释清楚' }, hints: ['hint1', 'hint2'], steps: [{ move: 'a2a4', note: 'note' }] },
      { id: 'todo', teaching: { principle: 'TODO_ORIGINAL_ANALYSIS', method: 'x', mistake: 'y' }, hints: ['hint1', 'hint2'], steps: [{ move: 'a2a4', note: 'note' }] }
    ]
  });

  assert.deepEqual(result, { total: 2, analyzed: 1, todo: 1, rejected: 0 });
});

test('summarizeDraftReadiness separates strict rejections from remaining TODO drafts', async () => {
  const { summarizeDraftReadiness } = await import('../tools/endgame-expansion/summarize-drafts.mjs');
  const result = summarizeDraftReadiness({
    drafts: [
      { id: 'ready', importStatus: 'analysis-draft', teaching: { principle: '原创判断足够具体', method: '具体计划说明足够完整', mistake: '常见错误解释清楚' }, hints: ['hint1', 'hint2'], steps: [{ move: 'a2a4', note: 'note' }] },
      { id: 'todo', importStatus: 'draft-not-ready', teaching: { principle: 'TODO_ORIGINAL_ANALYSIS', method: 'x', mistake: 'y' }, hints: ['hint1', 'hint2'], steps: [{ move: 'a2a4', note: 'note' }] },
      { id: 'rejected', importStatus: 'rejected-strict-standard', rejection: { reason: 'misclassified-basic-conversion' } }
    ]
  });

  assert.deepEqual(result, { total: 3, analyzed: 1, todo: 1, rejected: 1 });
});

test('validateDraftLessons checks only analysis drafts for text quality and legal lines', async () => {
  const { validateDraftLessons } = await import('../tools/endgame-expansion/validate-drafts.mjs');
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  const result = validateDraftLessons({
    drafts: [
      {
        id: 'ready-analysis',
        importStatus: 'analysis-draft',
        fen: startFen,
        teaching: {
          principle: '关键原则是先限制对方最活跃的反击来源，再决定是否转换到更容易计算的结构。',
          method: '具体执行时先用中心兵建立空间，再以马的开发保护关键格，保持王的安全并减少对手的强制将军选择。',
          mistake: '常见错误是急着吃子或换子，结果让对手获得连续先手，原本可控的残局会变成被动防守。'
        },
        hints: ['先找对手最强的反击来源。', '不要只看材料，要看换完后的王安全。'],
        steps: [
          { move: 'e2e4', reply: 'e7e5' },
          { move: 'g1f3' }
        ]
      },
      {
        id: 'bad-analysis',
        importStatus: 'analysis-draft',
        fen: startFen,
        teaching: {
          principle: '太短',
          method: 'TODO_ORIGINAL_ANALYSIS',
          mistake: '也太短'
        },
        hints: ['TODO_ORIGINAL_HINT'],
        steps: [{ move: 'e2e5' }]
      },
      {
        id: 'todo-skeleton',
        importStatus: 'draft-not-ready',
        teaching: { principle: 'TODO_ORIGINAL_ANALYSIS' },
        hints: ['TODO_ORIGINAL_HINT'],
        steps: [{ move: 'a2a4' }]
      }
    ]
  });

  assert.equal(result.valid, false);
  assert.equal(result.checked, 2);
  assert.equal(result.todo, 1);
  assert.match(result.errors.join('\n'), /bad-analysis principle too short/);
  assert.match(result.errors.join('\n'), /bad-analysis contains TODO placeholder/);
  assert.match(result.errors.join('\n'), /bad-analysis illegal step 0/);
});

test('validateDraftLessons rejects analyzed public PGN drafts whose lesson line diverges from sourceLine', async () => {
  const { validateDraftLessons } = await import('../tools/endgame-expansion/validate-drafts.mjs');
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  const teaching = {
    principle: '实战残局题必须保留原始 PGN 的连续走法，解析只能解释这条线，不能偷偷替换成引擎线。',
    method: '校验时把训练步骤中的 move 和 reply 展开为完整 UCI 序列，并和扫描阶段保存的 sourceLine 逐手对照，确保起点和后续选择都来自同一盘棋的实战记录。',
    mistake: '常见错误是起始局面来自公开 PGN，但主线被改成更像最优解的变化，导致题目不再是实战残局复盘。'
  };

  const result = validateDraftLessons({
    drafts: [
      {
        id: 'draft-diverged-source-line',
        sourceId: 'pgnmentor-files',
        importStatus: 'analysis-draft',
        fen: startFen,
        teaching,
        hints: ['先看来源连续线。', '再看 steps 是否完全一致。'],
        sourceLine: [
          { ply: 1, san: 'e4', uci: 'e2e4' },
          { ply: 2, san: 'e5', uci: 'e7e5' }
        ],
        steps: [{ move: 'd2d4', reply: 'd7d5' }]
      }
    ]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /draft-diverged-source-line lesson line must match sourceLine/);
});

test('validateDraftLessons reports strict rejections without counting them as TODO', async () => {
  const { validateDraftLessons } = await import('../tools/endgame-expansion/validate-drafts.mjs');
  const result = validateDraftLessons({
    drafts: [
      {
        id: 'rejected',
        importStatus: 'rejected-strict-standard',
        rejection: {
          reason: 'misclassified-basic-conversion',
          note: '换车后直接进入低复杂度技术结尾，不符合高水平复杂残局扩充标准。'
        },
        teaching: { principle: 'TODO_ORIGINAL_ANALYSIS' }
      },
      {
        id: 'todo-skeleton',
        importStatus: 'draft-not-ready',
        teaching: { principle: 'TODO_ORIGINAL_ANALYSIS' },
        hints: ['TODO_ORIGINAL_HINT'],
        steps: [{ move: 'a2a4' }]
      }
    ]
  });

  assert.equal(result.valid, true);
  assert.equal(result.checked, 0);
  assert.equal(result.todo, 1);
  assert.equal(result.rejected, 1);
});

test('summarizeDraftReadiness does not count rejected drafts as analyzed even if text is filled', async () => {
  const { summarizeDraftReadiness } = await import('../tools/endgame-expansion/summarize-drafts.mjs');
  const filledRejected = {
    importStatus: 'rejected-strict-standard',
    teaching: {
      principle: '这段文字已经足够长，但严格拒绝的草稿不应再计入完成题。',
      method: '即使重复题已经写过说明，也必须从 analyzed 数量中排除，否则进度会虚高。',
      mistake: '把 rejected 和 analyzed 同时统计，会让课程目标数量看起来比真实值更多。'
    },
    hints: ['不要重复计数。', '拒绝项只计入 rejected。'],
    steps: [{ move: 'a2a4' }]
  };

  const result = summarizeDraftReadiness({ drafts: [filledRejected] });

  assert.deepEqual(result, {
    total: 1,
    analyzed: 0,
    todo: 0,
    rejected: 1
  });
});

test('validateDraftLessons rejects a draft starting inside another analyzed draft main line', async () => {
  const { playLegalUciMove } = await import('../app.js');
  const { validateDraftLessons } = await import('../tools/endgame-expansion/validate-drafts.mjs');
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  const afterE4 = playLegalUciMove(startFen, 'e2e4').nextFen;
  const goodTeaching = {
    principle: '关键原则是同一条主线只能作为一道题处理，后续局面不能重复拆成新的训练题。',
    method: '具体执行时先记录每个分析草稿的主线经过局面，再把其他草稿的起始局面和这些经过局面逐一比较，确保同一来源或同一战术线不会因为多走几步而被拆成多个训练入口。',
    mistake: '常见错误是只看起始 FEN 是否完全相同，却忽略一题走几步后的局面已经覆盖了另一题。'
  };

  const result = validateDraftLessons({
    drafts: [
      {
        id: 'root-line',
        importStatus: 'analysis-draft',
        fen: startFen,
        teaching: goodTeaching,
        hints: ['检查主线经过局面。', '不要只检查起始局面。'],
        steps: [{ move: 'e2e4', reply: 'e7e5' }]
      },
      {
        id: 'continuation-duplicate',
        importStatus: 'analysis-draft',
        fen: afterE4,
        teaching: goodTeaching,
        hints: ['这是同一条主线后续。', '应该被拒绝。'],
        steps: [{ move: 'e7e5' }]
      }
    ]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /continuation-duplicate starts inside root-line main line/);
});

test('auditCourseTarget reports ready totals, gaps, and draft status counts', async () => {
  const { auditCourseTarget } = await import('../tools/endgame-expansion/audit-course-target.mjs');
  const result = auditCourseTarget({
    siteCategories: [{ id: 'rook-activity' }, { id: 'queen-endgames' }],
    siteLessons: [
      {
        id: 'site-1',
        category: 'rook-activity',
        fen: '8/8/8/8/8/8/R7/K6k w - -',
        orientation: 'w',
        source: {
          game: 'A-B, Event 2020',
          white: 'A',
          black: 'B',
          event: 'Event',
          date: '2020.01.01'
        },
        teaching: {
          principle: '先让主动子力限制对方反击，再决定是否进入更清晰的转换结构，不能只凭物质优势下判断。',
          method: '具体执行时用车占据第八横线，先切断黑王，再根据对方王的位置决定是否推进通路兵，并始终防止防守方获得侧面将军或换车后的守和资源。',
          mistake: '常见错误是急着吃兵，结果让防守方王靠近并获得侧面将军，优势方反而失去主动权。'
        },
        hints: ['先找最活跃的子力。', '不要急着吃兵。'],
        steps: [{ move: 'a2a8' }]
      }
    ],
    drafts: [
      {
        id: 'draft-1',
        importStatus: 'analysis-draft',
        category: 'queen-endgames',
        fen: '8/8/8/8/8/8/1R6/K6k w - -',
        orientation: 'w',
        source: {
          white: 'C',
          black: 'D',
          event: 'Event',
          date: '2021.01.01',
          result: '1-0'
        },
        teaching: {
          principle: '后残局的首要问题是王的安全和将军几何，而不是短期多吃一个兵或机械换后。',
          method: '具体执行时先用连续将军迫使对方王走到边线，再用后保护通路兵推进，同时确认自己王不会被长将牵制，并保留必要的后路格和换后后的兵形主动权。',
          mistake: '常见错误是贸然换后，进入对方王更近的兵残局，让原本主动的局面变成被动防守。'
        },
        hints: ['先看王安全。', '通路兵需要后保护。'],
        steps: [{ move: 'b2b8' }]
      },
      { id: 'draft-todo', importStatus: 'draft-not-ready', category: 'rook-activity' },
      { id: 'draft-rejected', importStatus: 'rejected-strict-standard', category: 'rook-activity' }
    ],
    candidates: [
      {
        importReady: true,
        lessons: [
          {
            id: 'candidate-1',
            category: 'queen-endgames',
            fen: '7k/8/8/8/8/8/2Q5/K7 w - -',
            orientation: 'w',
            source: {
              white: 'E',
              black: 'F',
              event: 'Event',
              date: '2022.01.01',
              result: '1-0'
            },
            teaching: {
              principle: '正式候选只有在最终复核后才进入 ready 总数，避免把普通草稿误当成网站课程。',
              method: '候选文件必须显式声明 importReady true，审计才把它和网站题一起重放、查重并计入目标数量；普通草稿即使已经写完，也只能作为待发布素材，不参与正式完成数量。',
              mistake: '如果普通草稿也被算入 ready，课程数量会虚高，未复核题会提前进入发布判断。'
            },
            hints: ['只统计正式候选。', '草稿只统计状态。'],
            steps: [{ move: 'c2c7' }]
          }
        ]
      }
    ],
    targetCount: 3,
    maxCategories: 12
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.counts, {
    siteLessons: 1,
    analyzedDrafts: 1,
    candidateLessons: 1,
    rejectedDrafts: 1,
    todoDrafts: 1,
    totalReady: 2,
    targetCount: 3,
    remainingToTarget: 1,
    categoryCount: 2
  });
  assert.deepEqual(result.byCategory, { 'queen-endgames': 1, 'rook-activity': 1 });
  assert.deepEqual(result.errors, []);
});

test('readDraftFiles includes named strict elite draft batches', async () => {
  const { readDraftFiles } = await import('../tools/endgame-expansion/audit-course-target.mjs');
  const root = await mkdtemp(join(tmpdir(), 'endgame-drafts-'));
  const draft = { id: 'strict-elite-draft', importStatus: 'draft-not-ready' };
  writeFileSync(join(root, 'draft-batch-strict-elite-001.json'), JSON.stringify({ drafts: [draft] }));
  writeFileSync(join(root, 'notes.json'), JSON.stringify({ drafts: [{ id: 'ignore-me' }] }));

  assert.deepEqual(readDraftFiles(root), [draft]);
});

test('validate-drafts readDrafts includes named strict elite draft batches', async () => {
  const { readDrafts } = await import('../tools/endgame-expansion/validate-drafts.mjs');
  const root = await mkdtemp(join(tmpdir(), 'endgame-validate-drafts-'));
  const draft = { id: 'strict-elite-draft', importStatus: 'draft-not-ready' };
  writeFileSync(join(root, 'draft-batch-strict-elite-001.json'), JSON.stringify({ drafts: [draft] }));

  assert.deepEqual(readDrafts(root), [draft]);
});

test('promote readDrafts includes named strict elite draft batches', async () => {
  const { readDrafts } = await import('../tools/endgame-expansion/promote-drafts-to-candidates.mjs');
  const root = await mkdtemp(join(tmpdir(), 'endgame-promote-drafts-'));
  const draft = { id: 'strict-elite-promote-draft', importStatus: 'analysis-draft' };
  writeFileSync(join(root, 'draft-batch-strict-elite-001.json'), JSON.stringify({ drafts: [draft] }));
  writeFileSync(join(root, 'notes.json'), JSON.stringify({ drafts: [{ id: 'ignore-me' }] }));

  assert.deepEqual(readDrafts(root), [draft]);
});

test('auditCourseTarget does not count non-import-ready candidates as ready lessons', async () => {
  const { auditCourseTarget } = await import('../tools/endgame-expansion/audit-course-target.mjs');
  const result = auditCourseTarget({
    siteCategories: [{ id: 'rook-activity' }],
    siteLessons: [],
    drafts: [],
    candidates: [
      {
        importReady: false,
        lessons: [
          {
            id: 'offline-candidate',
            category: 'rook-activity',
            fen: '8/8/8/8/8/8/R7/K6k w - -',
            orientation: 'w',
            source: { white: 'A', black: 'B', event: 'Event', date: '2020.01.01' },
            teaching: {
              principle: '这段候选分析即使已经写好，也不能在未通过最终复核前算作正式完成课程题。',
              method: '候选文件需要显式 importReady 为 true，且通过实战连续线和人工质量复核后，才允许被审计计入 ready 总数。',
              mistake: '把 importReady false 的候选算入完成数量，会让网站误以为低信度题目已经可以上线。'
            },
            hints: ['候选不是正式题。', '必须先最终复核。'],
            steps: [{ move: 'a2a8' }]
          }
        ]
      }
    ],
    targetCount: 1,
    maxCategories: 12
  });

  assert.equal(result.valid, true);
  assert.equal(result.counts.candidateLessons, 0);
  assert.equal(result.counts.totalReady, 0);
  assert.equal(result.counts.remainingToTarget, 1);
});

test('auditCourseTarget rejects duplicate ids and duplicate start tasks among publishable lessons', async () => {
  const { playLegalUciMove } = await import('../app.js');
  const { auditCourseTarget } = await import('../tools/endgame-expansion/audit-course-target.mjs');
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  const afterE4 = playLegalUciMove(startFen, 'e2e4').nextFen;
  const teaching = {
    principle: '同一条主线只能作为一道题处理，后续局面不能重复拆成新的训练题。',
    method: '审计时先记录所有起始局面，再重放每条主线，把走到的局面和其他起始局面对照。',
    mistake: '只检查完全相同的起始 FEN 会漏掉几步之后的重复训练入口。'
  };
  const lesson = (id, fen, move) => ({
    id,
    category: 'rook-activity',
    fen,
    orientation: fen.split(/\s+/)[1],
    source: { game: 'A-B, Event 2020', white: 'A', black: 'B', event: 'Event', date: '2020.01.01' },
    teaching,
    hints: ['检查主线经过局面。', '不要只看起点。'],
    steps: [{ move }]
  });

  const result = auditCourseTarget({
    siteCategories: [{ id: 'rook-activity' }],
    siteLessons: [
      lesson('root-line', startFen, 'e2e4'),
      lesson('root-line', 'rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR w KQkq b3', 'b4b5'),
      lesson('same-start-task', startFen, 'e2e4'),
      lesson('continuation-start', afterE4, 'e7e5')
    ],
    drafts: [],
    targetCount: 4,
    maxCategories: 12
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /duplicate id root-line/);
  assert.match(result.errors.join('\n'), /duplicate start task/);
  assert.match(result.errors.join('\n'), /continuation-start starts inside root-line main line/);
});

test('auditCourseTarget does not double count drafts already promoted to candidates', async () => {
  const { auditCourseTarget } = await import('../tools/endgame-expansion/audit-course-target.mjs');
  const teaching = {
    principle: '晋级后的正式候选应该成为唯一计数对象，原草稿只保留为编辑历史，避免课程数量虚高。',
    method: '审计时用 sourceCandidateId 把候选和草稿对应起来，如果候选已经存在，就从 ready 统计中排除同一草稿。',
    mistake: '如果同时统计草稿和候选，课程总数会虚高，重复起点检测也会误报同一题复制自己。'
  };
  const draft = {
    id: 'draft-candidate-alpha',
    sourceCandidateId: 'candidate-alpha',
    importStatus: 'analysis-draft',
    category: 'rook-activity',
    fen: '8/8/8/8/8/8/R7/K6k w - -',
    orientation: 'w',
    source: { white: 'A', black: 'B', event: 'Event', date: '2020.01.01' },
    teaching,
    hints: ['先看候选。', '不要重复统计草稿。'],
    steps: [{ move: 'a2a8' }]
  };
  const candidate = {
    ...draft,
    id: 'candidate-alpha',
    sourceCandidateId: 'candidate-alpha',
    complexityScore: 8,
    sourceId: 'pgnmentor-files',
    sourceGameId: 'Alpha.pgn|Event|2020.01.01|A|B|1',
    startPly: 10,
    playerQualityReason: 'A vs B, Event 2020. Approved public PGN source.'
  };

  const result = auditCourseTarget({
    siteCategories: [{ id: 'rook-activity' }],
    siteLessons: [],
    drafts: [draft],
    candidates: [{ importReady: true, lessons: [candidate] }],
    targetCount: 300,
    maxCategories: 12
  });

  assert.equal(result.valid, true);
  assert.equal(result.counts.analyzedDrafts, 0);
  assert.equal(result.counts.candidateLessons, 1);
  assert.equal(result.counts.totalReady, 1);
  assert.deepEqual(result.errors, []);
});

test('auditCourseTarget does not double count candidates already imported into site lessons', async () => {
  const { auditCourseTarget } = await import('../tools/endgame-expansion/audit-course-target.mjs');
  const teaching = {
    principle: '高水平残局训练要避免同一候选在网站和候选文件里重复计算，否则课程数量和重复局面判断都会失真。',
    method: '当网站课程已经包含 sourceCandidateId 时，审计应把候选文件里的同一 id 视为已导入，只按网站课程计算一次。',
    mistake: '如果不去重，导入后的候选会同时作为网站题和候选题出现，导致数量、分类和重复局面审计全部失真，后续目标判断也会错误。'
  };
  const lesson = {
    id: 'candidate-alpha',
    sourceCandidateId: 'candidate-alpha',
    category: 'rook-activity',
    fen: '7k/8/8/8/8/8/P7/K7 w - -',
    orientation: 'w',
    source: { white: 'A', black: 'B', event: 'Event', date: '2020.01.01' },
    teaching,
    hints: ['网站已导入。', '候选文件不应重复算。'],
    steps: [{ move: 'a2a3' }]
  };

  const result = auditCourseTarget({
    siteCategories: [{ id: 'rook-activity' }],
    siteLessons: [lesson],
    drafts: [],
    candidates: [{ lessons: [{ ...lesson, sourceId: 'pgnmentor-files', sourceGameId: 'Alpha.pgn|Event|2020.01.01|A|B|1' }] }],
    targetCount: 1,
    maxCategories: 12
  });

  assert.equal(result.valid, true);
  assert.equal(result.counts.siteLessons, 1);
  assert.equal(result.counts.candidateLessons, 0);
  assert.equal(result.counts.totalReady, 1);
  assert.deepEqual(result.byCategory, { 'rook-activity': 1 });
});

test('promoteDraftsToCandidates promotes only analyzed drafts with final FEN and source metadata', async () => {
  const { playLegalUciMove } = await import('../app.js');
  const { promoteDraftsToCandidates } = await import('../tools/endgame-expansion/promote-drafts-to-candidates.mjs');
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  const afterE4 = playLegalUciMove(startFen, 'e2e4').nextFen;
  const expectedFinalFen = playLegalUciMove(afterE4, 'e7e5').nextFen;
  const teaching = {
    principle: '高水平残局训练必须记录真实决策点，并把第一手背后的局面特征讲清楚。',
    method: '具体转换时先重放主线确认每一步合法，再把来源、复杂度、最终局面和教学字段写入正式候选对象。',
    mistake: '常见错误是把还没完成分析的草稿也导入候选池，导致网站出现 TODO 或低质量题目。'
  };

  const result = promoteDraftsToCandidates({
    importReady: true,
    drafts: [
      {
        id: 'draft-candidate-alpha',
        sourceCandidateId: 'candidate-alpha',
        importStatus: 'analysis-draft',
        category: 'rook-activity',
        title: 'Alpha - Beta: e4',
        level: '高水平复杂残局候选',
        goal: '白先，确认关键计划',
        fen: startFen,
        orientation: 'w',
        sourceId: 'pgnmentor-files',
        sourceGameId: 'Alpha.pgn|Event|2020.01.01|Alpha|Beta|1',
        startPly: 0,
        source: {
          white: 'Alpha',
          black: 'Beta',
          event: 'Event',
          site: 'Local',
          date: '2020.01.01',
          result: '1-0'
        },
        review: { complexityScore: 9 },
        playerQualityReason: 'Alpha vs Beta still requires final human quality review before website import.',
        teaching,
        hints: ['先确认来源。', '再重放主线。'],
        sourceLine: [
          { ply: 1, san: 'e4', uci: 'e2e4' },
          { ply: 2, san: 'e5', uci: 'e7e5' }
        ],
        steps: [{ move: 'e2e4', reply: 'e7e5' }]
      },
      {
        id: 'draft-candidate-default-score',
        importStatus: 'analysis-draft',
        category: 'queen-endgames',
        title: 'Gamma - Delta: d4',
        level: '高水平复杂残局候选',
        goal: '白先，确认关键计划',
        fen: startFen,
        orientation: 'w',
        sourceId: 'pgnmentor-files',
        sourceGameId: 'Gamma.pgn|Event|2021.01.01|Gamma|Delta|1',
        startPly: 0,
        source: {
          white: 'Gamma',
          black: 'Delta',
          event: 'Event',
          site: 'Local',
          date: '2021.01.01',
          result: '1/2-1/2'
        },
        teaching,
        hints: ['默认复杂度。', '仍然要合法重放。'],
        steps: [{ move: 'd2d4' }]
      },
      { id: 'draft-todo', importStatus: 'draft-not-ready' },
      { id: 'draft-rejected', importStatus: 'rejected-strict-standard' }
    ]
  });

  assert.equal(result.importReady, true);
  assert.deepEqual(result.lessons.map((lesson) => lesson.id), ['candidate-alpha', 'candidate-default-score']);
  assert.equal(result.lessons[0].complexityScore, 9);
  assert.equal(result.lessons[1].complexityScore, 8);
  assert.equal(result.lessons[0].finalFen, expectedFinalFen);
  assert.doesNotMatch(result.lessons[0].playerQualityReason, /requires final human quality review/i);
  assert.deepEqual(result.lessons[0].sourceLine.map((move) => move.uci), ['e2e4', 'e7e5']);
  assert.deepEqual(
    result.lessons.map((lesson) => [lesson.source.white, lesson.source.black, lesson.source.event, lesson.source.date, lesson.source.result]),
    [
      ['Alpha', 'Beta', 'Event', '2020.01.01', '1-0'],
      ['Gamma', 'Delta', 'Event', '2021.01.01', '1/2-1/2']
    ]
  );
  assert.deepEqual(result.skipped.map((item) => [item.id, item.reason]), [
    ['draft-todo', 'draft-not-ready'],
    ['draft-rejected', 'rejected-strict-standard']
  ]);
});

test('validateCandidateData rejects public PGN candidates whose lesson line diverges from sourceLine', async () => {
  const { validateCandidateData } = await import('../tools/endgame-expansion/validate-candidates.mjs');
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  const lesson = {
    id: 'candidate-diverged-source-line',
    category: 'rook-activity',
    title: 'Alpha - Beta: source line',
    level: '高水平复杂残局候选',
    goal: '白先，沿实战线确认关键防守资源。',
    fen: startFen,
    orientation: 'w',
    complexityScore: 9,
    sourceId: 'pgnmentor-files',
    sourceGameId: 'Alpha.pgn|Event|2020.01.01|Alpha|Beta|1',
    startPly: 0,
    playerQualityReason: 'Alpha and Beta were selected by the strict elite PGN gate.',
    teaching: {
      principle: '实战残局题的主线必须来自原始 PGN 连续走法，不能把引擎改进线伪装成实战。',
      method: '验证时把 steps 里的用户走法和应手展开成 UCI 序列，再和扫描阶段保存的 sourceLine 逐手对照。',
      mistake: '常见错误是起始局面来自实战，但训练主线被替换成引擎建议，导致题目不再反映双方真实选择。'
    },
    hints: ['先确认来源连续线。', '再检查每一步是否一致。'],
    sourceLine: [
      { ply: 1, san: 'e4', uci: 'e2e4' },
      { ply: 2, san: 'e5', uci: 'e7e5' }
    ],
    steps: [{ move: 'd2d4', reply: 'd7d5' }]
  };

  const result = validateCandidateData({
    candidateFiles: [{ file: 'memory-candidates.json', data: { importReady: true, lessons: [lesson] } }],
    sourceIds: new Set(['pgnmentor-files'])
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('lesson line must match sourceLine')));
});

test('validateCandidateData rejects public PGN candidates that stop before the source game result', async () => {
  const { validateCandidateData } = await import('../tools/endgame-expansion/validate-candidates.mjs');
  const root = await mkdtemp(join(tmpdir(), 'endgame-candidate-raw-'));
  const rawDir = join(root, 'raw');
  const pgnDir = join(rawDir, 'pgnmentor-alpha');
  mkdirSync(pgnDir, { recursive: true });
  writeFileSync(
    join(pgnDir, 'Alpha.pgn'),
    [
      '[Event "Event"]',
      '[Site "Local"]',
      '[Date "2020.01.01"]',
      '[Round "?"]',
      '[White "Alpha"]',
      '[Black "Beta"]',
      '[Result "1-0"]',
      '',
      '1. e4 e5 2. Nf3 Nc6 1-0',
      ''
    ].join('\n')
  );

  const lesson = {
    id: 'candidate-truncated-source-game',
    category: 'rook-activity',
    title: 'Alpha - Beta: truncated source game',
    level: '高水平复杂残局候选',
    goal: '白先，沿实战线确认关键防守资源。',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
    orientation: 'w',
    complexityScore: 9,
    sourceId: 'pgnmentor-files',
    sourceGameId: 'Alpha.pgn|Event|2020.01.01|Alpha|Beta|1',
    startPly: 0,
    playerQualityReason: 'Alpha and Beta were selected by the strict elite PGN gate.',
    teaching: {
      principle: '公开 PGN 题必须一直走到原局结果，不能在关键局面还没解决时提前结束。',
      method: '校验器要从 sourceGameId 读取源 PGN，把 startPly 之后的全部实战 UCI 走法和训练主线逐手比较。',
      mistake: '只检查前几步 sourceLine 会漏掉截断题，导致训练题在胜负或守和资源还没有展示完时就结束。'
    },
    hints: ['先确认源 PGN 是否还有后续。', '再检查训练主线是否走到结果。'],
    sourceLine: [
      { ply: 1, san: 'e4', uci: 'e2e4' },
      { ply: 2, san: 'e5', uci: 'e7e5' }
    ],
    steps: [{ move: 'e2e4', reply: 'e7e5' }]
  };

  const result = validateCandidateData({
    candidateFiles: [{ file: 'memory-candidates.json', data: { importReady: true, lessons: [lesson] } }],
    sourceIds: new Set(['pgnmentor-files']),
    rawDir
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('must continue to source PGN result')));
});

test('restoreHeldBackCandidates extends selected public PGN drafts to the source game result', async () => {
  const { restoreHeldBackCandidates } = await import('../tools/endgame-expansion/restore-heldback-candidates-to-result.mjs');
  const root = await mkdtemp(join(tmpdir(), 'endgame-restore-raw-'));
  const rawDir = join(root, 'raw');
  const pgnDir = join(rawDir, 'pgnmentor-alpha');
  mkdirSync(pgnDir, { recursive: true });
  writeFileSync(
    join(pgnDir, 'Alpha.pgn'),
    [
      '[Event "Event"]',
      '[Site "Local"]',
      '[Date "2020.01.01"]',
      '[Round "?"]',
      '[White "Alpha"]',
      '[Black "Beta"]',
      '[Result "1-0"]',
      '',
      '1. e4 e5 2. Nf3 Nc6 1-0',
      ''
    ].join('\n')
  );

  const draft = {
    id: 'draft-candidate-alpha',
    sourceCandidateId: 'candidate-alpha',
    importStatus: 'analysis-draft',
    category: 'rook-activity',
    title: 'Alpha - Beta: restored line',
    level: '高水平复杂残局候选',
    goal: '白先，沿实战线确认关键防守资源。',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
    orientation: 'w',
    sourceId: 'pgnmentor-files',
    sourceGameId: 'Alpha.pgn|Event|2020.01.01|Alpha|Beta|1',
    startPly: 0,
    source: { white: 'Alpha', black: 'Beta', event: 'Event', site: 'Local', date: '2020.01.01', result: '1-0' },
    teaching: {
      principle: '公开 PGN 题必须一直走到原局结果，不能在关键局面还没解决时提前结束。',
      method: '恢复流程要读取 sourceGameId 对应的 PGN，把 startPly 之后的所有实战走法展开为训练主线。',
      mistake: '只补 UI 数量而不补完整走法，会重新制造局面还没结束题目就完成的问题。'
    },
    hints: ['先看源 PGN 后续。', '再确认训练主线完整。'],
    sourceLine: [
      { ply: 1, san: 'e4', uci: 'e2e4' },
      { ply: 2, san: 'e5', uci: 'e7e5' }
    ],
    steps: [{ move: 'e2e4', reply: 'e7e5', note: '旧解析第一步保留。' }]
  };

  const result = restoreHeldBackCandidates({
    candidateData: {
      importReady: true,
      lessons: [],
      heldBack: [{ id: 'candidate-alpha', reason: 'source-game-not-finished-after-lesson' }]
    },
    drafts: [draft],
    siteLessons: [],
    rawDir,
    targetReady: 1
  });

  assert.equal(result.summary.restored, 1);
  assert.deepEqual(result.candidateData.heldBack, []);
  assert.deepEqual(result.candidateData.lessons[0].sourceLine.map((move) => move.uci), ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  assert.deepEqual(lessonMovesForToolTest(result.candidateData.lessons[0]), ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  assert.equal(result.candidateData.lessons[0].steps[0].note, '旧解析第一步保留。');
  assert.ok(result.candidateData.lessons[0].steps[1].note.length >= 35);
});

test('validateCandidateData skips non-import-ready candidate files', async () => {
  const { validateCandidateData } = await import('../tools/endgame-expansion/validate-candidates.mjs');
  const result = validateCandidateData({
    candidateFiles: [
      {
        file: 'offline-history.json',
        data: {
          importReady: false,
          lessons: [
            {
              id: 'offline-old-candidate',
              sourceId: 'pgnmentor-files',
              steps: [{ move: 'd2d4' }]
            }
          ]
        }
      }
    ],
    sourceIds: new Set(['pgnmentor-files'])
  });

  assert.equal(result.valid, true);
  assert.equal(result.lessonCount, 0);
});

test('exportCandidatesModule keeps structured source metadata and display labels', async () => {
  const { exportCandidatesModule } = await import('../tools/endgame-expansion/export-candidates-module.mjs');
  const text = exportCandidatesModule({
    lessons: [
      {
        id: 'candidate-demo',
        category: 'queen-endgames',
        title: 'Demo',
        level: 'High',
        goal: 'Find the plan',
        fen: '8/8/8/8/8/8/8/K6k w - -',
        orientation: 'w',
        complexityScore: 8,
        sourceId: 'pgnmentor-files',
        sourceGameId: 'Demo.pgn|Event|2020.01.01|White|Black|1',
        sourceCandidateId: 'candidate-demo',
        startPly: 20,
        playerQualityReason: 'Demo reason',
        source: { white: 'White', black: 'Black', event: 'Event', date: '2020.01.01', result: '1-0' },
        teaching: {
          principle: 'A principle long enough for validation.',
          method: 'A method text long enough to explain the practical conversion route.',
          mistake: 'A mistake long enough for validation.'
        },
        hints: ['Hint one', 'Hint two'],
        steps: [{ move: 'a1a2' }]
      }
    ]
  });

  assert.match(text, /export const ENDGAME_EXPANSION_LESSONS/);
  assert.match(text, /"sourceId": "pgnmentor-files"/);
  assert.match(text, /"game": "White-Black, Event 2020\.01\.01"/);
  assert.match(text, /"provider": "PGN Mentor public PGN files"/);
});

test('applyAnalysisReport turns matching skeletons into analyzed drafts without touching rejected rows', async () => {
  const { applyAnalysisReport } = await import('../tools/endgame-expansion/apply-analysis-report.mjs');
  const teaching = {
    principle: '原创原则说明需要足够具体，不能只复述第一手是什么。',
    method: '执行方案要解释双方资源、转换顺序和为什么这些手段能在实战中成立，便于之后进入课程校验。',
    mistake: '常见错误是把还没分析完的骨架直接标为可导入。'
  };
  const draftData = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    importReady: false,
    drafts: [
      {
        id: 'draft-alpha',
        importStatus: 'draft-not-ready',
        teaching: {
          principle: 'TODO_ORIGINAL_ANALYSIS',
          method: 'TODO_ORIGINAL_ANALYSIS',
          mistake: 'TODO_ORIGINAL_ANALYSIS'
        },
        hints: ['TODO_ORIGINAL_HINT', 'TODO_ORIGINAL_HINT'],
        steps: [{ move: 'a2a4', note: 'TODO_ORIGINAL_STEP_NOTE' }]
      },
      {
        id: 'draft-rejected',
        importStatus: 'rejected-strict-standard',
        teaching: {
          principle: 'TODO_ORIGINAL_ANALYSIS',
          method: 'TODO_ORIGINAL_ANALYSIS',
          mistake: 'TODO_ORIGINAL_ANALYSIS'
        }
      }
    ],
    skipped: []
  };
  const report = {
    generatedAt: '2026-06-03T01:00:00.000Z',
    stage: 'offline-original-analysis-smoke',
    analyses: [
      {
        id: 'draft-alpha',
        teaching,
        hints: ['先确认关键资源。', '再重放主线。'],
        steps: [{ move: 'a2a4', note: '建立远端通路。' }]
      },
      {
        id: 'draft-rejected',
        teaching,
        hints: ['不应恢复。', '保持拒绝。'],
        steps: [{ move: 'a2a4' }]
      },
      {
        id: 'draft-missing',
        teaching,
        hints: ['报告可能写错 id。', '工具要暴露问题。'],
        steps: [{ move: 'a2a4' }]
      }
    ]
  };

  const result = applyAnalysisReport(draftData, report);

  assert.equal(result.summary.applied, 1);
  assert.deepEqual(result.summary.skippedRejected, ['draft-rejected']);
  assert.deepEqual(result.summary.missing, ['draft-missing']);
  assert.equal(result.draftData.importReady, false);
  assert.equal(result.draftData.drafts[0].importStatus, 'analysis-draft');
  assert.deepEqual(result.draftData.drafts[0].teaching, teaching);
  assert.deepEqual(result.draftData.drafts[0].hints, ['先确认关键资源。', '再重放主线。']);
  assert.deepEqual(result.draftData.drafts[0].steps, [{ move: 'a2a4', note: '建立远端通路。' }]);
  assert.deepEqual(result.draftData.drafts[0].analysisReport, {
    stage: 'offline-original-analysis-smoke',
    generatedAt: '2026-06-03T01:00:00.000Z'
  });
  assert.equal(result.draftData.drafts[1].importStatus, 'rejected-strict-standard');
  assert.equal(result.draftData.drafts[1].teaching.principle, 'TODO_ORIGINAL_ANALYSIS');
});

test('applyAnalysisReport refuses public PGN analysis when steps diverge from sourceLine', async () => {
  const { applyAnalysisReport } = await import('../tools/endgame-expansion/apply-analysis-report.mjs');
  const teaching = {
    principle: '原创解析只能解释实战连续线，不能把另外一条变化写入训练主线。',
    method: '应用报告时先展开分析报告中的 move 和 reply，再和草稿保存的 sourceLine 逐手比较，只有完全一致才允许把文本写入草稿。',
    mistake: '常见错误是报告文本看起来完整，但步骤已经偏离公开 PGN，这会污染之后的课程导入。'
  };
  const draftData = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    importReady: false,
    drafts: [
      {
        id: 'draft-source-line',
        sourceId: 'pgnmentor-files',
        importStatus: 'draft-not-ready',
        sourceLine: [
          { ply: 1, san: 'e4', uci: 'e2e4' },
          { ply: 2, san: 'e5', uci: 'e7e5' }
        ],
        teaching: {
          principle: 'TODO_ORIGINAL_ANALYSIS',
          method: 'TODO_ORIGINAL_ANALYSIS',
          mistake: 'TODO_ORIGINAL_ANALYSIS'
        },
        hints: ['TODO_ORIGINAL_HINT', 'TODO_ORIGINAL_HINT'],
        steps: [{ move: 'e2e4', reply: 'e7e5', note: 'TODO_ORIGINAL_STEP_NOTE' }]
      }
    ],
    skipped: []
  };
  const report = {
    generatedAt: '2026-06-03T01:00:00.000Z',
    stage: 'offline-original-analysis-source-line',
    analyses: [
      {
        id: 'draft-source-line',
        teaching,
        hints: ['先对齐来源线。', '再写解释。'],
        steps: [{ move: 'd2d4', reply: 'd7d5', note: '错误地换成另一条线。' }]
      }
    ]
  };

  const result = applyAnalysisReport(draftData, report);

  assert.equal(result.summary.applied, 0);
  assert.deepEqual(result.summary.invalidSourceLine, ['draft-source-line']);
  assert.equal(result.draftData.drafts[0].importStatus, 'draft-not-ready');
  assert.equal(result.draftData.drafts[0].teaching.principle, 'TODO_ORIGINAL_ANALYSIS');
});

test('markContinuationDuplicates rejects later skeletons inside an earlier source window', async () => {
  const { markContinuationDuplicates } = await import('../tools/endgame-expansion/mark-continuation-duplicates.mjs');
  const makeDraft = (id, startPly, importStatus = 'draft-not-ready', contextWindow = []) => ({
    id,
    sourceGameId: 'Alpha.pgn|Event|2020.01.01|A|B|1',
    startPly,
    importStatus,
    contextWindow
  });
  const draftData = {
    drafts: [
      makeDraft('first', 10, 'draft-not-ready', [
        { ply: 10 },
        { ply: 11 },
        { ply: 12 },
        { ply: 13 },
        { ply: 14 }
      ]),
      makeDraft('later-inside', 12),
      makeDraft('later-outside', 30),
      makeDraft('already-rejected', 13, 'rejected-strict-standard')
    ]
  };

  const result = markContinuationDuplicates(draftData);

  assert.equal(result.summary.rejected, 1);
  assert.deepEqual(result.summary.rejectedIds, ['later-inside']);
  assert.equal(result.draftData.drafts[1].importStatus, 'rejected-strict-standard');
  assert.equal(result.draftData.drafts[1].rejection.reason, 'same-source-continuation-duplicate');
  assert.equal(result.draftData.drafts[1].rejection.relatedDraftId, 'first');
  assert.equal(result.draftData.drafts[2].importStatus, 'draft-not-ready');
  assert.equal(result.draftData.drafts[3].importStatus, 'rejected-strict-standard');
});

test('markContinuationDuplicates reports analyzed continuation conflicts without rewriting them by default', async () => {
  const { markContinuationDuplicates } = await import('../tools/endgame-expansion/mark-continuation-duplicates.mjs');
  const draftData = {
    drafts: [
      {
        id: 'first',
        sourceGameId: 'Alpha.pgn|Event|2020.01.01|A|B|1',
        startPly: 20,
        importStatus: 'analysis-draft',
        contextWindow: [{ ply: 21 }, { ply: 22 }, { ply: 23 }]
      },
      {
        id: 'analyzed-later',
        sourceGameId: 'Alpha.pgn|Event|2020.01.01|A|B|1',
        startPly: 22,
        importStatus: 'analysis-draft'
      }
    ]
  };

  const result = markContinuationDuplicates(draftData);

  assert.equal(result.summary.rejected, 0);
  assert.deepEqual(result.summary.analyzedConflicts, ['analyzed-later']);
  assert.equal(result.draftData.drafts[1].importStatus, 'analysis-draft');
});

test('markDuplicateStartTasks rejects draft skeletons already covered by candidates or earlier drafts', async () => {
  const { markDuplicateStartTasks } = await import('../tools/endgame-expansion/mark-continuation-duplicates.mjs');
  const candidate = {
    id: 'candidate-existing',
    fen: '8/8/8/8/8/8/R7/K6k w - -',
    steps: [{ move: 'a2a8' }]
  };
  const draftData = {
    drafts: [
      {
        id: 'draft-duplicate-candidate',
        importStatus: 'analysis-draft',
        fen: '8/8/8/8/8/8/R7/K6k w - -',
        steps: [{ move: 'a2a8' }]
      },
      {
        id: 'draft-unique-owner',
        importStatus: 'analysis-draft',
        fen: '8/8/8/8/8/8/1R6/K6k w - -',
        steps: [{ move: 'b2b8' }]
      },
      {
        id: 'draft-duplicate-earlier',
        importStatus: 'draft-not-ready',
        fen: '8/8/8/8/8/8/1R6/K6k w - -',
        steps: [{ move: 'b2b8' }]
      }
    ]
  };

  const result = markDuplicateStartTasks(draftData, { candidates: [candidate] });

  assert.deepEqual(result.summary.rejectedIds, ['draft-duplicate-candidate', 'draft-duplicate-earlier']);
  assert.equal(result.draftData.drafts[0].importStatus, 'rejected-strict-standard');
  assert.equal(result.draftData.drafts[0].rejection.reason, 'duplicate-start-task');
  assert.equal(result.draftData.drafts[0].rejection.relatedDraftId, 'candidate-existing');
  assert.equal(result.draftData.drafts[1].importStatus, 'analysis-draft');
  assert.equal(result.draftData.drafts[2].importStatus, 'rejected-strict-standard');
  assert.equal(result.draftData.drafts[2].rejection.relatedDraftId, 'draft-unique-owner');
});

test('markStartsInsideCandidateLines rejects drafts that begin inside an existing candidate main line', async () => {
  const { playLegalUciMove } = await import('../app.js');
  const { markStartsInsideCandidateLines } = await import('../tools/endgame-expansion/mark-continuation-duplicates.mjs');
  const startFen = '8/8/8/8/8/8/P7/K6k w - -';
  const insideFen = playLegalUciMove(startFen, 'a2a4').nextFen;
  const draftData = {
    drafts: [
      {
        id: 'inside-candidate',
        importStatus: 'analysis-draft',
        fen: insideFen,
        steps: [{ move: 'h1g1' }]
      },
      {
        id: 'outside-candidate',
        importStatus: 'analysis-draft',
        fen: '8/8/8/8/8/P7/8/K6k b - -',
        steps: [{ move: 'h1g1' }]
      }
    ]
  };
  const candidates = [
    {
      id: 'candidate-owner',
      fen: startFen,
      steps: [{ move: 'a2a4', reply: 'h1g1' }]
    }
  ];

  const result = markStartsInsideCandidateLines(draftData, { candidates });

  assert.deepEqual(result.summary.rejectedIds, ['inside-candidate']);
  assert.equal(result.draftData.drafts[0].importStatus, 'rejected-strict-standard');
  assert.equal(result.draftData.drafts[0].rejection.reason, 'starts-inside-candidate-main-line');
  assert.equal(result.draftData.drafts[0].rejection.relatedDraftId, 'candidate-owner');
  assert.equal(result.draftData.drafts[1].importStatus, 'analysis-draft');
});

function lessonMovesForToolTest(lesson) {
  const moves = [];
  for (const step of lesson.steps || []) {
    if (step.move) moves.push(step.move);
    if (step.reply) moves.push(step.reply);
  }
  return moves;
}
