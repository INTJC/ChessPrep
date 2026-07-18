import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPreparedMove,
  chooseOpponentMove,
  buildStudyPgnUrls,
  boardInputReducer,
  boardDisplayFiles,
  boardDisplayRanks,
  boardSquareColor,
  chooseRandomCandidateMove,
  createStudyRecord,
  createTrainerFromPgn,
  extractStudyId,
  formatMoveHistoryPgn,
  formatEndgameSourceLabel,
  formatEndgameSourceLine,
  getPrepExplorerRows,
  getAvailableCandidateMoves,
  getLegalDestinationSquares,
  getEngineProfile,
  getVisibleFeedbackMessage,
  getPromotionChoicesForMove,
  findPreparedMoveFromSquares,
  getOpponentBranchDecision,
  getOpeningLineCompletionAction,
  canStartEngineTraining,
  listEngineProfiles,
  parseStudyUrl,
  parseEngineErrorPayload,
  replayPgnGame,
  selectEngineReplyMove,
  parseUciBestMove,
  parseUciInfoLines,
  pickHumanizedEngineMove,
  playLegalUciMove,
  rewindMoveHistoryOnePly,
  rewindMoveHistoryToPreviousTurn,
  restoreMoveHistorySegment,
  appendStudyRecord,
  upsertStudyRecord,
  getCandidateMoves,
  normalizeBoardOrientation,
  pieceAssetClass,
  splitPgnGames,
  tokenizePgnMovetext
} from '../app.js';
import {
  DEFAULT_LOCALE,
  localizeEndgameCategory,
  localizeEndgameLesson,
  t,
  translateText
} from '../i18n.js';
import { getEndgameCategories, listEndgameLessons } from '../endgames.js';

test('i18n defaults to Chinese and translates core UI terms to English', () => {
  assert.equal(DEFAULT_LOCALE, 'zh');
  assert.equal(t('zh', 'mode.opening'), '开局训练');
  assert.equal(t('en', 'mode.opening'), 'Opening Training');
  assert.equal(t('en', 'stats.accuracy'), 'Accuracy');
  assert.equal(t('en', 'actions.nextRandomLine'), 'Next Random Line');
  assert.equal(translateText('先导入你的 Lichess 研讨 PGN，然后开始训练。', 'en'), 'Import your Lichess Study PGN first, then start training.');
});

test('i18n localizes endgame categories and lesson teaching without mutating Chinese source data', () => {
  const category = getEndgameCategories().find((candidate) => candidate.id === 'queen-endgames');
  const lesson = listEndgameLessons().find((candidate) => candidate.category === 'queen-endgames');

  const englishCategory = localizeEndgameCategory(category, 'en');
  const englishLesson = localizeEndgameLesson(lesson, 'en');

  assert.equal(englishCategory.title, 'Queen Endgames');
  assert.equal(englishLesson.trainingTargetLabel, lesson.trainingTarget === 'win' ? 'Target: Win' : 'Target: Hold the Draw');
  assert.match(englishLesson.goal, /White to move|Black to move/);
  assert.doesNotMatch(englishLesson.goal, /白先|黑先|赢棋|守和/);
  assert.doesNotMatch(englishLesson.teaching.principle, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(englishLesson.teaching.method, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(englishLesson.teaching.mistake, /[\u4e00-\u9fff]/);
  assert.notEqual(englishLesson, lesson);
  assert.match(lesson.goal, /白先|黑先/);
});

test('i18n English endgame course text has no Chinese fallback fragments', () => {
  for (const lesson of listEndgameLessons()) {
    const englishLesson = localizeEndgameLesson(lesson, 'en');
    const text = [
      englishLesson.title,
      englishLesson.level,
      englishLesson.goal,
      englishLesson.trainingTargetLabel,
      englishLesson.trainingTargetReason,
      englishLesson.teaching?.principle,
      englishLesson.teaching?.method,
      englishLesson.teaching?.mistake,
      ...(englishLesson.hints || []),
      ...(englishLesson.steps || []).map((step) => step.note || '')
    ].join('\n');

    assert.doesNotMatch(text, /[\u4e00-\u9fff]/, `${lesson.id} has untranslated Chinese text in English mode`);
  }
});

test('i18n translates composed endgame task prompts without Chinese fragments', () => {
  const prompts = [
    '白先，在压力下走出守和资源。请在棋盘上走出关键第一步。',
    '白先，把实战优势赢下来。先读左侧要点，再在棋盘上走第一步。',
    '本题已经完成，点击“下一题”继续。'
  ];

  for (const prompt of prompts) {
    const translated = translateText(prompt, 'en');
    assert.doesNotMatch(translated, /[\u4e00-\u9fff]/, translated);
  }
});

test('visible feedback uses the active endgame task message in endgame mode', () => {
  const openingPrompt = '先导入你的 Lichess 研讨 PGN，然后开始训练。';
  const endgameError = '这步不符合本题关键方案。建议走 e2e4。';

  assert.equal(getVisibleFeedbackMessage({
    mode: 'endgame',
    status: openingPrompt,
    endgameMessage: endgameError
  }), endgameError);
  assert.equal(getVisibleFeedbackMessage({
    mode: 'opening',
    status: openingPrompt,
    endgameMessage: endgameError
  }), openingPrompt);
  assert.equal(getVisibleFeedbackMessage({
    mode: 'endgame',
    feedback: openingPrompt,
    status: openingPrompt,
    endgameMessage: ''
  }), '');
  assert.equal(getVisibleFeedbackMessage({
    mode: 'prep',
    feedback: openingPrompt,
    status: openingPrompt,
    prepMessage: '备战数据库已就绪。'
  }), '备战数据库已就绪。');
});

test('extractStudyId reads study ids from Lichess study URLs', () => {
  assert.equal(extractStudyId('https://lichess.org/study/abcDEF12'), 'abcDEF12');
  assert.equal(extractStudyId('https://lichess.org/study/abcDEF12/xyz987'), 'abcDEF12');
  assert.equal(extractStudyId('not a study'), null);
});

test('parseStudyUrl reads study and chapter ids from Lichess chapter URLs', () => {
  assert.deepEqual(parseStudyUrl('https://lichess.org/study/FSuRmT1t/KABH4Dht'), {
    studyId: 'FSuRmT1t',
    chapterId: 'KABH4Dht'
  });
  assert.deepEqual(parseStudyUrl('https://lichess.org/study/FSuRmT1t'), {
    studyId: 'FSuRmT1t',
    chapterId: null
  });
  assert.equal(parseStudyUrl('not a study'), null);
});

test('buildStudyPgnUrls prefers local proxy and preserves chapter id', () => {
  assert.deepEqual(buildStudyPgnUrls({ studyId: 'FSuRmT1t', chapterId: 'KABH4Dht' }), [
    '/lichess-study?study=FSuRmT1t&chapter=KABH4Dht',
    'https://lichess.org/api/study/FSuRmT1t/KABH4Dht.pgn',
    'https://lichess.org/study/FSuRmT1t/KABH4Dht.pgn'
  ]);
});

test('pieceAssetClass maps FEN pieces to board piece classes', () => {
  assert.equal(pieceAssetClass('K'), 'piece-wK');
  assert.equal(pieceAssetClass('q'), 'piece-bQ');
  assert.equal(pieceAssetClass(null), '');
});

test('boardSquareColor follows chessboard convention', () => {
  assert.equal(boardSquareColor('a1'), 'dark');
  assert.equal(boardSquareColor('h1'), 'light');
  assert.equal(boardSquareColor('a8'), 'light');
  assert.equal(boardSquareColor('h8'), 'dark');
});

test('board display orientation flips ranks and files for black training side', () => {
  assert.deepEqual(boardDisplayRanks('w'), [8, 7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(boardDisplayFiles('w'), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.deepEqual(boardDisplayRanks('b'), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(boardDisplayFiles('b'), ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
  assert.equal(normalizeBoardOrientation('b'), 'b');
  assert.equal(normalizeBoardOrientation('invalid'), 'w');
});

test('getLegalDestinationSquares returns legal targets for selected pieces', () => {
  assert.deepEqual(getLegalDestinationSquares('8/8/8/8/8/8/4P3/4K3 w - - 0 1', 'e2'), ['e3', 'e4']);
  assert.deepEqual(getLegalDestinationSquares('8/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4'), ['d5', 'e5']);
});

test('getPromotionChoicesForMove exposes all legal underpromotion choices', () => {
  const choices = getPromotionChoicesForMove('k7/4P3/8/8/8/8/8/4K3 w - - 0 1', 'e7', 'e8');

  assert.deepEqual(choices.map((choice) => choice.promotion), ['q', 'r', 'b', 'n']);
  assert.deepEqual(choices.map((choice) => choice.uci), ['e7e8q', 'e7e8r', 'e7e8b', 'e7e8n']);
});

test('boardInputReducer switches selected pieces and attempts destinations', () => {
  const canSelect = (square) => ['e2', 'g1'].includes(square);

  assert.deepEqual(boardInputReducer(null, 'e2', canSelect), { selected: 'e2', attempt: null });
  assert.deepEqual(boardInputReducer('e2', 'g1', canSelect), { selected: 'g1', attempt: null });
  assert.deepEqual(boardInputReducer('e2', 'e2', canSelect), { selected: null, attempt: null });
  assert.deepEqual(boardInputReducer('e2', 'e4', canSelect), { selected: null, attempt: { from: 'e2', to: 'e4' } });
});

test('formatEndgameSourceLabel names examples and exercises distinctly', () => {
  assert.equal(formatEndgameSourceLabel({ example: 95 }), '例 95');
  assert.equal(formatEndgameSourceLabel({ exercise: '4.1' }), '练习 4.1');
  assert.equal(formatEndgameSourceLabel(null), '');
});

test('formatEndgameSourceLine hides PDF book and page details', () => {
  const line = formatEndgameSourceLine({
    book: 'Mastering Complex Endgames',
    game: 'Capablanca-Janowski, New York 1913',
    example: 95,
    pdfPage: 124,
    bookPage: 116
  });

  assert.equal(line, 'Capablanca-Janowski, New York 1913 · 例 95');
  assert.doesNotMatch(line, /PDF|p\.|124|116|Mastering Complex Endgames/);
});

test('upsertStudyRecord avoids duplicate identical PGN content', () => {
  const first = createStudyRecord({
    pgn: '[Event "A"]\n\n1. e4 e5 *',
    name: 'A',
    sourceKey: 'content:one'
  });
  const duplicate = createStudyRecord({
    pgn: '[Event "A"]\n\n1. e4 e5 *',
    name: 'A copy',
    sourceKey: 'content:one'
  });
  const result = upsertStudyRecord([first], duplicate);
  assert.equal(result.records.length, 1);
  assert.equal(result.action, 'duplicate');
  assert.equal(result.records[0].name, 'A');
});

test('upsertStudyRecord overwrites same source when PGN content changes', () => {
  const first = createStudyRecord({
    pgn: '[Event "A"]\n\n1. e4 e5 *',
    name: 'My name',
    sourceKey: 'lichess:FSuRmT1t/KABH4Dht'
  });
  const changed = createStudyRecord({
    pgn: '[Event "A"]\n\n1. e4 c5 *',
    name: 'Imported name',
    sourceKey: 'lichess:FSuRmT1t/KABH4Dht'
  });
  const result = upsertStudyRecord([first], changed);
  assert.equal(result.records.length, 1);
  assert.equal(result.action, 'updated');
  assert.equal(result.records[0].name, 'My name');
  assert.match(result.records[0].pgn, /c5/);
});

test('appendStudyRecord combines new PGN with the active study without mutating originals', () => {
  const first = createStudyRecord({
    pgn: '[Event "A"]\n\n1. e4 e5 *',
    name: 'My prep',
    sourceKey: 'lichess:study-a'
  });
  const result = appendStudyRecord([first], first.id, '[Event "B"]\n\n1. d4 d5 *', '粘贴 PGN');

  assert.equal(result.action, 'appended');
  assert.equal(result.records.length, 1);
  assert.equal(result.record.id, first.id);
  assert.equal(result.record.name, 'My prep');
  assert.match(result.record.pgn, /\[Event "A"\]/);
  assert.match(result.record.pgn, /\[Event "B"\]/);
  assert.notEqual(result.record.contentHash, first.contentHash);
  assert.equal(first.pgn, '[Event "A"]\n\n1. e4 e5 *');
});

test('upsertStudyRecord adds different content as a new saved study', () => {
  const first = createStudyRecord({
    pgn: '[Event "A"]\n\n1. e4 e5 *',
    name: 'A',
    sourceKey: 'content:a'
  });
  const second = createStudyRecord({
    pgn: '[Event "B"]\n\n1. d4 d5 *',
    name: 'B',
    sourceKey: 'content:b'
  });
  const result = upsertStudyRecord([first], second);
  assert.equal(result.records.length, 2);
  assert.equal(result.action, 'added');
});

test('splitPgnGames separates chapters by Event headers', () => {
  const pgn = `[Event "Chapter 1"]\n\n1. e4 e5\n\n[Event "Chapter 2"]\n\n1. d4 d5`;
  const games = splitPgnGames(pgn);
  assert.equal(games.length, 2);
  assert.match(games[0], /Chapter 1/);
  assert.match(games[1], /Chapter 2/);
});

test('tokenizePgnMovetext keeps moves and variation markers', () => {
  const tokens = tokenizePgnMovetext('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *');
  assert.deepEqual(tokens, ['e4', 'e5', '(', 'c5', 'Nf3', ')', 'Nf3']);
});

test('replayPgnGame returns headers and legal position timeline without comments', () => {
  const game = `[Event "Timeline"]\n[White "Alpha"]\n[Black "Beta"]\n[Result "1-0"]\n\n1. e4 {comment} e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;
  const replay = replayPgnGame(game);

  assert.equal(replay.headers.Event, 'Timeline');
  assert.equal(replay.headers.White, 'Alpha');
  assert.equal(replay.moves.length, 6);
  assert.deepEqual(replay.moves.map((move) => move.uci), ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']);
  assert.equal(replay.moves[0].beforeFen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
  assert.equal(replay.moves[5].ply, 6);
});

test('createTrainerFromPgn includes main line and variation replies', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 (1... c5) 2. Nf3 *');
  const afterE4 = applyPreparedMove(trainer, trainer.rootFen, 'e2e4');
  const replies = getCandidateMoves(trainer, afterE4).map((move) => move.uci).sort();
  assert.deepEqual(replies, ['c7c5', 'e7e5']);
});

test('applyPreparedMove rejects moves outside the repertoire', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 *');
  assert.throws(() => applyPreparedMove(trainer, trainer.rootFen, 'd2d4'), /not in repertoire/);
});

test('chooseOpponentMove uses provided random function', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 (1... c5) *');
  const afterE4 = applyPreparedMove(trainer, trainer.rootFen, 'e2e4');
  assert.equal(chooseOpponentMove(trainer, afterE4, () => 0).uci, 'e7e5');
  assert.equal(chooseOpponentMove(trainer, afterE4, () => 0.99).uci, 'c7c5');
});

test('getOpponentBranchDecision asks the user to choose when opponent replies branch', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 (1... c5) 2. Nf3 *');
  const afterE4 = applyPreparedMove(trainer, trainer.rootFen, 'e2e4');
  const branch = getOpponentBranchDecision(trainer, afterE4);

  assert.equal(branch.mode, 'choose');
  assert.deepEqual(branch.moves.map((move) => move.uci).sort(), ['c7c5', 'e7e5']);

  const afterE5 = applyPreparedMove(trainer, afterE4, 'e7e5');
  const single = getOpponentBranchDecision(trainer, afterE5);
  assert.equal(single.mode, 'auto');
  assert.equal(single.move.uci, 'g1f3');

  assert.deepEqual(getOpponentBranchDecision(trainer, applyPreparedMove(trainer, afterE5, 'g1f3')), {
    mode: 'done',
    move: null,
    moves: []
  });
});

test('board move matching accepts opponent branch choices from board input', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 (1... c5) 2. Nf3 *');
  const afterE4 = applyPreparedMove(trainer, trainer.rootFen, 'e2e4');
  const branch = getOpponentBranchDecision(trainer, afterE4);

  assert.equal(findPreparedMoveFromSquares(afterE4, 'e7', 'e5', branch.moves).uci, 'e7e5');
  assert.equal(findPreparedMoveFromSquares(afterE4, 'c7', 'c5', branch.moves).uci, 'c7c5');
  assert.equal(findPreparedMoveFromSquares(afterE4, 'g8', 'f6', branch.moves), null);
});

test('completed opening variation subtrees are filtered from future choices', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *');
  const afterE4 = applyPreparedMove(trainer, trainer.rootFen, 'e2e4');
  const afterE5 = applyPreparedMove(trainer, afterE4, 'e7e5');
  const afterNf3 = applyPreparedMove(trainer, afterE5, 'g1f3');
  const completedTerminal = applyPreparedMove(trainer, afterNf3, 'b8c6');
  const completed = new Set([completedTerminal]);

  assert.deepEqual(
    getAvailableCandidateMoves(trainer, afterE4, completed).map((move) => move.uci),
    ['c7c5']
  );
  assert.equal(chooseOpponentMove(trainer, afterE4, () => 0, completed).uci, 'c7c5');

  const branch = getOpponentBranchDecision(trainer, afterE4, completed);
  assert.equal(branch.mode, 'auto');
  assert.equal(branch.move.uci, 'c7c5');
});

test('random opening practice can still select completed variation candidates', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *');
  const afterE4 = applyPreparedMove(trainer, trainer.rootFen, 'e2e4');
  const afterE5 = applyPreparedMove(trainer, afterE4, 'e7e5');
  const afterNf3 = applyPreparedMove(trainer, afterE5, 'g1f3');
  const completedTerminal = applyPreparedMove(trainer, afterNf3, 'b8c6');
  const completed = new Set([completedTerminal]);

  assert.deepEqual(
    getAvailableCandidateMoves(trainer, afterE4, completed).map((move) => move.uci),
    ['c7c5']
  );
  assert.equal(chooseRandomCandidateMove(trainer, afterE4, () => 0).uci, 'e7e5');
});

test('current opening movetext is formatted as PGN and can rewind to previous user turn', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 2. Nf3 Nc6 *');
  const e4 = getCandidateMoves(trainer, trainer.rootFen).find((move) => move.uci === 'e2e4');
  const e5 = getCandidateMoves(trainer, e4.nextFen).find((move) => move.uci === 'e7e5');
  const nf3 = getCandidateMoves(trainer, e5.nextFen).find((move) => move.uci === 'g1f3');
  const nc6 = getCandidateMoves(trainer, nf3.nextFen).find((move) => move.uci === 'b8c6');
  const history = [
    { ...e4, byUser: true },
    { ...e5, byUser: false },
    { ...nf3, byUser: true },
    { ...nc6, byUser: false }
  ];

  assert.equal(formatMoveHistoryPgn(history), '1. e4 e5 2. Nf3 Nc6');

  const rewind = rewindMoveHistoryToPreviousTurn(history, trainer.rootFen, 'w');
  assert.equal(rewind.currentFen, e5.nextFen);
  assert.equal(rewind.moveHistory.length, 2);
  assert.deepEqual(rewind.redoMoves.map((move) => move.uci), ['g1f3', 'b8c6']);
  assert.deepEqual(rewind.lastMove, { from: 'e7', to: 'e5' });

  const restored = restoreMoveHistorySegment(rewind.moveHistory, rewind.redoMoves);
  assert.equal(restored.currentFen, nc6.nextFen);
  assert.equal(restored.moveHistory.length, 4);
  assert.deepEqual(restored.lastMove, { from: 'b8', to: 'c6' });
});

test('prep movetext can rewind one ply at a time while preserving redo order', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 c5 2. c3 d5 *');
  const e4 = getCandidateMoves(trainer, trainer.rootFen).find((move) => move.uci === 'e2e4');
  const c5 = getCandidateMoves(trainer, e4.nextFen).find((move) => move.uci === 'c7c5');
  const c3 = getCandidateMoves(trainer, c5.nextFen).find((move) => move.uci === 'c2c3');
  const d5 = getCandidateMoves(trainer, c3.nextFen).find((move) => move.uci === 'd7d5');
  const history = [
    { ...e4, byUser: true },
    { ...c5, byUser: false },
    { ...c3, byUser: true },
    { ...d5, byUser: false }
  ];

  const backOne = rewindMoveHistoryOnePly(history, trainer.rootFen);
  assert.equal(backOne.currentFen, c3.nextFen);
  assert.deepEqual(backOne.moveHistory.map((move) => move.uci), ['e2e4', 'c7c5', 'c2c3']);
  assert.deepEqual(backOne.redoMoves.map((move) => move.uci), ['d7d5']);
  assert.deepEqual(backOne.lastMove, { from: 'c2', to: 'c3' });

  const backTwo = rewindMoveHistoryOnePly(backOne.moveHistory, trainer.rootFen, backOne.redoMoves);
  assert.equal(backTwo.currentFen, c5.nextFen);
  assert.deepEqual(backTwo.moveHistory.map((move) => move.uci), ['e2e4', 'c7c5']);
  assert.deepEqual(backTwo.redoMoves.map((move) => move.uci), ['c2c3', 'd7d5']);
});

test('prep explorer rows follow the current board fen with move stats', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 c5 2. c3 d5 *');
  const e4 = getCandidateMoves(trainer, trainer.rootFen).find((move) => move.uci === 'e2e4');
  const report = {
    explorer: {
      nodes: {
        [trainer.rootFen]: {
          total: 3,
          moves: [
            { uci: 'e2e4', count: 3, scoreRate: 0.5, nextFen: e4.nextFen }
          ]
        },
        [e4.nextFen]: {
          total: 3,
          moves: [
            { uci: 'c7c5', count: 2, scoreRate: 0.75 },
            { uci: 'e7e6', count: 1, scoreRate: 0 }
          ]
        }
      }
    }
  };

  const rootRows = getPrepExplorerRows(report, trainer.rootFen);
  assert.deepEqual(rootRows.map((row) => row.uci), ['e2e4']);
  assert.equal(rootRows[0].san, 'e4');
  assert.equal(rootRows[0].share, 1);
  assert.equal(rootRows[0].scoreRate, 0.5);

  const replyRows = getPrepExplorerRows(report, e4.nextFen);
  assert.deepEqual(replyRows.map((row) => row.uci), ['c7c5', 'e7e6']);
  assert.equal(replyRows[0].san, 'c5');
  assert.equal(replyRows[0].count, 2);
  assert.equal(replyRows[0].share, 2 / 3);
  assert.equal(replyRows[1].san, 'e6');
});

test('prep explorer rows prefer focused decision moves at the current report scope', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 c5 2. c3 d5 *');
  const e4 = getCandidateMoves(trainer, trainer.rootFen).find((move) => move.uci === 'e2e4');
  const report = {
    decision: {
      fen: e4.nextFen,
      moves: [
        {
          uci: 'c7c5',
          san: 'c5',
          count: 7,
          total: 10,
          share: 0.7,
          scoreRate: 0.42,
          autoReply: { uci: 'c2c3', san: 'c3' }
        }
      ]
    },
    explorer: {
      nodes: {
        [e4.nextFen]: {
          total: 2,
          moves: [{ uci: 'e7e5', count: 2, scoreRate: 0.5 }]
        }
      }
    }
  };

  const rows = getPrepExplorerRows(report, e4.nextFen);

  assert.deepEqual(rows.map((row) => row.uci), ['c7c5']);
  assert.equal(rows[0].share, 0.7);
  assert.equal(rows[0].autoReply.san, 'c3');
});

test('completed opening line pauses on the final position before continuing', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 *');
  const e4 = getCandidateMoves(trainer, trainer.rootFen).find((move) => move.uci === 'e2e4');
  const e5 = getCandidateMoves(trainer, e4.nextFen).find((move) => move.uci === 'e7e5');
  const history = [
    { ...e4, byUser: true },
    { ...e5, byUser: false }
  ];

  const action = getOpeningLineCompletionAction({
    trainer,
    currentFen: e5.nextFen,
    moveHistory: history,
    completedTerminalFens: new Set()
  });

  assert.equal(action.mode, 'pause');
  assert.equal(action.pgn, '1. e4 e5');
  assert.equal(action.terminalFen, e5.nextFen);
  assert.match(action.message, /停在最终局面/);
});

test('createTrainerFromPgn handles common opening piece moves and multiple chapters', () => {
  const pgn = `[Event "Italian preparation"]\n\n1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 3. Bc4 Bc5 (3... Nf6 4. d3) 4. c3 Nf6 *\n\n[Event "Queen's Gambit note"]\n\n1. d4 d5 2. c4 e6 (2... c6) 3. Nc3 Nf6 *`;
  const trainer = createTrainerFromPgn(pgn);
  assert.equal(trainer.errors.length, 0);
  assert.equal(trainer.chapters.length, 2);
  assert.ok(trainer.moveCount >= 17);
});

test('listEngineProfiles keeps public humanized labels while calibrating strength 200 Elo higher', () => {
  const profiles = listEngineProfiles();
  assert.deepEqual(profiles.map((profile) => profile.id), [
    'stockfish-strong',
    'human-2200',
    'human-2400',
    'human-2600',
    'human-2700'
  ]);
  assert.deepEqual(
    ['human-2200', 'human-2400', 'human-2600', 'human-2700'].map((id) => getEngineProfile(id).estimatedElo),
    [2200, 2400, 2600, 2700]
  );
  assert.deepEqual(
    ['human-2200', 'human-2400', 'human-2600', 'human-2700'].map((id) => getEngineProfile(id).calibratedElo),
    [2400, 2600, 2800, 2900]
  );
  assert.deepEqual(
    ['human-2200', 'human-2400', 'human-2600', 'human-2700'].map((id) => getEngineProfile(id).label),
    ['拟人 2200', '拟人 2400', '拟人 2600', '近似 2700']
  );
  assert.equal(getEngineProfile('missing'), null);
});

test('Maia profiles use tighter sampling as Elo rises', () => {
  assert.deepEqual(
    ['human-2200', 'human-2400', 'human-2600'].map((id) => {
      const profile = getEngineProfile(id);
      return [profile.maiaTemperature, profile.maiaTopP];
    }),
    [
      [0.7, 0.65],
      [0.22, 0.35],
      [0.08, 0.18]
    ]
  );
});

test('humanized profiles spend more time searching for sparring moves', () => {
  assert.ok(getEngineProfile('human-2200').searchMoveTimeMs >= 3000);
  assert.ok(getEngineProfile('human-2400').searchMoveTimeMs >= 4200);
  assert.ok(getEngineProfile('human-2600').searchMoveTimeMs >= 6000);
  assert.ok(getEngineProfile('human-2700').searchMoveTimeMs >= 14000);
});

test('engine training can start from opening or endgame positions without an imported study', () => {
  assert.equal(canStartEngineTraining({ mode: 'opening', trainer: null }), true);
  assert.equal(canStartEngineTraining({ mode: 'opening', trainer: { moveCount: 1 } }), true);
  assert.equal(canStartEngineTraining({ mode: 'endgame', trainer: null }), true);
});

test('parseUciInfoLines reads multipv scores and principal variations', () => {
  const lines = [
    'info depth 12 seldepth 18 multipv 1 score cp 42 nodes 123 pv e2e4 e7e5',
    'info depth 12 multipv 2 score cp 18 pv d2d4 d7d5',
    'info depth 12 multipv 3 score mate -2 pv g1f3'
  ];
  assert.deepEqual(parseUciInfoLines(lines), [
    { multipv: 1, scoreCp: 42, mate: null, move: 'e2e4', pv: ['e2e4', 'e7e5'] },
    { multipv: 2, scoreCp: 18, mate: null, move: 'd2d4', pv: ['d2d4', 'd7d5'] },
    { multipv: 3, scoreCp: -200000, mate: -2, move: 'g1f3', pv: ['g1f3'] }
  ]);
});

test('parseUciBestMove reads normal bestmove lines and ignores no-move output', () => {
  assert.equal(parseUciBestMove('bestmove e2e4 ponder e7e5'), 'e2e4');
  assert.equal(parseUciBestMove('info string ready\nbestmove 0000'), null);
});

test('pickHumanizedEngineMove keeps strong mode deterministic and widens humanized choices', () => {
  const candidates = [
    { move: 'e2e4', scoreCp: 42 },
    { move: 'd2d4', scoreCp: 28 },
    { move: 'c2c4', scoreCp: 5 },
    { move: 'g2g4', scoreCp: -180 }
  ];
  assert.equal(pickHumanizedEngineMove(candidates, getEngineProfile('stockfish-strong'), () => 0.99), 'e2e4');
  assert.equal(pickHumanizedEngineMove(candidates, { mode: 'humanized-stockfish', toleranceCp: 80 }, () => 0.99), 'c2c4');
  assert.equal(pickHumanizedEngineMove(candidates, { mode: 'humanized-stockfish', toleranceCp: 80, stockfishCandidateLimit: 2 }, () => 0.99), 'd2d4');
  assert.equal(pickHumanizedEngineMove(candidates, getEngineProfile('human-2200'), () => 0.99), 'e2e4');
});

test('top humanized Stockfish profile is strict and never samples inferior candidates', () => {
  const candidates = [
    { move: 'e2e4', scoreCp: 42 },
    { move: 'd2d4', scoreCp: 41 },
    { move: 'c2c4', scoreCp: 40 }
  ];
  const profile = getEngineProfile('human-2700');

  assert.equal(profile.strictEngineMove, true);
  assert.equal(profile.forceBestMove, true);
  assert.equal(profile.disableOpeningPrior, true);
  assert.ok(profile.depth >= 24);
  assert.equal(profile.stockfishCandidateLimit, 1);
  assert.equal(profile.toleranceCp, 0);
  assert.equal(pickHumanizedEngineMove(candidates, profile, () => 0.99), 'e2e4');
});

test('selectEngineReplyMove honors a server-side opening prior before client humanized sampling', () => {
  const candidates = [
    { move: 'e2e4', scoreCp: 42 },
    { move: 'd2d4', scoreCp: 28 },
    { move: 'c2c4', scoreCp: 5 }
  ];
  const profile = { mode: 'humanized-stockfish', toleranceCp: 80 };

  assert.equal(
    selectEngineReplyMove({
      payload: { engine: 'stockfish', bestmove: 'e2e4', openingPrior: { source: 'opening-prior' } },
      candidates,
      profile,
      random: () => 0.99
    }),
    'e2e4'
  );
  assert.equal(
    selectEngineReplyMove({
      payload: { engine: 'stockfish', bestmove: 'e2e4' },
      candidates,
      profile,
      random: () => 0.99
    }),
    'c2c4'
  );
});

test('playLegalUciMove applies legal UCI moves from a normalized FEN', () => {
  const result = playLegalUciMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', 'e2e4');
  assert.equal(result.move.uci, 'e2e4');
  assert.equal(result.move.san, 'e4');
  assert.equal(result.nextFen, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
});

test('parseEngineErrorPayload explains plain text 404 responses', () => {
  assert.equal(
    parseEngineErrorPayload('Not found', 404, 'text/plain; charset=utf-8'),
    '引擎接口不存在。请关闭旧页面/旧服务器后重新用桌面快捷方式启动。'
  );
  assert.equal(
    parseEngineErrorPayload('{"error":"boom"}', 503, 'application/json; charset=utf-8'),
    'boom'
  );
});
