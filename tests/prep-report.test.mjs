import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildOfflineStoreFromPgn, loadOfflineStore } from '../tools/player-prep/offline-store.mjs';
import {
  buildOpponentOpeningTree,
  buildPrepReport,
  normalizePlayerName
} from '../tools/player-prep/prep-report.mjs';
import { playLegalUciMove } from '../app.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'chessprep-report-'));
}

const opponentGames = `[Event "Sicilian Loss"]
[Date "2024.01.01"]
[White "Target GM"]
[Black "Other GM"]
[Result "0-1"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 c5 2. Nf3 d6 0-1

[Event "Sicilian Draw"]
[Date "2024.01.02"]
[White "Target GM"]
[Black "Other GM"]
[Result "1/2-1/2"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 c5 2. Nf3 d6 1/2-1/2

[Event "Caro Rare"]
[Date "2024.01.03"]
[White "Target GM"]
[Black "Other GM"]
[Result "1-0"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 c6 2. d4 d5 1-0

[Event "Opponent As Black"]
[Date "2024.01.04"]
[White "Other GM"]
[Black "Target GM"]
[Result "1/2-1/2"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. d4 Nf6 2. c4 e6 1/2-1/2`;

const prepPgn = `[Event "My Prep"]
[Date "2026.01.01"]
[White "Me"]
[Black "Prep"]
[Result "*"]

1. e4 c5 (1... c6 2. d4 d5) (1... e5) 2. Nf3 d6 *

[Event "Root Surprise"]
[Result "*"]

1. d4 d5 *`;

function fenAfter(moves) {
  let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  for (const move of moves) {
    fen = playLegalUciMove(fen, move).nextFen;
  }
  return fen;
}

test('normalizePlayerName handles comma and case variants', () => {
  assert.equal(normalizePlayerName('Carlsen, Magnus'), normalizePlayerName('magnus carlsen'));
  assert.equal(normalizePlayerName('  Target   GM  '), 'target gm');
});

test('normalizePlayerName resolves Chinese player names and PGN variants', () => {
  assert.equal(normalizePlayerName('丁立人'), normalizePlayerName('Ding Liren'));
  assert.equal(normalizePlayerName('Ding, Liren'), normalizePlayerName('Ding Liren'));
  assert.equal(normalizePlayerName('Ding Liren (CHN)'), normalizePlayerName('Ding Liren'));
  assert.equal(normalizePlayerName('李超'), normalizePlayerName('Li Chao2'));
  assert.equal(normalizePlayerName('徐昱华'), normalizePlayerName('Xu Yuhua'));
});

test('normalizePlayerName resolves FIDE China pinyin names across spacing variants', () => {
  assert.equal(normalizePlayerName('DingLiren'), normalizePlayerName('Ding Liren'));
  assert.equal(normalizePlayerName('HouYifan'), normalizePlayerName('Hou, Yifan(HLJ)'));
  assert.equal(normalizePlayerName('WangHao'), normalizePlayerName('Wang,Hao(ZJ)'));
  assert.equal(normalizePlayerName('AbudourehemanAisha'), normalizePlayerName('Abudoureheman, Aisha'));
});

test('buildOpponentOpeningTree matches Chinese aliases across PGN name variants', () => {
  const dir = tempDir();
  const chineseGames = `[Event "Canonical"]
[Date "2024.02.01"]
[White "Ding Liren"]
[Black "Other GM"]
[Result "1-0"]
[WhiteElo "2800"]
[BlackElo "2500"]

1. e4 c5 1-0

[Event "Comma"]
[Date "2024.02.02"]
[White "Ding, Liren"]
[Black "Other GM"]
[Result "1/2-1/2"]
[WhiteElo "2800"]
[BlackElo "2500"]

1. d4 Nf6 1/2-1/2

[Event "Suffix"]
[Date "2024.02.03"]
[White "Other GM"]
[Black "Ding Liren (CHN)"]
[Result "0-1"]
[WhiteElo "2500"]
[BlackElo "2800"]

1. c4 e5 0-1`;
  try {
    buildOfflineStoreFromPgn(chineseGames, { storeDir: dir, sourceName: 'chinese.pgn' });
    const store = loadOfflineStore({ storeDir: dir });
    const whiteTree = buildOpponentOpeningTree(store, { opponent: '丁立人', opponentSide: 'w', maxPly: 4 });
    const blackTree = buildOpponentOpeningTree(store, { opponent: '丁立人', opponentSide: 'b', maxPly: 4 });

    assert.equal(whiteTree.games.length, 2);
    assert.equal(blackTree.games.length, 1);
    assert.deepEqual(whiteTree.root.moves.map((move) => move.uci).sort(), ['d2d4', 'e2e4']);
    assert.deepEqual(blackTree.root.moves.map((move) => move.uci), ['c2c4']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildOpponentOpeningTree counts only games where the opponent plays the requested side', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(opponentGames, { storeDir: dir, sourceName: 'games.pgn' });
    const store = loadOfflineStore({ storeDir: dir });
    const whiteTree = buildOpponentOpeningTree(store, { opponent: 'Target GM', opponentSide: 'w', maxPly: 6 });
    const blackTree = buildOpponentOpeningTree(store, { opponent: 'Target GM', opponentSide: 'b', maxPly: 6 });

    assert.equal(whiteTree.games.length, 3);
    assert.equal(blackTree.games.length, 1);
    assert.equal(whiteTree.root.total, 3);
    assert.deepEqual(whiteTree.root.moves.map((move) => move.uci).sort(), ['e2e4']);
    assert.deepEqual(blackTree.root.moves.map((move) => move.uci), ['d2d4']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPrepReport classifies unseen, low-sample, weak-performance, and prep gaps', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(opponentGames, { storeDir: dir, sourceName: 'games.pgn' });
    const store = loadOfflineStore({ storeDir: dir });

    const report = buildPrepReport({
      store,
      opponent: 'Target GM',
      ourSide: 'b',
      prepPgn,
      maxPly: 6,
      lowSampleThreshold: 1,
      weakScoreThreshold: 0.35
    });

    assert.equal(report.opponent, 'Target GM');
    assert.equal(report.opponentSide, 'w');
    assert.equal(report.sampleGames, 3);
    assert.ok(report.explorer);
    assert.equal(report.explorer.nodes[report.scope.fen].total, 3);
    assert.deepEqual(report.explorer.nodes[report.scope.fen].moves.map((move) => move.uci), ['e2e4']);
    const unseen = report.unseen.find((item) => item.uci === 'd2d4' && item.positionLine === '起始局面');
    const lowSample = report.lowSample.find((item) => item.uci === 'd2d4' && item.positionLine === '1. e4 c6');
    const weak = report.weakPerformance.find((item) => item.uci === 'g1f3');
    assert.ok(unseen);
    assert.ok(lowSample);
    assert.ok(weak);
    assert.equal(unseen.positionLine, '起始局面');
    assert.equal(unseen.moveNumber, 1);
    assert.equal(unseen.sideToMove, 'w');
    assert.equal(unseen.displayMove, '1. d4');
    assert.match(unseen.explanation, /在起始局面/);
    assert.match(unseen.explanation, /这里轮到白方/);
    assert.match(unseen.explanation, /没下过这步/);
    assert.doesNotMatch(unseen.explanation, /没遇到过这步/);
    assert.match(lowSample.explanation, /样本很少/);
    assert.equal(weak.positionLine, '1. e4 c5');
    assert.match(weak.explanation, /得分偏低/);
    assert.equal(report.gaps.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPrepReport finds opponent replies missing from the preparation tree', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(`[Event "French Gap"]
[Date "2024.01.05"]
[White "Other GM"]
[Black "Target GM"]
[Result "1-0"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 e6 2. d4 d5 1-0`, { storeDir: dir, sourceName: 'gap.pgn' });
    const store = loadOfflineStore({ storeDir: dir });

    const report = buildPrepReport({
      store,
      opponent: 'Target GM',
      ourSide: 'w',
      prepPgn: '[Event "My Prep"]\n[Date "2026.01.01"]\n[White "Me"]\n[Black "Prep"]\n[Result "*"]\n\n1. e4 c5 *',
      maxPly: 4
    });

    const gap = report.gaps.find((item) => item.uci === 'e7e6');
    assert.ok(gap);
    assert.equal(gap.positionLine, '1. e4');
    assert.equal(gap.displayMove, '...e6');
    assert.match(gap.explanation, /你的准备没有覆盖/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPrepReport explains where a deeper recommendation appears', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(`[Event "Deep Sample"]
[Date "2024.01.06"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 c5 2. Nf3 d6 0-1`, { storeDir: dir, sourceName: 'deep.pgn' });
    const store = loadOfflineStore({ storeDir: dir });

    const report = buildPrepReport({
      store,
      opponent: 'Target GM',
      ourSide: 'w',
      prepPgn: '[Event "My Prep"]\n[Date "2026.01.01"]\n[White "Me"]\n[Black "Prep"]\n[Result "*"]\n\n1. e4 c5 2. Nf3 d6 *',
      maxPly: 6,
      lowSampleThreshold: 2
    });

    const item = report.lowSample.find((candidate) => candidate.uci === 'd7d6');
    assert.ok(item);
    assert.equal(item.positionLine, '1. e4 c5 2. Nf3');
    assert.equal(item.moveNumber, 2);
    assert.equal(item.sideToMove, 'b');
    assert.equal(item.displayMove, '...d6');
    assert.match(item.explanation, /在 1\. e4 c5 2\. Nf3 之后/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPrepReport scopes analysis to the selected opening branch and opponent replies', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(`[Event "Alapin Main"]
[Date "2024.02.01"]
[White "Other GM"]
[Black "Target GM"]
[Result "1/2-1/2"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 c5 2. c3 d5 3. exd5 Qxd5 1/2-1/2

[Event "Alapin Main Repeat"]
[Date "2024.02.01"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 c5 2. c3 d5 0-1

[Event "Alapin Rare"]
[Date "2024.02.02"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 c5 2. c3 e6 0-1

[Event "Open Sicilian"]
[Date "2024.02.03"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 c5 2. Nf3 d6 0-1`, { storeDir: dir, sourceName: 'sicilian.pgn' });
    const store = loadOfflineStore({ storeDir: dir });

    const report = buildPrepReport({
      store,
      opponent: 'Target GM',
      ourSide: 'w',
      prepPgn: '[Event "White Prep"]\n[Result "*"]\n\n1. e4 c5 2. c3 d5 (2. Nf3 d6) *',
      focusFen: fenAfter(['e2e4', 'c7c5', 'c2c3']),
      focusPly: 3,
      focusLine: '1. e4 c5 2. c3',
      maxPly: 8,
      lowSampleThreshold: 2
    });

    assert.equal(report.scope.positionLine, '1. e4 c5 2. c3');
    assert.equal(report.scope.fen, fenAfter(['e2e4', 'c7c5', 'c2c3']));
    assert.deepEqual(report.scopeOpponentMoves.map((move) => move.uci), ['d7d5', 'e7e6']);
    assert.deepEqual(report.scopeOpponentMoves.map((move) => move.count), [2, 1]);
    assert.ok(report.lowSample.find((item) => item.uci === 'd7d5'));
    const gap = report.gaps.find((item) => item.uci === 'e7e6');
    assert.ok(gap);
    assert.equal(gap.positionLine, '1. e4 c5 2. c3');
    assert.equal(gap.displayMove, '...e6');
    assert.equal(report.gaps.some((item) => item.uci === 'd7d6'), false);
    assert.equal(report.lowSample.some((item) => item.uci === 'd7d6'), false);
    assert.equal(report.unseen.some((item) => item.positionLine === '起始局面'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPrepReport ranks opponent replies before matching white repertoire', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(`[Event "Sicilian Main"]
[Date "2024.03.01"]
[White "Other GM"]
[Black "Target GM"]
[Result "1/2-1/2"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 c5 2. c3 d5 1/2-1/2

[Event "Sicilian Repeat"]
[Date "2024.03.02"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 c5 2. Nf3 d6 0-1

[Event "Open Game"]
[Date "2024.03.03"]
[White "Other GM"]
[Black "Target GM"]
[Result "1-0"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 e5 2. Nf3 Nc6 1-0

[Event "French"]
[Date "2024.03.04"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 e6 2. d4 d5 0-1`, { storeDir: dir, sourceName: 'white-start.pgn' });
    const store = loadOfflineStore({ storeDir: dir });

    const report = buildPrepReport({
      store,
      opponent: 'Target GM',
      ourSide: 'w',
      prepPgn: '[Event "White Prep"]\n[Result "*"]\n\n1. e4 c5 2. c3 (2. Nf3 d6) d5 *',
      focusFen: fenAfter(['e2e4']),
      focusPly: 1,
      focusLine: '1. e4',
      maxPly: 8,
      lowSampleThreshold: 2
    });

    assert.equal(report.scope.positionLine, '1. e4');
    assert.equal(report.decision.positionLine, '1. e4');
    assert.deepEqual(report.decision.moves.map((move) => move.uci), ['c7c5', 'e7e5', 'e7e6']);
    assert.deepEqual(report.scopeOpponentMoves.map((move) => move.uci), ['c7c5', 'e7e5', 'e7e6']);

    const sicilian = report.decision.moves.find((move) => move.uci === 'c7c5');
    assert.equal(sicilian.count, 2);
    assert.equal(sicilian.autoReply.uci, 'c2c3');
    assert.deepEqual(sicilian.preparedReplies.map((move) => move.uci), ['c2c3', 'g1f3']);
    assert.equal(sicilian.nextScope.positionLine, '1. e4 c5 2. c3');

    const french = report.decision.moves.find((move) => move.uci === 'e7e6');
    assert.equal(french.autoReply, null);
    assert.equal(french.nextScope.positionLine, '1. e4 e6');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPrepReport starts black prep from opponent first moves', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(`[Event "Target e4 Main"]
[Date "2024.03.01"]
[White "Target GM"]
[Black "Other GM"]
[Result "1-0"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 c5 2. Nf3 d6 1-0

[Event "Target e4 Alapin"]
[Date "2024.03.02"]
[White "Target GM"]
[Black "Other GM"]
[Result "1/2-1/2"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. e4 c5 2. c3 d5 1/2-1/2

[Event "Target d4"]
[Date "2024.03.03"]
[White "Target GM"]
[Black "Other GM"]
[Result "0-1"]
[WhiteElo "2500"]
[BlackElo "2520"]

1. d4 Nf6 2. c4 e6 0-1`, { storeDir: dir, sourceName: 'black-start.pgn' });
    const store = loadOfflineStore({ storeDir: dir });

    const report = buildPrepReport({
      store,
      opponent: 'Target GM',
      ourSide: 'b',
      prepPgn: '[Event "Black Prep"]\n[Result "*"]\n\n1. e4 c5 2. Nf3 d6 (2. c3 d5) *',
      focusFen: fenAfter([]),
      focusPly: 0,
      focusLine: '',
      maxPly: 8,
      lowSampleThreshold: 2
    });

    assert.equal(report.scope.positionLine, '起始局面');
    assert.equal(report.decision.positionLine, '起始局面');
    assert.deepEqual(report.decision.moves.map((move) => move.uci), ['e2e4', 'd2d4']);

    const e4 = report.decision.moves.find((move) => move.uci === 'e2e4');
    assert.equal(e4.count, 2);
    assert.equal(e4.autoReply.uci, 'c7c5');
    assert.equal(e4.nextScope.positionLine, '1. e4 c5');

    const d4 = report.decision.moves.find((move) => move.uci === 'd2d4');
    assert.equal(d4.autoReply, null);
    assert.equal(d4.nextScope.positionLine, '1. d4');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPrepReport auto-advances a selected opponent reply to our prepared answer', () => {
  const dir = tempDir();
  try {
    buildOfflineStoreFromPgn(`[Event "Alapin Main"]
[Date "2024.03.01"]
[White "Other GM"]
[Black "Target GM"]
[Result "1/2-1/2"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 c5 2. c3 d5 1/2-1/2

[Event "French Before Alapin"]
[Date "2024.03.02"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 e6 2. d4 d5 0-1

[Event "Open Game Before Alapin"]
[Date "2024.03.03"]
[White "Other GM"]
[Black "Target GM"]
[Result "0-1"]
[WhiteElo "2520"]
[BlackElo "2500"]

1. e4 e5 2. Nf3 Nc6 0-1`, { storeDir: dir, sourceName: 'alapin.pgn' });
    const store = loadOfflineStore({ storeDir: dir });

    const report = buildPrepReport({
      store,
      opponent: 'Target GM',
      ourSide: 'w',
      prepPgn: '[Event "Alapin"]\n[Result "*"]\n\n1. e4 c5 2. c3 d5 *',
      focusFen: fenAfter(['e2e4', 'c7c5']),
      focusPly: 2,
      focusLine: '1. e4 c5',
      maxPly: 8,
      lowSampleThreshold: 2
    });

    assert.equal(report.scope.positionLine, '1. e4 c5 2. c3');
    assert.equal(report.scope.fen, fenAfter(['e2e4', 'c7c5', 'c2c3']));
    assert.deepEqual(report.appliedPrepLine.map((move) => move.uci), ['c2c3']);
    assert.equal(report.decision.positionLine, '1. e4 c5 2. c3');
    assert.deepEqual(report.decision.moves.map((move) => move.uci), ['d7d5']);
    assert.ok(report.lowSample.find((item) => item.uci === 'd7d5'));
    assert.equal(report.gaps.some((item) => item.uci === 'e7e6'), false);
    assert.equal(report.gaps.some((item) => item.uci === 'e7e5'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
