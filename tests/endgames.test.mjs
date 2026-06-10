import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  advanceEndgameStep,
  createEndgameSession,
  getEndgameCategories,
  getEndgameLesson,
  listEndgameLessons
} from '../endgames.js';
import { playLegalUciMove, replayPgnGame, splitPgnGames } from '../app.js';

test('endgame library exposes a focused first course', () => {
  const categories = getEndgameCategories();
  const lessons = listEndgameLessons();
  const publicSourceIds = new Set(['pgnmentor-files', 'lichess-broadcast-db']);
  const publicPgnLessons = lessons.filter((lesson) => publicSourceIds.has(lesson.sourceId));

  assert.ok(categories.length <= 12);
  assert.ok(lessons.length >= 300);
  assert.ok(categories.some((category) => category.id === 'rook-activity'));
  assert.ok(categories.some((category) => category.id === 'single-rook-defense'));
  assert.ok(categories.some((category) => category.id === 'rook-minor-activity'));
  assert.ok(categories.some((category) => category.id === 'queen-endgames'));
  assert.ok(categories.every((category) => lessons.some((lesson) => lesson.category === category.id)));
  assert.ok(lessons.every((lesson) => lesson.id && lesson.title && lesson.fen && lesson.steps.length));
  assert.equal(publicPgnLessons.length, lessons.length);
  assert.ok(lessons.every((lesson) => lesson.source.white && lesson.source.black && lesson.source.event && lesson.source.date));

  const ids = new Set(lessons.map((lesson) => lesson.id));
  assert.equal(ids.size, lessons.length);
  const sourceKeys = new Set(
    lessons.map((lesson) => `${lesson.sourceCandidateId ?? lesson.source.example ?? lesson.source.exercise}|${lesson.sourceGameId ?? lesson.source.game}`)
  );
  assert.equal(sourceKeys.size, lessons.length);
  assert.ok(lessons.every((lesson) => ['w', 'b'].includes(lesson.orientation)));
  assert.ok(lessons.every((lesson) => lesson.orientation === lesson.fen.split(/\s+/)[1]));

  const startingTasks = new Set(lessons.map((lesson) => `${lesson.fen}|${lesson.steps[0].move}`));
  assert.equal(startingTasks.size, lessons.length);
  assert.ok(lessons.some((lesson) => lesson.orientation === 'b'));
});

test('existing strict course order is preserved before appended category fills', () => {
  const prefixIds = JSON.parse(readFileSync(join('tests', 'endgame-prefix-ids.json'), 'utf8'));
  const lessons = listEndgameLessons();
  const appended = lessons.slice(prefixIds.length);

  assert.deepEqual(lessons.slice(0, prefixIds.length).map((lesson) => lesson.id), prefixIds);
  assert.ok(appended.length > 0, 'expected appended category-fill lessons after the original course');
  assert.ok(
    appended.every((lesson) => ['queen-endgames', 'single-rook-defense'].includes(lesson.category)),
    'appended lessons must only fill the requested sparse categories'
  );
});

test('requested sparse categories are filled without moving existing lessons', () => {
  const categoryCounts = Object.fromEntries(
    getEndgameCategories().map((category) => [category.id, listEndgameLessons(category.id).length])
  );

  assert.ok(categoryCounts['queen-endgames'] >= 15, `queen-endgames has only ${categoryCounts['queen-endgames'] || 0} lessons`);
  assert.ok(categoryCounts['single-rook-defense'] >= 15, `single-rook-defense has only ${categoryCounts['single-rook-defense'] || 0} lessons`);
});

test('every official endgame lesson declares a strict training target aligned with the real result', () => {
  const publicSourceIds = new Set(['pgnmentor-files', 'lichess-broadcast-db']);
  for (const lesson of listEndgameLessons()) {
    assert.ok(['win', 'draw'].includes(lesson.trainingTarget), `${lesson.id} missing trainingTarget`);
    assert.ok(['1-0', '0-1', '1/2-1/2'].includes(lesson.source?.result), `${lesson.id} missing real source result`);
    assert.ok(publicSourceIds.has(lesson.sourceId), `${lesson.id} must come from a verified public PGN source`);

    if (lesson.trainingTarget === 'win') {
      const winner = lesson.source.result === '1-0' ? 'w' : lesson.source.result === '0-1' ? 'b' : null;
      assert.equal(lesson.orientation, winner, `${lesson.id} win target must train the eventual winner`);
      assert.match(lesson.trainingTargetLabel || lesson.goal || '', /赢棋|赢/);
    } else {
      assert.equal(lesson.source.result, '1/2-1/2', `${lesson.id} draw target must end in a real draw`);
      assert.match(lesson.trainingTargetLabel || lesson.goal || '', /守和|和/);
    }
  }
});

test('every official endgame lesson has verifiable 2650+ classical source evidence', () => {
  for (const lesson of listEndgameLessons()) {
    assert.ok(Number.isInteger(lesson.source?.whiteElo), `${lesson.id} missing WhiteElo evidence`);
    assert.ok(Number.isInteger(lesson.source?.blackElo), `${lesson.id} missing BlackElo evidence`);
    assert.ok(lesson.source.whiteElo >= 2650, `${lesson.id} white Elo is below 2650`);
    assert.ok(lesson.source.blackElo >= 2650, `${lesson.id} black Elo is below 2650`);
    assert.doesNotMatch(lesson.source?.event || '', /rapid|blitz|bullet|online|internet|armageddon|play-in|showdown/i, `${lesson.id} is not a classical event`);
    assert.match(lesson.source?.timeControl || '', /40\/|7200|90|Classical/i, `${lesson.id} missing classical time-control evidence`);
    assert.equal(lesson.source?.variant || 'Standard', 'Standard', `${lesson.id} must be a standard chess game`);
    assert.ok(Number.isFinite(lesson.audit?.startEvalCp), `${lesson.id} missing start evaluation`);
    assert.ok(Number.isInteger(lesson.audit?.engineDepth) && lesson.audit.engineDepth >= 12, `${lesson.id} missing engine depth evidence`);
  }
});

test('official endgame course records unproven 2650+ requirements as audit gaps instead of claiming them', () => {
  const lessons = listEndgameLessons();

  assert.ok(lessons.every((lesson) => lesson.audit?.manualGmReviewStatus === 'not-verified-locally'));
  assert.ok(lessons.every((lesson) => lesson.audit?.deepLineVerificationStatus === 'not-verified-locally'));
  assert.ok(lessons.every((lesson) => Array.isArray(lesson.audit?.unverifiedRequirements)));
  assert.ok(lessons.every((lesson) => lesson.audit.unverifiedRequirements.includes('2600+ GM manual review')));
  assert.ok(lessons.every((lesson) => lesson.audit.unverifiedRequirements.includes('Stockfish 40-50 ply full-line verification')));
});

test('official endgame course uses complete source dates with no placeholder metadata', () => {
  const completeDate = /^\d{4}\.\d{2}\.\d{2}$/;

  for (const lesson of listEndgameLessons()) {
    assert.match(lesson.source?.date || '', completeDate, `${lesson.id} has incomplete source date`);
    assert.doesNotMatch(lesson.sourceGameId || '', /\?\?|unknown/i, `${lesson.id} sourceGameId contains placeholder metadata`);
    assert.doesNotMatch(lesson.playerQualityReason || '', /\?\?|unknown/i, `${lesson.id} quality reason contains placeholder metadata`);
    assert.doesNotMatch(lesson.source?.game || '', /\?\?|unknown/i, `${lesson.id} source label contains placeholder metadata`);
  }
});

test('draw-target lessons must start from a genuinely difficult defensive position', () => {
  const drawLessons = listEndgameLessons().filter((lesson) => lesson.trainingTarget === 'draw');

  assert.ok(drawLessons.length > 0, 'course should include at least one strict defensive draw task');
  for (const lesson of drawLessons) {
    assert.ok(Number.isFinite(lesson.audit?.sourceScoreCp), `${lesson.id} missing source evaluation`);
    assert.ok(lesson.audit.sourceScoreCp <= -80, `${lesson.id} is too close to equality for a defensive draw task`);
    assert.ok(lesson.audit.sourceScoreCp >= -180, `${lesson.id} is too decisive for a "near miss" draw task`);
    assert.ok(lesson.audit.defensivePressureCp >= 80, `${lesson.id} missing defensive pressure audit`);
    assert.ok(lesson.audit.defensivePressureCp <= 180, `${lesson.id} defensive pressure is outside the near-miss range`);
    assert.match(lesson.trainingTargetReason || '', /压力|差一点|-80/, `${lesson.id} should explain why this is a pressure draw`);
  }
});

test('official endgame course rejects first-move queen wipeout transition tasks', () => {
  const queenCategories = new Set(['queen-endgames', 'queen-minor-endgames']);

  for (const lesson of listEndgameLessons()) {
    if (!queenCategories.has(lesson.audit?.sourceCategory)) continue;
    if (queenCategories.has(lesson.category)) continue;

    const afterFirstMove = playLegalUciMove(lesson.fen, lesson.steps[0].move).nextFen;
    assert.ok(
      queenCount(afterFirstMove) > 0,
      `${lesson.id} starts as ${lesson.audit.sourceCategory}, but the first move removes the queen and collapses into ${lesson.category}`
    );
  }
});

test('default endgame demo lesson is a high-quality complex position', () => {
  const appSource = readFileSync('app.js', 'utf8');
  const defaultLessonId = appSource.match(/lessonId:\s*'([^']+)'/)?.[1];
  const lesson = getEndgameLesson(defaultLessonId);
  const queenCategories = new Set(['queen-endgames', 'queen-minor-endgames']);

  assert.ok(lesson, 'app.js default endgame lesson must exist in the official course');
  assert.match(lesson.source?.date || '', /^\d{4}\.\d{2}\.\d{2}$/);
  assert.ok(Number(lesson.complexityScore) >= 9, `${lesson.id} should be a high-complexity demo`);

  if (queenCategories.has(lesson.audit?.sourceCategory) && !queenCategories.has(lesson.category)) {
    const afterFirstMove = playLegalUciMove(lesson.fen, lesson.steps[0].move).nextFen;
    assert.ok(
      queenCount(afterFirstMove) > 0,
      `${lesson.id} is not suitable as the demo because the first move removes the queen and collapses the task`
    );
  }
});

test('queen endgame labels require queens to survive the opening tactical transition', () => {
  const queenCategories = new Set(['queen-endgames', 'queen-minor-endgames']);

  for (const lesson of listEndgameLessons()) {
    if (!queenCategories.has(lesson.category)) continue;
    const afterFirstMove = playLegalUciMove(lesson.fen, lesson.steps[0].move).nextFen;
    const afterFirstPair = lesson.steps[0].reply
      ? playLegalUciMove(afterFirstMove, lesson.steps[0].reply).nextFen
      : afterFirstMove;

    assert.ok(
      queenCount(afterFirstMove) > 0,
      `${lesson.id} is labelled ${lesson.category}, but the queen disappears on the first training move`
    );
    assert.ok(
      queenCount(afterFirstPair) > 0,
      `${lesson.id} is labelled ${lesson.category}, but the queen disappears during the first move pair`
    );
  }
});

test('material-specific endgame labels match the first move-pair material', () => {
  for (const lesson of listEndgameLessons()) {
    const afterFirstMove = playLegalUciMove(lesson.fen, lesson.steps[0].move).nextFen;
    const afterFirstPair = lesson.steps[0].reply
      ? playLegalUciMove(afterFirstMove, lesson.steps[0].reply).nextFen
      : afterFirstMove;

    assertCategoryFitsTransition(lesson.category, afterFirstMove, lesson.id, 'first training move');
    assertCategoryFitsTransition(lesson.category, afterFirstPair, lesson.id, 'first move pair');
  }
});

test('reclassified endgame lessons rebuild category-sensitive analysis text', () => {
  const reclassified = listEndgameLessons().filter((lesson) => lesson.audit?.sourceCategory !== lesson.category);

  assert.ok(reclassified.length > 0, 'course should record material-based category corrections');
  for (const lesson of reclassified) {
    assert.equal(lesson.audit.analysisUsed, false, `${lesson.id} should not reuse analysis written for ${lesson.audit.sourceCategory}`);
    assert.equal(
      lesson.audit.analysisRebuiltForEffectiveCategory,
      true,
      `${lesson.id} should regenerate teaching text for ${lesson.category}`
    );
  }
});

test('PGN source lessons must follow the real game continuation exactly', {
  skip: rawPgnSourceSkipReason()
}, () => {
  const pgnLessons = listEndgameLessons().filter((lesson) => ['pgnmentor-files', 'lichess-broadcast-db'].includes(lesson.sourceId));

  for (const lesson of pgnLessons) {
    const actual = lessonLineUcis(lesson);
    const expected = sourceGameLineUcis(lesson.sourceGameId, lesson.startPly, actual.length);
    assert.deepEqual(actual, expected, `${lesson.id} does not match its source PGN continuation`);
  }
});

test('PGN source lessons start at the real source position and continue to the game result', {
  skip: rawPgnSourceSkipReason()
}, () => {
  const pgnLessons = listEndgameLessons().filter((lesson) => ['pgnmentor-files', 'lichess-broadcast-db'].includes(lesson.sourceId));

  for (const lesson of pgnLessons) {
    const replay = sourceGameReplay(lesson);
    const actual = lessonLineUcis(lesson);
    const expected = replay.moves.slice(lesson.startPly).map((move) => move.uci);

    assert.equal(lesson.fen, replay.moves[lesson.startPly]?.beforeFen, `${lesson.id} FEN does not match source PGN start position`);
    assert.deepEqual(actual, expected, `${lesson.id} stops before the source PGN game result`);
  }
});

test('official endgame course excludes PGN candidates that still carry review placeholders', () => {
  const unreviewed = listEndgameLessons().filter((lesson) =>
    /requires final human quality review|Manual title\/rating verification required/i.test(lesson.playerQualityReason || '')
  );

  assert.deepEqual(unreviewed.map((lesson) => lesson.id), []);
});

test('endgame lessons do not split a main-line continuation into a new lesson', () => {
  const lessons = listEndgameLessons();
  const startingPositions = new Map(lessons.map((lesson) => [positionKey(lesson.fen), lesson]));

  for (const lesson of lessons) {
    let fen = lesson.fen;
    for (const step of lesson.steps) {
      fen = playLegalUciMove(fen, step.move).nextFen;
      assertNoOtherLessonStartsHere(startingPositions, lesson, fen);
      if (step.reply) {
        fen = playLegalUciMove(fen, step.reply).nextFen;
        assertNoOtherLessonStartsHere(startingPositions, lesson, fen);
      }
    }
  }
});

test('every endgame main line contains legal UCI moves from its FEN', () => {
  for (const lesson of listEndgameLessons()) {
    let fen = lesson.fen;
    for (const step of lesson.steps) {
      const user = playLegalUciMove(fen, step.move);
      fen = user.nextFen;
      if (step.reply) {
        const reply = playLegalUciMove(fen, step.reply);
        fen = reply.nextFen;
      }
    }
  }
});

test('every endgame lesson has structured original analysis text', () => {
  for (const lesson of listEndgameLessons()) {
    assert.ok(lesson.teaching?.principle?.length >= 35, `${lesson.id} principle is too short`);
    assert.ok(lesson.teaching?.method?.length >= 60, `${lesson.id} method is too short`);
    assert.ok(lesson.teaching?.mistake?.length >= 35, `${lesson.id} mistake is too short`);
    assert.ok(Array.isArray(lesson.hints) && lesson.hints.length >= 2, `${lesson.id} needs at least two hints`);
  }
});

function playLessonLine(lesson) {
  let fen = lesson.fen;
  let plies = 0;
  for (const step of lesson.steps) {
    const user = playLegalUciMove(fen, step.move);
    fen = user.nextFen;
    plies += 1;
    if (step.reply) {
      const reply = playLegalUciMove(fen, step.reply);
      fen = reply.nextFen;
      plies += 1;
    }
  }
  return { fen, plies };
}

function queenCount(fen) {
  return [...String(fen).split(/\s+/)[0]].filter((piece) => piece === 'Q' || piece === 'q').length;
}

function materialProfile(fen) {
  const placement = String(fen).split(/\s+/)[0];
  let queens = 0;
  let rooks = 0;
  let bishops = 0;
  let knights = 0;
  let pawns = 0;
  for (const piece of placement) {
    const upper = piece.toUpperCase();
    if (upper === 'Q') queens += 1;
    else if (upper === 'R') rooks += 1;
    else if (upper === 'B') bishops += 1;
    else if (upper === 'N') knights += 1;
    else if (upper === 'P') pawns += 1;
  }
  return {
    queens,
    rooks,
    bishops,
    knights,
    pawns,
    minors: bishops + knights
  };
}

function bishopSquareColors(fen) {
  const placement = String(fen).split(/\s+/)[0];
  const colors = { white: [], black: [] };
  let rank = 7;
  let file = 0;
  for (const piece of placement) {
    if (piece === '/') {
      rank -= 1;
      file = 0;
    } else if (/\d/.test(piece)) {
      file += Number(piece);
    } else {
      if (piece.toUpperCase() === 'B') {
        colors[piece === 'B' ? 'white' : 'black'].push((file + rank) % 2 === 0 ? 'dark' : 'light');
      }
      file += 1;
    }
  }
  return colors;
}

function hasOppositeColoredBishops(fen) {
  const colors = bishopSquareColors(fen);
  return colors.white.length === 1 && colors.black.length === 1 && colors.white[0] !== colors.black[0];
}

function assertCategoryFitsTransition(category, fen, lessonId, phase) {
  const profile = materialProfile(fen);
  if (category === 'queen-endgames') {
    assert.ok(profile.queens > 0, `${lessonId} is labelled queen-endgames, but no queen remains after the ${phase}`);
  } else if (category === 'queen-minor-endgames') {
    assert.ok(profile.queens > 0, `${lessonId} is labelled queen-minor-endgames, but no queen remains after the ${phase}`);
    assert.ok(profile.minors > 0, `${lessonId} is labelled queen-minor-endgames, but no minor piece remains after the ${phase}`);
  } else if (category === 'rook-activity') {
    assert.ok(profile.rooks >= 2, `${lessonId} is labelled rook-activity, but fewer than two rooks remain after the ${phase}`);
  } else if (category === 'single-rook-defense') {
    assert.ok(
      profile.rooks === 1 || (profile.rooks === 2 && profile.queens + profile.minors === 0),
      `${lessonId} is labelled single-rook-defense, but it is not a pure single-rook defensive position after the ${phase}`
    );
  } else if (category === 'rook-minor-activity' || category === 'rook-bishop-knight') {
    assert.ok(profile.rooks > 0, `${lessonId} is labelled ${category}, but no rook remains after the ${phase}`);
    assert.ok(profile.minors > 0, `${lessonId} is labelled ${category}, but no minor piece remains after the ${phase}`);
  } else if (category === 'opposite-bishop-initiative') {
    assert.ok(hasOppositeColoredBishops(fen), `${lessonId} is labelled opposite-bishop-initiative, but the opposite bishops are gone after the ${phase}`);
  } else if (category === 'king-activity') {
    assert.equal(profile.queens + profile.rooks + profile.minors, 0, `${lessonId} is labelled king-activity, but pieces remain after the ${phase}`);
  }
}

function lessonLineUcis(lesson) {
  const moves = [];
  for (const step of lesson.steps || []) {
    moves.push(step.move);
    if (step.reply) moves.push(step.reply);
  }
  return moves;
}

function sourceGameLineUcis(sourceGameId, startPly, length) {
  const replay = sourceGameReplay({ sourceGameId });
  return replay.moves.slice(startPly, startPly + length).map((move) => move.uci);
}

function rawPgnSourceSkipReason() {
  const lesson = listEndgameLessons().find((candidate) => ['pgnmentor-files', 'lichess-broadcast-db'].includes(candidate.sourceId));
  const pgnPath = lesson ? sourceGamePath(lesson.sourceGameId) : null;
  return pgnPath && existsSync(pgnPath) ? false : 'Raw public PGN source files are generated locally and are not committed.';
}

function sourceGamePath(sourceGameId) {
  const parts = String(sourceGameId || '').split('|');
  const fileName = parts[0];
  if (!fileName) return null;

  const playerFile = fileName.replace(/\.pgn$/i, '').toLowerCase();
  return /^lichess_db_broadcast_/i.test(fileName)
    ? join('data', 'endgame-expansion', 'sources', 'raw', 'lichess-broadcast-db', fileName)
    : join('data', 'endgame-expansion', 'sources', 'raw', `pgnmentor-${playerFile}`, fileName);
}

function sourceGameReplay(lesson) {
  const sourceGameId = lesson.sourceGameId;
  const parts = String(sourceGameId || '').split('|');
  const fileName = parts[0];
  const gameIndex = Number(parts[5]);
  assert.ok(fileName && Number.isInteger(gameIndex), `invalid sourceGameId ${sourceGameId}`);

  const pgnPath = sourceGamePath(sourceGameId);
  assert.ok(pgnPath, `invalid sourceGameId ${sourceGameId}`);
  const games = splitPgnGames(readFileSync(pgnPath, 'utf8'));
  return replayPgnGame(games[gameIndex - 1]);
}

function positionKey(fen) {
  return String(fen).trim().split(/\s+/).slice(0, 4).join(' ');
}

function assertNoOtherLessonStartsHere(startingPositions, sourceLesson, fen) {
  const duplicate = startingPositions.get(positionKey(fen));
  if (!duplicate || duplicate.id === sourceLesson.id) return;

  assert.fail(
    `${duplicate.id} starts from a continuation position inside ${sourceLesson.id}; merge the continuation into one lesson instead`
  );
}

test('createEndgameSession starts at the lesson position and checks moves step by step', () => {
  const lesson = getEndgameLesson(listEndgameLessons()[0].id);
  const session = createEndgameSession(lesson.id);

  assert.equal(session.lesson.id, lesson.id);
  assert.equal(session.currentFen, lesson.fen);
  assert.equal(session.completed, false);
  assert.equal(session.expectedMove, lesson.steps[0].move);

  const wrong = advanceEndgameStep(session, 'a1a1');
  assert.equal(wrong.ok, false);
  assert.equal(wrong.expectedMove, lesson.steps[0].move);
  assert.equal(wrong.session.stepIndex, 0);

  const right = advanceEndgameStep(session, lesson.steps[0].move);
  assert.equal(right.ok, true);
  assert.equal(right.played.move.uci, lesson.steps[0].move);
  assert.equal(right.session.stepIndex, 1);
});

test('advanceEndgameStep marks a lesson complete after the final solution move', () => {
  const lesson = getEndgameLesson(listEndgameLessons()[0].id);
  assert.ok(lesson);

  let session = createEndgameSession(lesson.id);
  while (!session.completed) {
    const result = advanceEndgameStep(session, session.expectedMove);
    assert.equal(result.ok, true);
    session = result.session;
  }

  assert.equal(session.completed, true);
  assert.equal(session.expectedMove, null);
});
