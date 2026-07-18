import {
  advanceEndgameStep,
  createEndgameSession,
  getEndgameCategories,
  getEndgameLesson,
  listEndgameLessons
} from './endgames.js';
import {
  getEngineProfile,
  listEngineProfiles
} from './engine-profiles.mjs';
import {
  DEFAULT_LOCALE,
  applyStaticTranslations,
  localizeEndgameCategory,
  localizeEndgameLesson,
  localizeEngineProfile,
  normalizeLocale,
  t,
  translateText
} from './i18n.js';

const FILES = 'abcdefgh';
const RANKS = '12345678';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SAVED_STUDIES_KEY = 'lichessOpeningTrainer.savedStudies.v1';
const PIECES = {
  P: '♙',
  N: '♘',
  B: '♗',
  R: '♖',
  Q: '♕',
  K: '♔',
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚'
};
const PROMOTION_ORDER = ['q', 'r', 'b', 'n'];
const PROMOTION_LABELS = {
  q: '后',
  r: '车',
  b: '象',
  n: '马'
};

function promotionLabel(promotion) {
  return t(currentLocale(), `promotion.${promotion}`) || PROMOTION_LABELS[promotion] || promotion?.toUpperCase() || '';
}

function currentLocale() {
  return normalizeLocale(state?.locale || DEFAULT_LOCALE);
}

function tr(key, params = {}) {
  return t(currentLocale(), key, params);
}

function localizeMessage(message) {
  return translateText(message, currentLocale());
}

export function pieceAssetClass(piece) {
  if (!piece) return '';
  const color = piece === piece.toUpperCase() ? 'w' : 'b';
  return `piece-${color}${piece.toUpperCase()}`;
}


export function boardDisplayRanks(orientation = 'w') {
  return orientation === 'b' ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
}

export function boardDisplayFiles(orientation = 'w') {
  return orientation === 'b' ? [...FILES].reverse() : [...FILES];
}

export function normalizeBoardOrientation(side = 'w') {
  return side === 'b' ? 'b' : 'w';
}

export function boardSquareColor(square) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return (file + rank) % 2 === 0 ? 'light' : 'dark';
}

export function getLegalDestinationSquares(fen, fromSquare) {
  const chessState = parseFen(fen);
  const from = squareToIndex(fromSquare);
  return generateLegalMoves(chessState)
    .filter((move) => move.from === from)
    .map((move) => indexToSquare(move.to))
    .sort();
}

export function getPromotionChoicesForMove(fen, fromSquare, toSquare) {
  const chessState = parseFen(fen);
  const from = squareToIndex(fromSquare);
  const to = squareToIndex(toSquare);
  return generateLegalMoves(chessState)
    .filter((move) => move.from === from && move.to === to && move.promotion)
    .map((move) => ({
      promotion: move.promotion,
      uci: moveToUci(move),
      label: promotionLabel(move.promotion)
    }));
}

export function boardInputReducer(selected, square, canSelectSquare) {
  if (!selected) {
    return canSelectSquare(square)
      ? { selected: square, attempt: null }
      : { selected: null, attempt: null };
  }

  if (selected === square) {
    return { selected: null, attempt: null };
  }

  if (canSelectSquare(square)) {
    return { selected: square, attempt: null };
  }

  return { selected: null, attempt: { from: selected, to: square } };
}

const state = {
  mode: 'opening',
  trainer: null,
  side: 'w',
  openingSide: 'w',
  currentFen: normalizeFen(START_FEN),
  currentState: parseFen(START_FEN),
  selected: null,
  drag: {
    active: false,
    dragging: false,
    from: null,
    piece: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    suppressClick: false
  },
  pendingPromotion: null,
  lastMove: null,
  moveHistory: [],
  redoHistory: [],
  lastCompletedPgn: '',
  openingLinePaused: false,
  lineStatsSnapshot: null,
  preservingRedo: false,
  locale: DEFAULT_LOCALE,
  status: '等待导入 PGN 或 Lichess Study',
  statusError: false,
  feedback: '先导入你的 Lichess 研讨 PGN，然后开始训练。',
  feedbackError: false,
  candidates: [],
  opponentChoices: [],
  completedTerminals: new Set(),
  stats: {
    attempts: 0,
    correct: 0,
    mistakes: 0,
    streak: 0,
    covered: new Set()
  },
  wrongFlash: false,
  importedLabel: '未导入',
  savedStudies: [],
  activeStudyId: null,
  prep: {
    ourSide: 'w',
    status: '先上传对手 PGN，并在开局训练中导入你的准备 PGN。',
    opponentPgn: '',
    opponentPgnName: '',
    report: null,
    explorerReport: null,
    loading: false,
    error: false
  },
  engine: {
    active: false,
    thinking: false,
    profileId: 'human-2400',
    status: '从当前局面开始，选择档位后点击开始。',
    lastLine: '',
    sparringSnapshot: null
  },
  endgame: {
    categoryId: 'rook-minor-activity',
    lessonId: 'candidate-pgnmentor-files-caruana-1722-79',
    session: null,
    message: '选择左侧课程后开始。',
    feedbackError: false,
    hintsVisible: false,
    answerVisible: false,
    stats: {
      attempts: 0,
      correct: 0,
      mistakes: 0,
      streak: 0,
      completed: new Set()
    }
  }
};

export { getEngineProfile, listEngineProfiles };

export function canStartEngineTraining({ mode }) {
  return mode === 'opening' || mode === 'endgame';
}

export function getVisibleFeedbackMessage({ mode, feedback, status, endgameMessage, prepMessage }) {
  if (mode === 'endgame') return endgameMessage ?? '';
  if (mode === 'prep') return prepMessage ?? '';
  return feedback || status || '';
}

export function endgameTargetLabel(lesson) {
  const locale = currentLocale();
  if (locale !== 'zh') {
    if (lesson?.trainingTarget === 'win') return t(locale, 'endgame.target.win');
    if (lesson?.trainingTarget === 'draw') return t(locale, 'endgame.target.draw');
    return t(locale, 'endgame.target.unknown');
  }
  if (lesson?.trainingTargetLabel) return lesson.trainingTargetLabel;
  if (lesson?.trainingTarget === 'win') return '目标：赢棋';
  if (lesson?.trainingTarget === 'draw') return '目标：守和';
  return '目标：待确认';
}

export function formatEndgameSourceLabel(source, locale = currentLocale()) {
  if (!source) return '';
  if (Number.isInteger(source.example)) return t(locale, 'endgame.source.example', { value: source.example });
  if (source.exercise) return t(locale, 'endgame.source.exercise', { value: source.exercise });
  if (source.provider) return t(locale, 'endgame.source.publicPgn');
  return t(locale, 'endgame.source.source');
}

export function formatEndgameSourceLine(source, locale = currentLocale()) {
  if (!source) return '';
  const parts = [];
  if (source.game) parts.push(source.game);
  const label = formatEndgameSourceLabel(source, locale);
  if (label) parts.push(label);
  if (source.provider) parts.push(locale === 'zh' ? source.provider : t(locale, 'endgame.source.publicPgn'));
  return parts.join(' · ');
}

export function stableHash(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createStudyRecord({ pgn, name, sourceKey = null }) {
  const normalizedPgn = String(pgn || '').replace(/\r\n/g, '\n').trim();
  const contentHash = stableHash(normalizedPgn);
  const now = new Date().toISOString();
  return {
    id: sourceKey || `content:${contentHash}`,
    sourceKey: sourceKey || `content:${contentHash}`,
    contentHash,
    name: String(name || '').trim() || '未命名研讨',
    pgn: normalizedPgn,
    createdAt: now,
    updatedAt: now
  };
}

export function upsertStudyRecord(records, incoming) {
  const nextRecords = Array.isArray(records) ? [...records] : [];
  const sameContentIndex = nextRecords.findIndex((record) => record.contentHash === incoming.contentHash);

  if (sameContentIndex >= 0) {
    return { records: nextRecords, record: nextRecords[sameContentIndex], action: 'duplicate' };
  }

  const sameSourceIndex = nextRecords.findIndex((record) => record.sourceKey === incoming.sourceKey);
  if (sameSourceIndex >= 0) {
    const previous = nextRecords[sameSourceIndex];
    const updated = {
      ...incoming,
      id: previous.id,
      name: previous.name || incoming.name,
      createdAt: previous.createdAt || incoming.createdAt,
      updatedAt: incoming.updatedAt
    };
    nextRecords[sameSourceIndex] = updated;
    return { records: nextRecords, record: updated, action: 'updated' };
  }

  nextRecords.unshift(incoming);
  return { records: nextRecords, record: incoming, action: 'added' };
}

export function appendStudyRecord(records, activeStudyId, pgn, label = '新增内容') {
  const nextRecords = Array.isArray(records) ? [...records] : [];
  const index = nextRecords.findIndex((record) => record.id === activeStudyId);
  if (index < 0) throw new Error('No active study to append to');

  const incomingPgn = String(pgn || '').replace(/\r\n/g, '\n').trim();
  if (!incomingPgn) throw new Error('PGN is empty');

  const previous = nextRecords[index];
  const combinedPgn = [previous.pgn, incomingPgn].filter(Boolean).join('\n\n');
  const contentHash = stableHash(combinedPgn);
  if (contentHash === previous.contentHash) {
    return { records: nextRecords, record: previous, action: 'duplicate' };
  }

  const updated = {
    ...previous,
    pgn: combinedPgn,
    contentHash,
    appendLabel: String(label || '').trim() || '新增内容',
    updatedAt: new Date().toISOString()
  };
  nextRecords[index] = updated;
  return { records: nextRecords, record: updated, action: 'appended' };
}

export function extractStudyId(value) {
  return parseStudyUrl(value)?.studyId ?? null;
}

export function parseStudyUrl(value) {
  const match = String(value || '').match(/lichess\.org\/study\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?/);
  if (!match) return null;
  return {
    studyId: match[1],
    chapterId: match[2] || null
  };
}

export function splitPgnGames(pgn) {
  const normalized = String(pgn || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const starts = [...normalized.matchAll(/(?=^\[Event\s+")/gm)].map((match) => match.index);
  if (starts.length <= 1) return [normalized];

  return starts
    .map((start, index) => {
      const end = starts[index + 1] ?? normalized.length;
      return normalized.slice(start, end).trim();
    })
    .filter(Boolean);
}

export function stripPgnHeaders(gameText) {
  return String(gameText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('['))
    .join(' ')
    .trim();
}

export function tokenizePgnMovetext(movetext) {
  return String(movetext || '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n]*/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.replace(/^\d+\.(\.\.)?/, ''))
    .filter(Boolean)
    .filter((token) => !/^\d+\.(\.\.)?$/.test(token))
    .filter((token) => !/^\d+\.\.\.$/.test(token))
    .filter((token) => !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
}

export function createTrainerFromPgn(pgn) {
  const games = splitPgnGames(pgn);
  const nodes = new Map();
  let rootFen = null;
  const errors = [];
  const chapters = [];

  for (const game of games) {
    const headers = parseHeaders(game);
    const startFen = headers.FEN && headers.SetUp === '1' ? headers.FEN : START_FEN;
    const initialState = parseFen(startFen);
    const initialFen = keyFen(initialState);
    rootFen ??= initialFen;
    ensureNode(nodes, initialFen, headers.Event || '未命名章节');
    chapters.push(headers.Event || `章节 ${chapters.length + 1}`);

    const tokens = tokenizePgnMovetext(stripPgnHeaders(game));
    const stack = [];
    let currentState = cloneState(initialState);
    let currentFen = initialFen;
    let lastMoveStartState = cloneState(initialState);
    let lastMoveStartFen = initialFen;

    for (const token of tokens) {
      if (token === '(') {
        stack.push({
          currentState: cloneState(currentState),
          currentFen,
          lastMoveStartState: cloneState(lastMoveStartState),
          lastMoveStartFen
        });
        currentState = cloneState(lastMoveStartState);
        currentFen = lastMoveStartFen;
        continue;
      }

      if (token === ')') {
        const previous = stack.pop();
        if (!previous) continue;
        currentState = previous.currentState;
        currentFen = previous.currentFen;
        lastMoveStartState = previous.lastMoveStartState;
        lastMoveStartFen = previous.lastMoveStartFen;
        continue;
      }

      try {
        const beforeState = cloneState(currentState);
        const beforeFen = currentFen;
        const move = moveFromSan(currentState, token);
        const afterState = applyMove(currentState, move);
        const afterFen = keyFen(afterState);
        addMoveToTree(nodes, beforeFen, afterFen, {
          san: cleanSan(token),
          uci: moveToUci(move),
          from: indexToSquare(move.from),
          to: indexToSquare(move.to),
          promotion: move.promotion || null,
          piece: move.piece,
          capture: move.capture || null,
          nextFen: afterFen
        });
        ensureNode(nodes, afterFen, headers.Event || '未命名章节');
        currentState = afterState;
        currentFen = afterFen;
        lastMoveStartState = beforeState;
        lastMoveStartFen = beforeFen;
      } catch (error) {
        errors.push(`跳过 ${token}: ${error.message}`);
      }
    }
  }

  if (!rootFen) {
    rootFen = keyFen(parseFen(START_FEN));
    ensureNode(nodes, rootFen, '空白');
  }

  return {
    rootFen,
    nodes,
    chapters,
    errors,
    moveCount: [...nodes.values()].reduce((total, node) => total + node.moves.length, 0)
  };
}

export function getCandidateMoves(trainer, fen) {
  return trainer?.nodes.get(normalizeFen(fen))?.moves ?? [];
}

export function getAvailableCandidateMoves(trainer, fen, completedTerminalFens = new Set()) {
  const completed = normalizeCompletedTerminalFens(completedTerminalFens);
  return getCandidateMoves(trainer, fen)
    .filter((move) => !isPreparedMoveSubtreeCompleted(trainer, move, completed));
}

function normalizeCompletedTerminalFens(completedTerminalFens) {
  return new Set(
    [...(completedTerminalFens || [])].map((fen) => normalizeFen(fen))
  );
}

function isPreparedMoveSubtreeCompleted(trainer, move, completedTerminalFens) {
  return isPreparedFenSubtreeCompleted(trainer, move.nextFen, completedTerminalFens, new Set());
}

function isPreparedFenSubtreeCompleted(trainer, fen, completedTerminalFens, visited) {
  const normalized = normalizeFen(fen);
  if (visited.has(normalized)) return true;
  visited.add(normalized);

  const moves = getCandidateMoves(trainer, normalized);
  if (!moves.length) return completedTerminalFens.has(normalized);

  return moves.every((move) => (
    isPreparedFenSubtreeCompleted(trainer, move.nextFen, completedTerminalFens, new Set(visited))
  ));
}

export function applyPreparedMove(trainer, fen, uci) {
  const move = getCandidateMoves(trainer, fen).find((candidate) => candidate.uci === uci);
  if (!move) throw new Error(`Move ${uci} is not in repertoire`);
  return move.nextFen;
}

export function chooseOpponentMove(trainer, fen, random = Math.random, completedTerminalFens = new Set()) {
  const moves = getAvailableCandidateMoves(trainer, fen, completedTerminalFens);
  if (!moves.length) return null;
  const index = Math.min(moves.length - 1, Math.floor(random() * moves.length));
  return moves[index];
}

export function chooseRandomCandidateMove(trainer, fen, random = Math.random) {
  const moves = getCandidateMoves(trainer, fen);
  if (!moves.length) return null;
  const index = Math.min(moves.length - 1, Math.floor(random() * moves.length));
  return moves[index];
}

export function findPreparedMoveFromSquares(fen, from, to, moves, promotion = null) {
  const attempted = createAttemptMove(fen, from, to, promotion || 'q');
  const uci = attempted ? moveToUci(attempted) : `${from}${to}`;
  return (Array.isArray(moves) ? moves : []).find((move) => move.uci === uci) || null;
}

export function getOpponentBranchDecision(trainer, fen, completedTerminalFens = new Set()) {
  const moves = getAvailableCandidateMoves(trainer, fen, completedTerminalFens);
  if (!moves.length) return { mode: 'done', move: null, moves: [] };
  if (moves.length === 1) return { mode: 'auto', move: moves[0], moves };
  return { mode: 'choose', move: null, moves };
}

export function formatMoveHistoryPgn(moveHistory) {
  return (Array.isArray(moveHistory) ? moveHistory : [])
    .map((move, index) => {
      const san = move?.san || move?.uci || '';
      if (!san) return '';
      if (index % 2 === 0) return `${Math.floor(index / 2) + 1}. ${san}`;
      return san;
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

function prepExplorerFenKey(fen) {
  const normalized = normalizeFen(fen);
  const parts = String(normalized || '').split(/\s+/);
  if (parts.length < 4) return normalized;
  return parts.slice(0, 4).join(' ');
}

export function getPrepExplorerRows(report, fen, limit = 12) {
  const key = prepExplorerFenKey(fen);
  const decisionKey = prepExplorerFenKey(report?.decision?.fen || '');
  if (decisionKey && decisionKey === key && Array.isArray(report?.decision?.moves)) {
    return report.decision.moves
      .slice()
      .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.uci || '').localeCompare(String(b.uci || '')))
      .slice(0, limit)
      .map((move) => ({
        ...move,
        san: move.san || move.uci || '',
        from: move.from || String(move.uci || '').slice(0, 2),
        to: move.to || String(move.uci || '').slice(2, 4),
        promotion: move.promotion || null,
        nextFen: move.nextFen || '',
        count: Number(move.count) || 0,
        total: Number(move.total) || 0,
        share: Number.isFinite(move.share) ? move.share : 0,
        scoreRate: Number.isFinite(move.scoreRate) ? move.scoreRate : null
      }));
  }
  const node = report?.explorer?.nodes?.[key] || report?.explorer?.nodes?.[normalizeFen(fen)];
  const total = Number(node?.total) || 0;
  return (Array.isArray(node?.moves) ? node.moves : [])
    .slice()
    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.uci || '').localeCompare(String(b.uci || '')))
    .slice(0, limit)
    .map((move) => {
      let details = null;
      try {
        details = playLegalUciMove(key, move.uci);
      } catch {
        details = null;
      }
      const count = Number(move.count) || 0;
      return {
        ...move,
        san: move.san || details?.move?.san || move.uci || '',
        from: move.from || details?.move?.from || String(move.uci || '').slice(0, 2),
        to: move.to || details?.move?.to || String(move.uci || '').slice(2, 4),
        promotion: move.promotion || details?.move?.promotion || null,
        nextFen: move.nextFen || details?.nextFen || '',
        count,
        total,
        share: total ? count / total : 0,
        scoreRate: Number.isFinite(move.scoreRate) ? move.scoreRate : null
      };
    });
}

export function getOpeningLineCompletionAction({
  trainer,
  currentFen,
  moveHistory = [],
  completedTerminalFens = new Set()
} = {}) {
  if (!trainer || getCandidateMoves(trainer, currentFen).length) {
    return { mode: 'continue' };
  }

  const terminalFen = normalizeFen(currentFen);
  const completed = new Set([...(completedTerminalFens || [])].map((fen) => normalizeFen(fen)));
  return {
    mode: 'pause',
    terminalFen,
    pgn: formatMoveHistoryPgn(moveHistory),
    alreadyCompleted: completed.has(terminalFen),
    message: completed.has(terminalFen)
      ? '这条 variation 之前已经做过了，已停在最终局面；点击“继续下一条”再切换。'
      : '这条线已走完，先停在最终局面；看完后点击“继续下一条”再接着训练。'
  };
}

export function rewindMoveHistoryToPreviousTurn(moveHistory, rootFen, side) {
  const nextHistory = (Array.isArray(moveHistory) ? moveHistory : [])
    .map((move) => ({ ...move }));
  const redoMoves = [];

  if (!nextHistory.length) {
    return {
      moveHistory: [],
      currentFen: normalizeFen(rootFen),
      lastMove: null,
      redoMoves
    };
  }

  do {
    const move = nextHistory.pop();
    if (move) redoMoves.unshift(move);
  } while (nextHistory.length && !sameSideToMove(nextHistory[nextHistory.length - 1].nextFen, side));

  const last = nextHistory[nextHistory.length - 1] || null;
  return {
    moveHistory: nextHistory,
    currentFen: last ? normalizeFen(last.nextFen) : normalizeFen(rootFen),
    lastMove: last ? { from: last.from, to: last.to } : null,
    redoMoves
  };
}

export function rewindMoveHistoryOnePly(moveHistory, rootFen, existingRedoMoves = []) {
  const nextHistory = (Array.isArray(moveHistory) ? moveHistory : [])
    .map((move) => ({ ...move }));
  const redoMoves = (Array.isArray(existingRedoMoves) ? existingRedoMoves : [])
    .map((move) => ({ ...move }));

  if (!nextHistory.length) {
    return {
      moveHistory: [],
      currentFen: normalizeFen(rootFen),
      lastMove: null,
      redoMoves
    };
  }

  const move = nextHistory.pop();
  if (move) redoMoves.unshift(move);
  const last = nextHistory[nextHistory.length - 1] || null;
  return {
    moveHistory: nextHistory,
    currentFen: last ? normalizeFen(last.nextFen) : normalizeFen(rootFen),
    lastMove: last ? { from: last.from, to: last.to } : null,
    redoMoves
  };
}

export function restoreMoveHistorySegment(moveHistory, redoMoves) {
  const nextHistory = [
    ...(Array.isArray(moveHistory) ? moveHistory : []).map((move) => ({ ...move })),
    ...(Array.isArray(redoMoves) ? redoMoves : []).map((move) => ({ ...move }))
  ];
  const last = nextHistory[nextHistory.length - 1] || null;
  return {
    moveHistory: nextHistory,
    currentFen: last ? normalizeFen(last.nextFen) : normalizeFen(START_FEN),
    lastMove: last ? { from: last.from, to: last.to } : null
  };
}

export function buildStudyPgnUrls(study) {
  if (!study?.studyId) return [];
  const path = study.chapterId ? `${study.studyId}/${study.chapterId}` : study.studyId;
  return [
    `/lichess-study?study=${encodeURIComponent(study.studyId)}${study.chapterId ? `&chapter=${encodeURIComponent(study.chapterId)}` : ''}`,
    `https://lichess.org/api/study/${path}.pgn`,
    `https://lichess.org/study/${path}.pgn`
  ];
}

export function replayPgnGame(gameText) {
  const headers = parseHeaders(gameText);
  const startFen = headers.FEN && headers.SetUp === '1' ? headers.FEN : START_FEN;
  let currentState = parseFen(startFen);
  let currentFen = keyFen(currentState);
  const moves = [];

  for (const token of tokenizePgnMovetext(stripPgnHeaders(gameText))) {
    if (token === '(' || token === ')') continue;
    const beforeFen = currentFen;
    const move = moveFromSan(currentState, token);
    const san = cleanSan(token);
    const nextState = applyMove(currentState, move);
    const afterFen = keyFen(nextState);
    moves.push({
      ply: moves.length + 1,
      san,
      uci: moveToUci(move),
      from: indexToSquare(move.from),
      to: indexToSquare(move.to),
      promotion: move.promotion || null,
      beforeFen,
      afterFen
    });
    currentState = nextState;
    currentFen = afterFen;
  }

  return {
    headers,
    startFen: keyFen(parseFen(startFen)),
    finalFen: currentFen,
    moves,
    errors: []
  };
}

function parseHeaders(gameText) {
  const headers = {};
  for (const line of String(gameText || '').split(/\r?\n/)) {
    const match = line.match(/^\[([A-Za-z0-9_]+)\s+"(.*)"\]$/);
    if (match) headers[match[1]] = match[2];
  }
  return headers;
}

function ensureNode(nodes, fen, chapter) {
  const normalized = normalizeFen(fen);
  if (!nodes.has(normalized)) {
    nodes.set(normalized, { fen: normalized, moves: [], chapters: new Set() });
  }
  if (chapter) nodes.get(normalized).chapters.add(chapter);
  return nodes.get(normalized);
}

function addMoveToTree(nodes, fromFen, toFen, move) {
  const node = ensureNode(nodes, fromFen);
  const existing = node.moves.find((candidate) => candidate.uci === move.uci);
  if (!existing) {
    node.moves.push({ ...move, nextFen: normalizeFen(toFen) });
  }
}

function parseFen(fen) {
  const [placement, turn = 'w', castling = '-', enPassant = '-', halfmove = '0', fullmove = '1'] = String(fen || START_FEN).trim().split(/\s+/);
  const board = Array(64).fill(null);
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error('Invalid FEN placement');

  rows.forEach((row, rankIndex) => {
    let file = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        file += Number(char);
      } else {
        board[rankIndex * 8 + file] = char;
        file += 1;
      }
    }
  });

  return {
    board,
    turn,
    castling: castling === '-' ? '' : castling,
    enPassant: enPassant === '-' ? null : enPassant,
    halfmove: Number(halfmove) || 0,
    fullmove: Number(fullmove) || 1
  };
}

function cloneState(chessState) {
  return {
    board: [...chessState.board],
    turn: chessState.turn,
    castling: chessState.castling,
    enPassant: chessState.enPassant,
    halfmove: chessState.halfmove,
    fullmove: chessState.fullmove
  };
}

function keyFen(chessState) {
  return normalizeFen(toFen(chessState));
}

function normalizeFen(fen) {
  const parts = String(fen || START_FEN).trim().split(/\s+/);
  if (parts.length < 4) return normalizeFen(START_FEN);
  return `${parts[0]} ${parts[1]} ${parts[2] || '-'} ${parts[3] || '-'}`;
}

function displayFen(fen) {
  const normalized = normalizeFen(fen);
  return `${normalized} 0 1`;
}

function toFen(chessState) {
  const rows = [];
  for (let rank = 0; rank < 8; rank += 1) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = chessState.board[rank * 8 + file];
      if (!piece) {
        empty += 1;
      } else {
        if (empty) {
          row += empty;
          empty = 0;
        }
        row += piece;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }

  return [
    rows.join('/'),
    chessState.turn,
    chessState.castling || '-',
    chessState.enPassant || '-',
    chessState.halfmove,
    chessState.fullmove
  ].join(' ');
}

function squareToIndex(square) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  if (file < 0 || !RANKS.includes(square[1])) throw new Error(`Invalid square ${square}`);
  return (8 - rank) * 8 + file;
}

function indexToSquare(index) {
  const file = index % 8;
  const rank = 8 - Math.floor(index / 8);
  return `${FILES[file]}${rank}`;
}

function colorOf(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

function typeOf(piece) {
  return piece?.toUpperCase() ?? null;
}

function enemyOf(color) {
  return color === 'w' ? 'b' : 'w';
}

function isInside(file, rank) {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

function cleanSan(san) {
  return String(san || '')
    .replace(/[!?]+/g, '')
    .replace(/e\.p\./gi, '')
    .trim();
}

function moveFromSan(chessState, san) {
  const normalized = cleanSan(san);
  const candidates = generateLegalMoves(chessState);

  if (/^(O-O|0-0)([+#])?$/.test(normalized)) {
    return findSingleMove(candidates, (move) => move.castle === 'king', san);
  }

  if (/^(O-O-O|0-0-0)([+#])?$/.test(normalized)) {
    return findSingleMove(candidates, (move) => move.castle === 'queen', san);
  }

  const withoutCheck = normalized.replace(/[+#]$/g, '');
  const promotionMatch = withoutCheck.match(/=?([QRBN])$/);
  const promotion = promotionMatch ? promotionMatch[1].toLowerCase() : null;
  const withoutPromotion = promotion ? withoutCheck.replace(/=?[QRBN]$/, '') : withoutCheck;
  const targetMatch = withoutPromotion.match(/([a-h][1-8])$/);
  if (!targetMatch) throw new Error(`Cannot parse SAN ${san}`);

  const target = targetMatch[1];
  const targetIndex = squareToIndex(target);
  let prefix = withoutPromotion.slice(0, -2).replace('x', '');
  let pieceType = 'P';

  if (/^[KQRBN]/.test(prefix)) {
    pieceType = prefix[0];
    prefix = prefix.slice(1);
  }

  const sourceHint = prefix;
  return findSingleMove(
    candidates,
    (move) => {
      if (typeOf(move.piece) !== pieceType) return false;
      if (move.to !== targetIndex) return false;
      if (promotion && move.promotion !== promotion) return false;
      if (!promotion && move.promotion) return false;
      if (!sourceHint) return true;
      const from = indexToSquare(move.from);
      return sourceHint.split('').every((hint) => from.includes(hint));
    },
    san
  );
}

function findSingleMove(candidates, predicate, san) {
  const matches = candidates.filter(predicate);
  if (!matches.length) throw new Error(`No legal move for ${san}`);
  return matches[0];
}

function moveToUci(move) {
  return `${indexToSquare(move.from)}${indexToSquare(move.to)}${move.promotion || ''}`;
}

function moveToSan(chessState, move) {
  if (move.castle === 'king') return 'O-O';
  if (move.castle === 'queen') return 'O-O-O';

  const pieceType = typeOf(move.piece);
  const to = indexToSquare(move.to);
  const capture = move.capture || move.enPassant;
  const promotion = move.promotion ? `=${move.promotion.toUpperCase()}` : '';

  if (pieceType === 'P') {
    const fromFile = indexToSquare(move.from)[0];
    return `${capture ? `${fromFile}x` : ''}${to}${promotion}`;
  }

  return `${pieceType}${capture ? 'x' : ''}${to}`;
}

function legalMoveByUci(fen, uci) {
  const chessState = stateFromKeyFen(fen);
  const legal = generateLegalMoves(chessState);
  const move = legal.find((candidate) => moveToUci(candidate) === uci);
  return move ? { chessState, move } : null;
}

export function playLegalUciMove(fen, uci) {
  const matched = legalMoveByUci(fen, uci);
  if (!matched) throw new Error(`Move ${uci} is not legal from this position`);
  const next = applyMove(matched.chessState, matched.move);
  const nextFen = keyFen(next);
  return {
    nextFen,
    move: {
      san: moveToSan(matched.chessState, matched.move),
      uci: moveToUci(matched.move),
      from: indexToSquare(matched.move.from),
      to: indexToSquare(matched.move.to),
      promotion: matched.move.promotion || null,
      piece: matched.move.piece,
      capture: matched.move.capture || null,
      nextFen
    }
  };
}

export function parseUciBestMove(output) {
  const match = String(output || '').match(/(?:^|\n)bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?|0000)\b/);
  if (!match || match[1] === '0000') return null;
  return match[1];
}

export function parseEngineErrorPayload(text, status = 500, contentType = '') {
  const body = String(text || '').trim();
  if (String(contentType || '').includes('application/json')) {
    try {
      return JSON.parse(body).error || `HTTP ${status}`;
    } catch {
      return `引擎接口返回了无效 JSON（HTTP ${status}）。`;
    }
  }
  if (status === 404 || /^not found$/i.test(body)) {
    return '引擎接口不存在。请关闭旧页面/旧服务器后重新用桌面快捷方式启动。';
  }
  return body || `HTTP ${status}`;
}

function scoreFromMate(mate) {
  const value = Number(mate);
  if (!Number.isFinite(value)) return null;
  if (value === 0) return 0;
  return value > 0 ? 200000 : -200000;
}

export function parseUciInfoLines(lines) {
  return (Array.isArray(lines) ? lines : String(lines || '').split(/\r?\n/))
    .map((line) => {
      const multipv = Number(line.match(/\bmultipv\s+(\d+)/)?.[1] || 1);
      const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
      const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
      const pvText = line.match(/\bpv\s+(.+)$/)?.[1] || '';
      const pv = pvText.split(/\s+/).filter((token) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token));
      if (!pv.length || (!cpMatch && !mateMatch)) return null;
      const mate = mateMatch ? Number(mateMatch[1]) : null;
      return {
        multipv,
        scoreCp: cpMatch ? Number(cpMatch[1]) : scoreFromMate(mate),
        mate,
        move: pv[0],
        pv
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.multipv - b.multipv);
}

export function pickHumanizedEngineMove(candidates, profile, random = Math.random) {
  const moves = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.move && Number.isFinite(candidate.scoreCp))
    .sort((a, b) => b.scoreCp - a.scoreCp);
  if (!moves.length) return null;
  if (!profile || profile.mode === 'stockfish' || profile.mode === 'maia3') return moves[0].move;
  if (profile.strictEngineMove) return moves[0].move;

  const bestScore = moves[0].scoreCp;
  const tolerance = Number(profile.toleranceCp) || 0;
  const limitedMoves = Number.isInteger(profile.stockfishCandidateLimit)
    ? moves.slice(0, profile.stockfishCandidateLimit)
    : moves;
  const pool = limitedMoves.filter((candidate) => bestScore - candidate.scoreCp <= tolerance);
  const viable = pool.length ? pool : [moves[0]];
  const index = Math.min(viable.length - 1, Math.floor(random() * viable.length));
  return viable[index].move;
}

export function selectEngineReplyMove({ payload, candidates, profile, random = Math.random } = {}) {
  if (payload?.openingPrior?.source === 'opening-prior' && payload.bestmove) {
    return payload.bestmove;
  }
  if (payload?.engine === 'maia3') {
    return payload.bestmove || parseUciBestMove(payload.output);
  }
  return pickHumanizedEngineMove(candidates, profile, random) || payload?.bestmove || parseUciBestMove(payload?.output);
}

function generateLegalMoves(chessState) {
  return generatePseudoMoves(chessState).filter((move) => {
    const next = applyMove(chessState, move);
    return !isKingInCheck(next, enemyOf(next.turn));
  });
}

function generatePseudoMoves(chessState) {
  const moves = [];
  for (let index = 0; index < chessState.board.length; index += 1) {
    const piece = chessState.board[index];
    if (!piece || colorOf(piece) !== chessState.turn) continue;
    const type = typeOf(piece);
    if (type === 'P') addPawnMoves(chessState, index, moves);
    if (type === 'N') addStepMoves(chessState, index, moves, [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
    if (type === 'B') addSlideMoves(chessState, index, moves, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    if (type === 'R') addSlideMoves(chessState, index, moves, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
    if (type === 'Q') addSlideMoves(chessState, index, moves, [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]);
    if (type === 'K') addKingMoves(chessState, index, moves);
  }
  return moves;
}

function addPawnMoves(chessState, index, moves) {
  const piece = chessState.board[index];
  const color = colorOf(piece);
  const direction = color === 'w' ? -1 : 1;
  const startRank = color === 'w' ? 6 : 1;
  const promoteRank = color === 'w' ? 0 : 7;
  const file = index % 8;
  const rank = Math.floor(index / 8);
  const oneRank = rank + direction;

  if (isInside(file, oneRank)) {
    const one = oneRank * 8 + file;
    if (!chessState.board[one]) {
      addPawnMoveVariants(moves, chessState, index, one, promoteRank);
      const twoRank = rank + direction * 2;
      const two = twoRank * 8 + file;
      if (rank === startRank && !chessState.board[two]) {
        moves.push(baseMove(chessState, index, two));
      }
    }
  }

  for (const df of [-1, 1]) {
    const targetFile = file + df;
    if (!isInside(targetFile, oneRank)) continue;
    const target = oneRank * 8 + targetFile;
    const targetPiece = chessState.board[target];
    const targetSquare = indexToSquare(target);
    if (targetPiece && colorOf(targetPiece) !== color) {
      addPawnMoveVariants(moves, chessState, index, target, promoteRank, targetPiece);
    } else if (chessState.enPassant === targetSquare) {
      const move = baseMove(chessState, index, target);
      move.enPassant = true;
      move.capture = color === 'w' ? 'p' : 'P';
      moves.push(move);
    }
  }
}

function addPawnMoveVariants(moves, chessState, from, to, promoteRank, capture = null) {
  const targetRank = Math.floor(to / 8);
  if (targetRank === promoteRank) {
    for (const promotion of ['q', 'r', 'b', 'n']) {
      moves.push({ ...baseMove(chessState, from, to), promotion, capture });
    }
  } else {
    moves.push({ ...baseMove(chessState, from, to), capture });
  }
}

function addStepMoves(chessState, index, moves, deltas) {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  for (const [df, dr] of deltas) {
    const targetFile = file + df;
    const targetRank = rank + dr;
    if (!isInside(targetFile, targetRank)) continue;
    const target = targetRank * 8 + targetFile;
    const targetPiece = chessState.board[target];
    if (!targetPiece || colorOf(targetPiece) !== chessState.turn) {
      moves.push({ ...baseMove(chessState, index, target), capture: targetPiece });
    }
  }
}

function addSlideMoves(chessState, index, moves, deltas) {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  for (const [df, dr] of deltas) {
    let targetFile = file + df;
    let targetRank = rank + dr;
    while (isInside(targetFile, targetRank)) {
      const target = targetRank * 8 + targetFile;
      const targetPiece = chessState.board[target];
      if (!targetPiece) {
        moves.push(baseMove(chessState, index, target));
      } else {
        if (colorOf(targetPiece) !== chessState.turn) {
          moves.push({ ...baseMove(chessState, index, target), capture: targetPiece });
        }
        break;
      }
      targetFile += df;
      targetRank += dr;
    }
  }
}

function addKingMoves(chessState, index, moves) {
  addStepMoves(chessState, index, moves, [[1, 1], [1, 0], [1, -1], [0, 1], [0, -1], [-1, 1], [-1, 0], [-1, -1]]);
  const color = chessState.turn;
  const enemy = enemyOf(color);
  if (isKingInCheck(chessState, color)) return;

  if (color === 'w' && index === squareToIndex('e1')) {
    if (chessState.castling.includes('K') && !chessState.board[squareToIndex('f1')] && !chessState.board[squareToIndex('g1')] && !isSquareAttacked(chessState, squareToIndex('f1'), enemy) && !isSquareAttacked(chessState, squareToIndex('g1'), enemy)) {
      moves.push({ ...baseMove(chessState, index, squareToIndex('g1')), castle: 'king' });
    }
    if (chessState.castling.includes('Q') && !chessState.board[squareToIndex('d1')] && !chessState.board[squareToIndex('c1')] && !chessState.board[squareToIndex('b1')] && !isSquareAttacked(chessState, squareToIndex('d1'), enemy) && !isSquareAttacked(chessState, squareToIndex('c1'), enemy)) {
      moves.push({ ...baseMove(chessState, index, squareToIndex('c1')), castle: 'queen' });
    }
  }

  if (color === 'b' && index === squareToIndex('e8')) {
    if (chessState.castling.includes('k') && !chessState.board[squareToIndex('f8')] && !chessState.board[squareToIndex('g8')] && !isSquareAttacked(chessState, squareToIndex('f8'), enemy) && !isSquareAttacked(chessState, squareToIndex('g8'), enemy)) {
      moves.push({ ...baseMove(chessState, index, squareToIndex('g8')), castle: 'king' });
    }
    if (chessState.castling.includes('q') && !chessState.board[squareToIndex('d8')] && !chessState.board[squareToIndex('c8')] && !chessState.board[squareToIndex('b8')] && !isSquareAttacked(chessState, squareToIndex('d8'), enemy) && !isSquareAttacked(chessState, squareToIndex('c8'), enemy)) {
      moves.push({ ...baseMove(chessState, index, squareToIndex('c8')), castle: 'queen' });
    }
  }
}

function baseMove(chessState, from, to) {
  return {
    from,
    to,
    piece: chessState.board[from],
    capture: chessState.board[to] || null,
    promotion: null
  };
}

function applyMove(chessState, move) {
  const next = cloneState(chessState);
  const piece = next.board[move.from];
  next.board[move.from] = null;

  if (move.enPassant) {
    const capturedIndex = move.to + (colorOf(piece) === 'w' ? 8 : -8);
    next.board[capturedIndex] = null;
  }

  if (move.castle === 'king') {
    if (colorOf(piece) === 'w') {
      next.board[squareToIndex('h1')] = null;
      next.board[squareToIndex('f1')] = 'R';
    } else {
      next.board[squareToIndex('h8')] = null;
      next.board[squareToIndex('f8')] = 'r';
    }
  }

  if (move.castle === 'queen') {
    if (colorOf(piece) === 'w') {
      next.board[squareToIndex('a1')] = null;
      next.board[squareToIndex('d1')] = 'R';
    } else {
      next.board[squareToIndex('a8')] = null;
      next.board[squareToIndex('d8')] = 'r';
    }
  }

  const placedPiece = move.promotion ? (colorOf(piece) === 'w' ? move.promotion.toUpperCase() : move.promotion) : piece;
  next.board[move.to] = placedPiece;
  next.castling = updateCastlingRights(next.castling, piece, move.from, move.to);

  if (typeOf(piece) === 'P' && Math.abs(move.to - move.from) === 16) {
    const epIndex = (move.to + move.from) / 2;
    next.enPassant = indexToSquare(epIndex);
  } else {
    next.enPassant = null;
  }

  next.halfmove = typeOf(piece) === 'P' || move.capture ? 0 : next.halfmove + 1;
  if (next.turn === 'b') next.fullmove += 1;
  next.turn = enemyOf(next.turn);
  return next;
}

function updateCastlingRights(castling, piece, from, to) {
  let rights = castling || '';
  const remove = (chars) => {
    for (const char of chars) rights = rights.replace(char, '');
  };

  if (piece === 'K') remove('KQ');
  if (piece === 'k') remove('kq');
  if (from === squareToIndex('h1') || to === squareToIndex('h1')) remove('K');
  if (from === squareToIndex('a1') || to === squareToIndex('a1')) remove('Q');
  if (from === squareToIndex('h8') || to === squareToIndex('h8')) remove('k');
  if (from === squareToIndex('a8') || to === squareToIndex('a8')) remove('q');
  return rights;
}

function isKingInCheck(chessState, color) {
  const king = color === 'w' ? 'K' : 'k';
  const kingIndex = chessState.board.findIndex((piece) => piece === king);
  if (kingIndex < 0) return false;
  return isSquareAttacked(chessState, kingIndex, enemyOf(color));
}

function isSquareAttacked(chessState, square, attackerColor) {
  const file = square % 8;
  const rank = Math.floor(square / 8);
  const pawnDirection = attackerColor === 'w' ? -1 : 1;
  const pawn = attackerColor === 'w' ? 'P' : 'p';

  for (const df of [-1, 1]) {
    const sourceFile = file - df;
    const sourceRank = rank - pawnDirection;
    if (isInside(sourceFile, sourceRank) && chessState.board[sourceRank * 8 + sourceFile] === pawn) return true;
  }

  const knight = attackerColor === 'w' ? 'N' : 'n';
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    const sourceFile = file + df;
    const sourceRank = rank + dr;
    if (isInside(sourceFile, sourceRank) && chessState.board[sourceRank * 8 + sourceFile] === knight) return true;
  }

  if (attackedBySlider(chessState, file, rank, attackerColor, [[1, 1], [1, -1], [-1, 1], [-1, -1]], ['B', 'Q'])) return true;
  if (attackedBySlider(chessState, file, rank, attackerColor, [[1, 0], [-1, 0], [0, 1], [0, -1]], ['R', 'Q'])) return true;

  const king = attackerColor === 'w' ? 'K' : 'k';
  for (const [df, dr] of [[1, 1], [1, 0], [1, -1], [0, 1], [0, -1], [-1, 1], [-1, 0], [-1, -1]]) {
    const sourceFile = file + df;
    const sourceRank = rank + dr;
    if (isInside(sourceFile, sourceRank) && chessState.board[sourceRank * 8 + sourceFile] === king) return true;
  }

  return false;
}

function attackedBySlider(chessState, file, rank, attackerColor, deltas, types) {
  for (const [df, dr] of deltas) {
    let sourceFile = file + df;
    let sourceRank = rank + dr;
    while (isInside(sourceFile, sourceRank)) {
      const piece = chessState.board[sourceRank * 8 + sourceFile];
      if (piece) {
        if (colorOf(piece) === attackerColor && types.includes(typeOf(piece))) return true;
        break;
      }
      sourceFile += df;
      sourceRank += dr;
    }
  }
  return false;
}

function fenTurn(fen) {
  return normalizeFen(fen).split(' ')[1];
}

function sameSideToMove(fen, side) {
  return fenTurn(fen) === side;
}

function stateFromKeyFen(fen) {
  return parseFen(displayFen(fen));
}

function createAttemptMove(fen, fromSquare, toSquare, promotion = 'q') {
  const chessState = stateFromKeyFen(fen);
  const from = squareToIndex(fromSquare);
  const to = squareToIndex(toSquare);
  const legal = generateLegalMoves(chessState);
  return legal.find((move) => {
    if (move.from !== from || move.to !== to) return false;
    if (move.promotion) return move.promotion === promotion;
    return true;
  });
}

function countNodesWithMoves(trainer) {
  if (!trainer) return 0;
  return [...trainer.nodes.values()].filter((node) => node.moves.length).length;
}

function browserReady() {
  return typeof document !== 'undefined';
}

if (browserReady()) {
  const els = {};
  let dragGhost = null;
  let dragGhostFrame = 0;

  document.addEventListener('DOMContentLoaded', () => {
    bindElements(els);
    state.locale = DEFAULT_LOCALE;
    applyStaticTranslations(document, currentLocale());
    state.savedStudies = loadSavedStudies();
    bindEvents(els);
    render();
  });

  function bindElements(refs) {
    refs.board = document.querySelector('[data-board]');
    refs.rankLabels = document.querySelector('[data-rank-labels]');
    refs.fileLabels = document.querySelector('[data-file-labels]');
    refs.modeButtons = [...document.querySelectorAll('[data-mode-switch]')];
    refs.openingLeft = document.querySelector('[data-opening-left]');
    refs.openingRight = document.querySelector('[data-opening-right]');
    refs.endgameLeft = document.querySelector('[data-endgame-left]');
    refs.endgameRight = document.querySelector('[data-endgame-right]');
    refs.prepLeft = document.querySelector('[data-prep-left]');
    refs.prepRight = document.querySelector('[data-prep-right]');
    refs.status = document.querySelector('[data-status]');
    refs.importStatus = document.querySelector('[data-import-status]');
    refs.pgnInput = document.querySelector('[data-pgn-input]');
    refs.fileInput = document.querySelector('[data-file-input]');
    refs.urlInput = document.querySelector('[data-url-input]');
    refs.importPgn = document.querySelector('[data-import-pgn]');
    refs.appendPgn = document.querySelector('[data-append-pgn]');
    refs.importUrl = document.querySelector('[data-import-url]');
    refs.savedList = document.querySelector('[data-saved-list]');
    refs.savedCount = document.querySelector('[data-saved-count]');
    refs.studyName = document.querySelector('[data-study-name]');
    refs.renameStudy = document.querySelector('[data-rename-study]');
    refs.engineProfiles = [...document.querySelectorAll('[data-engine-profiles]')];
    refs.engineStatus = [...document.querySelectorAll('[data-engine-status]')];
    refs.engineBadge = [...document.querySelectorAll('[data-engine-badge]')];
    refs.engineStart = [...document.querySelectorAll('[data-engine-start]')];
    refs.engineStop = [...document.querySelectorAll('[data-engine-stop]')];
    refs.sideButtons = [...document.querySelectorAll('[data-side]')];
    refs.stats = document.querySelector('[data-stats]');
    refs.answers = document.querySelector('[data-answers]');
    refs.history = document.querySelector('[data-history]');
    refs.currentLine = document.querySelector('[data-current-line]');
    refs.copyPgn = document.querySelector('[data-copy-pgn]');
    refs.promotionPicker = document.querySelector('[data-promotion-picker]');
    refs.feedback = document.querySelector('[data-feedback]');
    refs.reset = document.querySelector('[data-reset]');
    refs.reveal = document.querySelector('[data-reveal]');
    refs.next = document.querySelector('[data-next]');
    refs.backStep = document.querySelector('[data-back-step]');
    refs.sample = document.querySelector('[data-sample]');
    refs.opponentPgnInput = document.querySelector('[data-opponent-pgn-input]');
    refs.opponentPgnFile = document.querySelector('[data-opponent-pgn-file]');
    refs.opponentPgnBadge = document.querySelector('[data-opponent-pgn-badge]');
    refs.prepOpponent = document.querySelector('[data-prep-opponent]');
    refs.prepSideButtons = [...document.querySelectorAll('[data-prep-side]')];
    refs.runPrepReport = document.querySelector('[data-run-prep-report]');
    refs.prepReportBadge = document.querySelector('[data-prep-report-badge]');
    refs.prepStatus = document.querySelector('[data-prep-status]');
    refs.prepStats = document.querySelector('[data-prep-stats]');
    refs.prepCommonReplies = document.querySelector('[data-prep-common-replies]');
    refs.dataPrepReport = document.querySelector('[data-prep-report]');
    refs.endgameCount = document.querySelector('[data-endgame-count]');
    refs.endgameCategories = document.querySelector('[data-endgame-categories]');
    refs.endgameLessons = document.querySelector('[data-endgame-lessons]');
    refs.endgameTeaching = document.querySelector('[data-endgame-teaching]');
    refs.endgameBadge = document.querySelector('[data-endgame-badge]');
    refs.endgameTarget = document.querySelector('[data-endgame-target]');
    refs.endgameStatus = document.querySelector('[data-endgame-status]');
    refs.endgameStats = document.querySelector('[data-endgame-stats]');
    refs.endgameAnswers = document.querySelector('[data-endgame-answers]');
    refs.endgameReset = document.querySelector('[data-endgame-reset]');
    refs.endgameHint = document.querySelector('[data-endgame-hint]');
    refs.endgameAnswer = document.querySelector('[data-endgame-answer]');
    refs.endgameNext = document.querySelector('[data-endgame-next]');
  }

  function bindEvents(refs) {
    refs.modeButtons.forEach((button) => {
      button.addEventListener('click', () => switchMode(button.dataset.modeSwitch));
    });
    refs.importPgn.addEventListener('click', () => importPgn(refs.pgnInput.value, '粘贴 PGN', { sourceKey: `content:${stableHash(refs.pgnInput.value)}` }));
    refs.appendPgn?.addEventListener('click', () => appendPgnToActiveStudy(refs.pgnInput.value, '粘贴 PGN'));
    refs.fileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const content = await file.text();
      refs.pgnInput.value = content;
      importPgn(content, file.name, { sourceKey: `content:${stableHash(content)}` });
    });
    refs.importUrl.addEventListener('click', importFromUrl);
    refs.renameStudy.addEventListener('click', renameActiveStudy);
    refs.studyName.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') renameActiveStudy();
    });
    refs.sideButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.openingSide = normalizeBoardOrientation(button.dataset.side);
        state.side = state.openingSide;
        state.completedTerminals = new Set();
        state.lastCompletedPgn = '';
        startTraining();
      });
    });
    refs.reset.addEventListener('click', () => startTraining());
    refs.reveal.addEventListener('click', revealAnswers);
    refs.next.addEventListener('click', continueOpeningTraining);
    refs.backStep?.addEventListener('click', undoOpeningStep);
    refs.copyPgn?.addEventListener('click', copyCurrentPgn);
    refs.engineStart.forEach((button) => button.addEventListener('click', startEngineTraining));
    refs.engineStop.forEach((button) => button.addEventListener('click', stopEngineTraining));
    refs.sample.addEventListener('click', () => {
      refs.pgnInput.value = samplePgn();
      importPgn(refs.pgnInput.value, '示例 PGN', { sourceKey: `content:${stableHash(refs.pgnInput.value)}` });
    });
    refs.opponentPgnInput?.addEventListener('input', () => {
      state.prep.opponentPgn = refs.opponentPgnInput.value;
      state.prep.opponentPgnName = state.prep.opponentPgn.trim() ? '粘贴 PGN' : '';
      state.prep.report = null;
      state.prep.explorerReport = null;
      render();
    });
    refs.opponentPgnFile?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const content = await file.text();
      state.prep.opponentPgn = content;
      state.prep.opponentPgnName = file.name;
      if (refs.opponentPgnInput) refs.opponentPgnInput.value = content;
      state.prep.report = null;
      state.prep.explorerReport = null;
      state.prep.status = `已载入对手棋谱：${file.name}`;
      state.prep.error = false;
      render();
    });
    refs.prepSideButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.prep.ourSide = button.dataset.prepSide === 'b' ? 'b' : 'w';
        state.prep.report = null;
        state.prep.explorerReport = null;
        if (state.mode === 'prep') {
          state.side = state.prep.ourSide;
          resetOpeningPosition();
          updatePrepBranchPrompt();
        }
        render();
      });
    });
    refs.runPrepReport?.addEventListener('click', runPrepReport);
    refs.endgameReset.addEventListener('click', resetEndgameLesson);
    refs.endgameHint.addEventListener('click', showEndgameHint);
    refs.endgameAnswer.addEventListener('click', showEndgameAnswer);
    refs.endgameNext.addEventListener('click', nextEndgameLesson);
    document.addEventListener('pointermove', updateBoardDrag);
    document.addEventListener('pointerup', finishBoardDrag);
    document.addEventListener('pointercancel', cancelBoardDrag);
    document.addEventListener('keydown', handleKeyboardNavigation);
  }

  function switchMode(mode) {
    state.mode = mode === 'endgame' ? 'endgame' : mode === 'prep' ? 'prep' : 'opening';
    state.selected = null;
    state.pendingPromotion = null;
    state.candidates = [];
    state.wrongFlash = false;
    state.engine.active = false;
    state.engine.thinking = false;
    state.engine.sparringSnapshot = null;

    if (state.mode === 'endgame') {
      ensureEndgameSession();
      const lesson = state.endgame.session.lesson;
      state.side = lesson.orientation || lesson.fen.split(/\s+/)[1] || 'w';
      state.currentFen = state.endgame.session.currentFen;
      state.currentState = stateFromKeyFen(state.currentFen);
      state.lastMove = null;
      state.moveHistory = [];
      state.redoHistory = [];
      setEndgameMessage(`${lesson.goal}。先读左侧要点，再在棋盘上走第一步。`);
      setStatus(`残局训练：${lesson.title}`);
    } else if (state.mode === 'prep') {
      state.side = state.prep.ourSide;
      state.currentFen = state.trainer?.rootFen ?? normalizeFen(START_FEN);
      state.currentState = stateFromKeyFen(state.currentFen);
      state.lastMove = null;
      state.moveHistory = [];
      state.redoHistory = [];
      state.candidates = state.trainer ? getCandidateMoves(state.trainer, state.currentFen) : [];
      state.opponentChoices = [];
      setPrepBranchStatus('备战模式：先在棋盘上选到具体开局分支，再生成报告。');
    } else {
      state.side = state.trainer ? state.openingSide : 'w';
      state.currentFen = state.trainer?.rootFen ?? normalizeFen(START_FEN);
      state.currentState = stateFromKeyFen(state.currentFen);
      state.lastMove = null;
      state.moveHistory = [];
      state.redoHistory = [];
      setStatus(state.trainer ? '已回到开局训练。' : '先导入你的 Lichess 研讨 PGN，然后开始训练。');
    }

    render();
  }

  function ensureEndgameSession() {
    if (!state.endgame.session || state.endgame.session.lesson.id !== state.endgame.lessonId) {
      state.endgame.session = createEndgameSession(state.endgame.lessonId);
    }
    return state.endgame.session;
  }

  function selectEndgameCategory(categoryId) {
    const lessons = listEndgameLessons(categoryId);
    if (!lessons.length) return;
    state.endgame.categoryId = categoryId;
    selectEndgameLesson(lessons[0].id);
  }

  function selectEndgameLesson(lessonId) {
    const lesson = getEndgameLesson(lessonId);
    if (!lesson) return;
    state.mode = 'endgame';
    state.endgame.lessonId = lesson.id;
    state.endgame.categoryId = lesson.category;
    state.endgame.session = createEndgameSession(lesson.id);
    state.endgame.hintsVisible = false;
    state.endgame.answerVisible = false;
    setEndgameMessage(`${lesson.goal}。请在棋盘上走出关键第一步。`);
    state.engine.active = false;
    state.engine.thinking = false;
    state.engine.sparringSnapshot = null;
    state.side = lesson.orientation || lesson.fen.split(/\s+/)[1] || 'w';
    state.currentFen = state.endgame.session.currentFen;
    state.currentState = stateFromKeyFen(state.currentFen);
    state.selected = null;
    state.pendingPromotion = null;
    state.lastMove = null;
    state.moveHistory = [];
    state.redoHistory = [];
    state.candidates = [];
    setStatus(`残局训练：${lesson.title}`);
    render();
  }

  function resetEndgameLesson() {
    const lesson = getEndgameLesson(state.endgame.lessonId);
    if (!lesson) return;
    selectEndgameLesson(lesson.id);
  }

  function showEndgameHint() {
    ensureEndgameSession();
    state.endgame.hintsVisible = true;
    state.endgame.answerVisible = false;
    setEndgameMessage('提示已显示。');
    render();
  }

  function showEndgameAnswer() {
    const session = ensureEndgameSession();
    state.endgame.answerVisible = true;
    state.endgame.hintsVisible = true;
    setEndgameMessage(session.expectedMove
      ? `本步答案：${session.expectedMove}`
      : '本题已经完成。');
    render();
  }

  function nextEndgameLesson() {
    const lessons = listEndgameLessons(state.endgame.categoryId);
    const index = lessons.findIndex((lesson) => lesson.id === state.endgame.lessonId);
    const next = lessons[(index + 1 + lessons.length) % lessons.length] || listEndgameLessons()[0];
    selectEndgameLesson(next.id);
  }

  function importPgn(pgn, label, options = {}) {
    if (!String(pgn || '').trim()) {
      setStatus('PGN 为空，请先粘贴或上传内容。', true);
      return;
    }

    const trainer = createTrainerFromPgn(pgn);
    if (!trainer.moveCount) {
      setStatus('导入成功但没有找到可训练的走法，请检查 PGN 是否包含主线或变化线。', true);
      return;
    }

    state.trainer = trainer;
    state.pendingPromotion = null;
    const saveResult = saveImportedStudy(pgn, label, options.sourceKey);
    state.importedLabel = saveResult.record.name;
    state.activeStudyId = saveResult.record.id;
    state.stats = { attempts: 0, correct: 0, mistakes: 0, streak: 0, covered: new Set() };
    state.completedTerminals = new Set();
    state.lastCompletedPgn = '';
    const saveText = saveResult.action === 'duplicate' ? '已存在，未重复添加' : saveResult.action === 'updated' ? '已覆盖保存' : '已保存';
    setStatus(`已导入 ${trainer.chapters.length || 1} 个章节，${trainer.moveCount} 个准备走法。${saveText}。`);
    startTraining();
  }

  function saveImportedStudy(pgn, label, sourceKey) {
    const record = createStudyRecord({ pgn, name: label, sourceKey });
    const result = upsertStudyRecord(state.savedStudies, record);
    state.savedStudies = result.records;
    persistSavedStudies();
    return result;
  }

  function appendPgnToActiveStudy(pgn, label) {
    if (!state.activeStudyId) {
      setStatus('请先选择一个已有研讨，再用追加按钮合并新内容。', true);
      render();
      return;
    }
    if (!String(pgn || '').trim()) {
      setStatus('PGN 为空，请先粘贴或上传要追加的内容。', true);
      render();
      return;
    }

    let result;
    try {
      result = appendStudyRecord(state.savedStudies, state.activeStudyId, pgn, label);
    } catch (error) {
      setStatus(`无法追加：${error.message}`, true);
      render();
      return;
    }

    const trainer = createTrainerFromPgn(result.record.pgn);
    if (!trainer.moveCount) {
      setStatus('追加后的 PGN 没有可训练走法，已保持当前研讨不变。', true);
      render();
      return;
    }

    state.savedStudies = result.records;
    state.trainer = trainer;
    state.importedLabel = result.record.name;
    state.activeStudyId = result.record.id;
    state.stats = { attempts: 0, correct: 0, mistakes: 0, streak: 0, covered: new Set() };
    state.completedTerminals = new Set();
    state.lastCompletedPgn = '';
    els.pgnInput.value = result.record.pgn;
    persistSavedStudies();
    setStatus(`已追加到“${result.record.name}”，当前共 ${trainer.chapters.length || 1} 个章节，${trainer.moveCount} 个准备走法。`);
    startTraining();
  }

  async function runPrepReport(options = {}) {
    const focus = options?.focus?.fen ? options.focus : null;
    const opponent = String(els.prepOpponent?.value || '').trim();
    const active = state.savedStudies.find((study) => study.id === state.activeStudyId);
    const prepPgn = active?.pgn || '';
    const opponentPgn = String(state.prep.opponentPgn || els.opponentPgnInput?.value || '').trim();
    if (!opponentPgn) {
      state.prep.status = '请先上传或粘贴对手 PGN。';
      state.prep.error = true;
      render();
      return;
    }
    if (!prepPgn.trim()) {
      state.prep.status = '请先在开局训练中导入你的开局准备 PGN。';
      state.prep.error = true;
      render();
      return;
    }

    state.prep.loading = true;
    state.prep.error = false;
    state.prep.status = '正在分析上传棋谱并比对当前开局准备...';
    render();
    try {
      const response = await fetch('/prep-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opponent,
          opponentPgn,
          opponentPgnName: state.prep.opponentPgnName || 'uploaded-opponent.pgn',
          ourSide: state.prep.ourSide,
          prepPgn,
          focusFen: focus?.fen || state.currentFen,
          focusPly: Number.isFinite(Number(focus?.ply)) ? Number(focus.ply) : state.moveHistory.length,
          focusLine: focus ? focusLineFromPrepScope(focus) : formatMoveHistoryPgn(state.moveHistory),
          maxPly: 40
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      state.prep.report = payload;
      state.prep.explorerReport = payload;
      const treeStatus = formatPrepOpeningTreeStatus(payload.openingTree);
      state.prep.status = `已生成报告：${payload.sampleGames || 0} 盘上传棋谱样本${treeStatus ? `，${treeStatus}` : ''}。`;
      state.prep.error = false;
    } catch (error) {
      state.prep.status = `备战报告生成失败：${error.message}`;
      state.prep.error = true;
    } finally {
      state.prep.loading = false;
      render();
    }
  }

  function focusLineFromPrepScope(scope) {
    const line = String(scope?.positionLine || '').trim();
    if (!line || line === '起始局面' || line === 'Starting position') return '';
    return line;
  }

  function startTraining(message = '') {
    state.engine.active = false;
    state.engine.thinking = false;
    state.engine.status = '从当前局面开始，选择档位后点击开始。';
    state.pendingPromotion = null;
    if (!message) state.lastCompletedPgn = '';
    state.openingLinePaused = false;
    resetOpeningPosition();

    if (!state.trainer) {
      setStatus('先导入你的 Lichess 研讨 PGN，然后开始训练。');
      render();
      return;
    }

    state.stats.covered.add(state.currentFen);
    if (!getCandidateMoves(state.trainer, state.currentFen).length) {
      setStatus('这个研讨没有可训练的根局面走法。');
      render();
      return;
    }

    const advanced = autoplayOpponent();
    if (!advanced) updatePrompt();
    if (message) setStatus(message);
    render();
  }

  function continueOpeningTraining() {
    if (!state.openingLinePaused) {
      startTraining();
      return;
    }

    state.openingLinePaused = false;
    resetOpeningPosition();
    state.stats.covered.add(state.currentFen);
    const advanced = autoplayOpponent();
    if (!advanced) updatePrompt();
    render();
  }

  function resetOpeningPosition() {
    state.currentFen = state.trainer?.rootFen ?? normalizeFen(START_FEN);
    state.currentState = stateFromKeyFen(state.currentFen);
    state.selected = null;
    state.pendingPromotion = null;
    state.lastMove = null;
    state.moveHistory = [];
    state.redoHistory = [];
    state.candidates = [];
    state.opponentChoices = [];
    state.wrongFlash = false;
    state.lineStatsSnapshot = snapshotOpeningStats();
  }

  function snapshotOpeningStats() {
    return {
      attempts: state.stats.attempts,
      correct: state.stats.correct,
      mistakes: state.stats.mistakes,
      streak: state.stats.streak
    };
  }

  function restoreOpeningStats(snapshot) {
    if (!snapshot) return;
    state.stats.attempts = snapshot.attempts;
    state.stats.correct = snapshot.correct;
    state.stats.mistakes = snapshot.mistakes;
    state.stats.streak = snapshot.streak;
  }

  function loadSavedStudies() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVED_STUDIES_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((record) => record?.id && record?.pgn) : [];
    } catch {
      return [];
    }
  }

  function persistSavedStudies() {
    localStorage.setItem(SAVED_STUDIES_KEY, JSON.stringify(state.savedStudies));
  }

  function loadSavedStudy(id) {
    const record = state.savedStudies.find((study) => study.id === id);
    if (!record) return;
    const trainer = createTrainerFromPgn(record.pgn);
    if (!trainer.moveCount) {
      setStatus('这个已保存研讨没有可训练走法。', true);
      return;
    }

    state.trainer = trainer;
    state.activeStudyId = record.id;
    state.importedLabel = record.name;
    els.pgnInput.value = record.pgn;
    if (els.studyName) els.studyName.value = record.name;
    state.stats = { attempts: 0, correct: 0, mistakes: 0, streak: 0, covered: new Set() };
    state.completedTerminals = new Set();
    state.lastCompletedPgn = '';
    setStatus(`已载入“${record.name}”。`);
    startTraining();
  }

  function renameActiveStudy() {
    if (!state.activeStudyId) {
      setStatus('请先选择或导入一个研讨。', true);
      return;
    }

    const name = els.studyName.value.trim();
    if (!name) {
      setStatus('研讨名称不能为空。', true);
      return;
    }

    const index = state.savedStudies.findIndex((study) => study.id === state.activeStudyId);
    if (index < 0) return;
    state.savedStudies[index] = {
      ...state.savedStudies[index],
      name,
      updatedAt: new Date().toISOString()
    };
    state.importedLabel = name;
    persistSavedStudies();
    setStatus(`已改名为“${name}”。`);
    render();
  }

  function autoplayOpponent() {
    state.opponentChoices = [];
    while (state.trainer && !sameSideToMove(state.currentFen, state.side)) {
      const decision = getOpponentBranchDecision(state.trainer, state.currentFen);
      if (decision.mode === 'done') {
        return advanceAfterOpeningLineCompleted('这处后续 variation 已完成，已停在最终局面。');
      }
      if (decision.mode === 'choose') {
        state.candidates = [];
        state.opponentChoices = decision.moves;
        state.selected = null;
        setStatus('选择对手分支：可直接在棋盘点击或拖动高亮走法。');
        return false;
      }
      const move = chooseRandomCandidateMove(state.trainer, state.currentFen) || decision.move;
      playPreparedMove(move, false);
      if (advanceAfterOpeningLineCompleted('上一条线已完成，已停在最终局面。')) return true;
    }
    return false;
  }

  function playPreparedMove(move, byUser) {
    state.currentFen = move.nextFen;
    state.currentState = stateFromKeyFen(state.currentFen);
    state.lastMove = { from: move.from, to: move.to };
    state.moveHistory.push({ ...move, byUser });
    if (!state.preservingRedo) state.redoHistory = [];
    state.stats.covered.add(state.currentFen);
  }

  function chooseOpponentBranch(move) {
    if (!move) return false;
    state.opponentChoices = [];
    state.candidates = [];
    state.selected = null;
    playPreparedMove(move, false);
    const advanced = autoplayOpponent() || advanceAfterOpeningLineCompleted('上一条线已完成，已停在最终局面。');
    if (!advanced) updatePrompt();
    render();
    return true;
  }

  function advanceAfterOpeningLineCompleted(message) {
    if (!state.trainer) return false;

    const action = getOpeningLineCompletionAction({
      trainer: state.trainer,
      currentFen: state.currentFen,
      moveHistory: state.moveHistory,
      completedTerminalFens: state.completedTerminals
    });
    const rawMoves = getCandidateMoves(state.trainer, state.currentFen);
    if (rawMoves.length) return false;

    if (action.mode === 'pause') {
      if (action.alreadyCompleted) restoreOpeningStats(state.lineStatsSnapshot);
      state.completedTerminals.add(action.terminalFen);
      state.lastCompletedPgn = action.pgn;
      state.openingLinePaused = true;
      state.candidates = [];
      state.opponentChoices = [];
      state.selected = null;
      setStatus(action.message);
      return true;
    }

    const rootChoices = getAvailableCandidateMoves(state.trainer, state.trainer.rootFen, state.completedTerminals);
    if (!rootChoices.length) {
      state.candidates = [];
      state.opponentChoices = [];
      state.selected = null;
      setStatus('全部 variation 已完成。正确率和连对已保留。');
      return true;
    }
    return false;
  }

  function undoOpeningStep() {
    if (state.mode === 'prep') {
      undoPrepStep();
      return;
    }
    if (state.mode !== 'opening' || !state.trainer || state.engine.active) return;
    if (!state.moveHistory.length) {
      setStatus('当前没有可返回的开局走法。');
      render();
      return;
    }

    const previous = rewindMoveHistoryToPreviousTurn(state.moveHistory, state.trainer.rootFen, state.side);
    state.preservingRedo = true;
    state.moveHistory = previous.moveHistory;
    state.redoHistory = previous.redoMoves;
    state.preservingRedo = false;
    state.currentFen = previous.currentFen;
    state.currentState = stateFromKeyFen(state.currentFen);
    state.lastMove = previous.lastMove;
    state.openingLinePaused = false;
    state.selected = null;
    state.candidates = [];
    state.opponentChoices = [];
    updatePrompt();
    setStatus('已退回上一个你的选择点，统计不变。');
    render();
  }

  function undoPrepStep() {
    if (!state.trainer || state.engine.active) return;
    if (!state.moveHistory.length) {
      setPrepBranchStatus('当前没有可回退的备战走法。');
      render();
      return;
    }

    const previous = rewindMoveHistoryOnePly(state.moveHistory, state.trainer.rootFen, state.redoHistory);
    state.moveHistory = previous.moveHistory;
    state.redoHistory = previous.redoMoves;
    state.currentFen = previous.currentFen;
    state.currentState = stateFromKeyFen(state.currentFen);
    state.lastMove = previous.lastMove;
    state.openingLinePaused = false;
    state.selected = null;
    state.candidates = [];
    state.opponentChoices = [];
    state.prep.report = null;
    updatePrepBranchPrompt();
    setPrepBranchStatus('已回退一步；可以继续摆分支，或在当前局面重新生成备战报告。');
    render();
  }

  function redoOpeningStep() {
    if (state.mode !== 'opening' || !state.trainer || state.engine.active || !state.redoHistory.length) return;
    const restored = restoreMoveHistorySegment(state.moveHistory, state.redoHistory);
    state.preservingRedo = true;
    state.moveHistory = restored.moveHistory;
    state.redoHistory = [];
    state.preservingRedo = false;
    state.currentFen = restored.currentFen;
    state.currentState = stateFromKeyFen(state.currentFen);
    state.lastMove = restored.lastMove;
    state.selected = null;
    state.candidates = [];
    state.opponentChoices = [];
    const action = getOpeningLineCompletionAction({
      trainer: state.trainer,
      currentFen: state.currentFen,
      moveHistory: state.moveHistory,
      completedTerminalFens: state.completedTerminals
    });
    if (action.mode === 'pause') {
      state.openingLinePaused = true;
      state.lastCompletedPgn = action.pgn;
      setStatus('已回到刚才下过的最终局面；点击“继续下一条”再切换。');
    } else {
      state.openingLinePaused = false;
      updatePrompt();
      setStatus('已回到刚才下过的局面。');
    }
    render();
  }

  function handleKeyboardNavigation(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      undoOpeningStep();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      redoOpeningStep();
    }
  }

  async function copyCurrentPgn() {
    const pgn = formatMoveHistoryPgn(state.moveHistory) || state.lastCompletedPgn || '';
    if (!pgn) {
      setStatus('当前还没有可复制的 PGN。');
      render();
      return;
    }

    try {
      await navigator.clipboard.writeText(pgn);
      setStatus('当前 PGN 已复制。');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(els.currentLine);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      setStatus('浏览器限制了自动复制，已选中当前 PGN，可按 Ctrl+C 复制。');
    }
    render();
  }

  function playFreeMove(move, byUser) {
    const result = playLegalUciMove(state.currentFen, move.uci);
    state.currentFen = result.nextFen;
    state.currentState = stateFromKeyFen(state.currentFen);
    state.lastMove = { from: result.move.from, to: result.move.to };
    state.moveHistory.push({ ...result.move, byUser, san: move.san || result.move.san });
    if (!state.preservingRedo) state.redoHistory = [];
  }

  function attemptSquare(square) {
    if (state.drag.suppressClick) {
      state.drag.suppressClick = false;
      return;
    }

    if (state.mode === 'endgame' && !state.engine.active && ensureEndgameSession().completed) {
      setEndgameMessage('本题已经完成，点击“下一题”继续。');
      render();
      return;
    }

    const next = boardInputReducer(state.selected, square, canSelectBoardSquare);
    state.selected = next.selected;
    if (next.attempt) {
      attemptMoveFromSquares(next.attempt.from, next.attempt.to);
      return;
    }
    render();
  }

  function canSelectBoardSquare(square) {
    const piece = state.currentState.board[squareToIndex(square)];
    if (!piece) return false;

    if (state.engine.active) {
      return !state.engine.thinking && colorOf(piece) === state.side;
    }

    if (state.mode === 'endgame') {
      const session = ensureEndgameSession();
      const sideToMove = state.currentFen.split(/\s+/)[1] || session.lesson.orientation || 'w';
      return !session.completed && colorOf(piece) === sideToMove;
    }

    if (state.mode === 'prep') {
      return Boolean(state.trainer)
        && getCandidateMoves(state.trainer, state.currentFen).some((move) => move.from === square);
    }

    if (state.opponentChoices.length) {
      return state.opponentChoices.some((move) => move.from === square);
    }

    if (state.openingLinePaused) return false;

    return Boolean(state.trainer) && sameSideToMove(state.currentFen, state.side) && colorOf(piece) === state.side;
  }

  function beginBoardDrag(event, square, piece) {
    if (!piece || !canSelectBoardSquare(square)) return;
    if (event.button !== undefined && event.button !== 0) return;

    state.drag = {
      active: true,
      dragging: false,
      from: square,
      piece,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      suppressClick: false
    };
  }

  function updateBoardDrag(event) {
    if (!state.drag.active || state.drag.pointerId !== event.pointerId) return;
    state.drag.x = event.clientX;
    state.drag.y = event.clientY;

    const deltaX = event.clientX - state.drag.startX;
    const deltaY = event.clientY - state.drag.startY;
    if (!state.drag.dragging && Math.hypot(deltaX, deltaY) >= 4) {
      state.drag.dragging = true;
      state.selected = state.drag.from;
      showBoardDragVisuals();
      ensureDragGhost();
    }

    if (state.drag.dragging) {
      event.preventDefault();
      queueDragGhostMove();
    }
  }

  function finishBoardDrag(event) {
    if (!state.drag.active || state.drag.pointerId !== event.pointerId) return;
    const wasDragging = state.drag.dragging;
    const from = state.drag.from;
    const to = squareFromPoint(event.clientX, event.clientY);
    const canAttempt = wasDragging && from && to && from !== to;
    state.drag = {
      active: false,
      dragging: false,
      from: null,
      piece: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      suppressClick: wasDragging
    };
    removeDragGhost();

    if (canAttempt) {
      state.selected = null;
      attemptMoveFromSquares(from, to);
      return;
    }

    if (wasDragging) {
      state.selected = null;
      render();
    }
  }

  function cancelBoardDrag() {
    if (!state.drag.active) return;
    state.drag = {
      active: false,
      dragging: false,
      from: null,
      piece: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      suppressClick: true
    };
    state.selected = null;
    removeDragGhost();
    render();
  }

  function showBoardDragVisuals() {
    if (!els.board || !state.drag.from) return;
    const legalTargets = getLegalDestinationSquares(state.currentFen, state.drag.from);
    els.board.querySelectorAll('[data-square]').forEach((squareElement) => {
      const square = squareElement.dataset.square;
      squareElement.classList.toggle('selected', square === state.drag.from);
      squareElement.classList.toggle('drag-source', square === state.drag.from);
      squareElement.classList.toggle('legal-target', legalTargets.includes(square));
    });
  }

  function queueDragGhostMove() {
    if (!dragGhost) ensureDragGhost();
    if (dragGhostFrame) return;
    dragGhostFrame = requestAnimationFrame(moveDragGhost);
  }

  function moveDragGhost() {
    dragGhostFrame = 0;
    if (!dragGhost || !state.drag.dragging) return;
    dragGhost.style.transform = `translate3d(${state.drag.x}px, ${state.drag.y}px, 0) translate(-50%, -50%)`;
  }

  function ensureDragGhost() {
    if (!state.drag.dragging || !state.drag.piece) return;
    if (!dragGhost) {
      dragGhost = document.createElement('span');
      dragGhost.className = `piece piece-drag-ghost ${pieceAssetClass(state.drag.piece)}`;
      dragGhost.setAttribute('aria-hidden', 'true');
      const boardRect = els.board.getBoundingClientRect();
      dragGhost.style.setProperty('--drag-piece-size', `${boardRect.width / 8}px`);
      document.body.appendChild(dragGhost);
    }
    moveDragGhost();
  }

  function removeDragGhost() {
    if (dragGhostFrame) {
      cancelAnimationFrame(dragGhostFrame);
      dragGhostFrame = 0;
    }
    dragGhost?.remove();
    dragGhost = null;
  }

  function squareFromPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    return element?.closest?.('[data-square]')?.dataset.square || null;
  }

  function attemptMoveFromSquares(from, to, promotion = null, options = {}) {
    if (!options.skipPromotionPrompt) {
      const choices = getPromotionChoicesForMove(state.currentFen, from, to);
      if (choices.length) {
        state.pendingPromotion = { from, to, choices };
        state.selected = null;
        setStatus('请选择升变棋子。');
        render();
        return;
      }
    }
    state.pendingPromotion = null;

    if (state.mode === 'endgame') {
      if (state.engine.active) {
        attemptEngineMove(from, to, promotion);
      } else {
        attemptEndgameMove(from, to, promotion);
      }
      return;
    }

    if (state.engine.active) {
      attemptEngineMove(from, to, promotion);
      return;
    }

    if (state.mode === 'prep') {
      attemptPrepMove(from, to, promotion);
      return;
    }

    attemptOpeningMove(from, to, promotion);
  }

  function setPrepBranchStatus(message, isError = false) {
    state.prep.status = message;
    state.prep.error = isError;
    renderFeedback();
  }

  function updatePrepBranchPrompt() {
    if (!state.trainer) return;
    const moves = getCandidateMoves(state.trainer, state.currentFen);
    state.candidates = moves;
    state.opponentChoices = [];
    if (!moves.length) {
      setPrepBranchStatus('这条准备线已经走完，可在当前局面生成备战报告。');
      return;
    }
    const sideName = sameSideToMove(state.currentFen, state.prep.ourSide) ? '我方' : '对手';
    setPrepBranchStatus(`选择${sideName}开局分支，走到要分析的具体开局后生成备战报告。`);
  }

  function attemptPrepMove(from, to, promotion = null) {
    if (!state.trainer) return;
    if (state.openingLinePaused) state.openingLinePaused = false;
    const moves = getCandidateMoves(state.trainer, state.currentFen);
    const prepared = findPreparedMoveFromSquares(state.currentFen, from, to, moves, promotion);

    if (!prepared) {
      state.selected = null;
      state.candidates = moves;
      state.opponentChoices = [];
      setPrepBranchStatus('这步不在当前准备分支里；请沿研讨 PGN 选择开局。', true);
      render();
      return;
    }

    state.selected = null;
    state.candidates = [];
    state.opponentChoices = [];
    state.prep.report = null;
    playPreparedMove(prepared, sameSideToMove(state.currentFen, state.prep.ourSide));
    updatePrepBranchPrompt();
    render();
  }

  function applyPrepScope(scope) {
    if (!scope?.fen) return false;
    state.currentFen = normalizeFen(scope.fen);
    state.currentState = stateFromKeyFen(state.currentFen);
    state.moveHistory = prepScopeMovesFromSelection(scope);
    state.redoHistory = [];
    state.lastMove = state.moveHistory.length
      ? {
          from: state.moveHistory.at(-1).from,
          to: state.moveHistory.at(-1).to
        }
      : null;
    state.selected = null;
    state.pendingPromotion = null;
    state.openingLinePaused = false;
    state.candidates = state.trainer ? getCandidateMoves(state.trainer, state.currentFen) : [];
    state.opponentChoices = [];
    return true;
  }

  function preparedMoveDepthScore(move, seen = new Set()) {
    if (!state.trainer || !move?.nextFen) return 0;
    const fen = normalizeFen(move.nextFen);
    if (seen.has(fen)) return 1;
    seen.add(fen);
    const replies = getCandidateMoves(state.trainer, fen);
    return 1 + replies.reduce((total, reply) => total + preparedMoveDepthScore(reply, new Set(seen)), 0);
  }

  function rankCurrentPreparedMoves(fen) {
    return getCandidateMoves(state.trainer, fen)
      .map((move, index) => ({ move, index, score: preparedMoveDepthScore(move) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.move);
  }

  function prepScopeMovesFromSelection(scope) {
    const moves = [];
    const opponentMove = scope?.opponentMove;
    if (opponentMove?.uci) {
      moves.push({
        uci: opponentMove.uci,
        san: opponentMove.san || opponentMove.uci,
        from: opponentMove.from || opponentMove.uci.slice(0, 2),
        to: opponentMove.to || opponentMove.uci.slice(2, 4),
        promotion: opponentMove.promotion || null,
        nextFen: normalizeFen(opponentMove.nextFen || scope.fen),
        byUser: false
      });
    }
    for (const move of Array.isArray(scope?.appliedPrepLine) ? scope.appliedPrepLine : []) {
      if (!move?.uci) continue;
      moves.push({
        uci: move.uci,
        san: move.san || move.uci,
        from: move.from || move.uci.slice(0, 2),
        to: move.to || move.uci.slice(2, 4),
        promotion: move.promotion || null,
        nextFen: normalizeFen(move.nextFen || scope.fen),
        byUser: true
      });
    }
    return moves;
  }

  function selectPrepOpponentReply(index) {
    const report = state.prep.explorerReport || state.prep.report;
    const moves = getPrepExplorerRows(report, state.currentFen);
    const move = moves[Number(index)];
    if (!move?.uci) return;
    let played = null;
    try {
      played = playLegalUciMove(state.currentFen, move.uci);
    } catch {
      return;
    }

    state.selected = null;
    state.candidates = [];
    state.opponentChoices = [];
    state.prep.report = null;
    playPreparedMove(
      {
        ...played.move,
        san: move.san || played.move.san,
        count: move.count,
        scoreRate: move.scoreRate,
        nextFen: played.nextFen
      },
      sameSideToMove(state.currentFen, state.prep.ourSide)
    );

    let reply = null;
    if (sameSideToMove(state.currentFen, state.prep.ourSide)) {
      const preparedReplies = rankCurrentPreparedMoves(state.currentFen);
      reply = preparedReplies[0] || null;
      if (reply) playPreparedMove(reply, true);
    }

    updatePrepBranchPrompt();
    state.prep.status = reply
      ? `已选择对手 ${move.san || move.uci}，自动匹配你的准备 ${reply.san || reply.uci}，左侧开局树已更新。`
      : `已选择对手 ${move.san || move.uci}；你的开局库没有自动回应，左侧开局树已更新。`;
    state.prep.error = false;
    render();
    runPrepReport();
  }

  function attemptOpeningMove(from, to, promotion = null) {
    if (!state.trainer) return;

    if (state.openingLinePaused) {
      state.selected = null;
      setStatus('当前停在上一条线的最终局面；点击“继续下一条”再开始新的训练。');
      render();
      return;
    }

    if (state.opponentChoices.length) {
      const branchMove = findPreparedMoveFromSquares(state.currentFen, from, to, state.opponentChoices, promotion);
      if (chooseOpponentBranch(branchMove)) return;
      state.selected = null;
      setStatus('请从棋盘高亮的对手分支里选择一步。', true);
      render();
      return;
    }

    if (!sameSideToMove(state.currentFen, state.side)) return;

    const prepared = findPreparedMoveFromSquares(
      state.currentFen,
      from,
      to,
      getCandidateMoves(state.trainer, state.currentFen),
      promotion
    );

    if (!prepared) {
      state.stats.attempts += 1;
      state.stats.mistakes += 1;
      state.stats.streak = 0;
      state.opponentChoices = [];
      state.candidates = getCandidateMoves(state.trainer, state.currentFen);
      state.wrongFlash = true;
      setStatus('这步不在你的准备里。看右侧候选走法，重试这一局面。', true);
      window.setTimeout(() => {
        state.wrongFlash = false;
        render();
      }, 650);
      state.selected = null;
      render();
      return;
    }

    state.stats.attempts += 1;
    state.stats.correct += 1;
    state.stats.streak += 1;
    state.candidates = [];
    state.opponentChoices = [];
    state.selected = null;
    playPreparedMove(prepared, true);
    const autoplayAdvanced = autoplayOpponent();
    const advanced = autoplayAdvanced || advanceAfterOpeningLineCompleted('上一条线已完成，已停在最终局面。');
    if (!advanced) updatePrompt();
    render();
  }

  function attemptEndgameMove(from, to, promotion = null) {
    const session = ensureEndgameSession();
    if (session.completed) {
      setEndgameMessage('本题已经完成，点击“下一题”继续。');
      render();
      return;
    }

    const attempted = createAttemptMove(state.currentFen, from, to, promotion || 'q');
    if (!attempted) {
      flashWrong('这不是当前局面的合法走法。');
      state.endgame.stats.attempts += 1;
      state.endgame.stats.mistakes += 1;
      state.endgame.stats.streak = 0;
      setEndgameMessage('这不是合法走法。', true);
      render();
      return;
    }

    const uci = moveToUci(attempted);
    const result = advanceEndgameStep(session, uci);
    state.endgame.stats.attempts += 1;
    state.selected = null;

    if (!result.ok) {
      state.endgame.stats.mistakes += 1;
      state.endgame.stats.streak = 0;
      state.endgame.answerVisible = true;
      state.endgame.hintsVisible = true;
      setEndgameMessage(`这步不符合本题关键方案。建议走 ${result.expectedMove}。`, true);
      state.wrongFlash = true;
      window.setTimeout(() => {
        state.wrongFlash = false;
        render();
      }, 650);
      setStatus(state.endgame.message, true);
      render();
      return;
    }

    state.endgame.stats.correct += 1;
    state.endgame.stats.streak += 1;
    state.endgame.session = result.session;
    state.currentFen = result.session.currentFen;
    state.currentState = stateFromKeyFen(state.currentFen);
    state.lastMove = result.reply
      ? { from: result.reply.move.from, to: result.reply.move.to }
      : { from: result.played.move.from, to: result.played.move.to };
    state.moveHistory.push({ ...result.played.move, byUser: true });
    if (result.reply) state.moveHistory.push({ ...result.reply.move, byUser: false });
    state.endgame.hintsVisible = false;
    state.endgame.answerVisible = false;

    if (result.session.completed) {
      state.endgame.stats.completed.add(result.session.lesson.id);
      setEndgameMessage('本题完成。可以复盘本题，或进入下一题。');
      setStatus(`完成残局题：${result.session.lesson.title}`);
    } else {
      setEndgameMessage(result.note || '走对了，继续下一步。');
      setStatus('走对了，继续按主题方案推进。');
    }
    render();
  }

  function attemptEngineMove(from, to, promotion = null) {
    if (state.engine.thinking) return;

    const attempted = createAttemptMove(state.currentFen, from, to, promotion || 'q');
    if (!attempted) {
      flashWrong('这不是当前局面的合法走法。');
      return;
    }

    const san = moveToSan(state.currentState, attempted);
    state.selected = null;
    playFreeMove({ uci: moveToUci(attempted), san }, true);
    state.engine.status = '你已落子，引擎正在思考...';
    if (state.mode === 'endgame') {
      setEndgameMessage('你已落子，引擎正在思考...');
    }
    render();
    requestEngineReply();
  }

  function flashWrong(message) {
    state.wrongFlash = true;
    if (state.mode === 'endgame') {
      setEndgameMessage(message, true);
    } else {
      setStatus(message, true);
    }
    window.setTimeout(() => {
      state.wrongFlash = false;
      render();
    }, 650);
    state.selected = null;
    render();
  }

  function startEngineTraining() {
    if (!canStartEngineTraining(state)) {
      setStatus('请先导入研讨并训练到一个局面，再打开拟人训练。', true);
      return;
    }

    const profile = localizeEngineProfile(getEngineProfile(state.engine.profileId), currentLocale());
    state.engine.active = true;
    state.engine.thinking = false;
    state.engine.status = currentLocale() === 'zh'
      ? `${profile?.label || '引擎'} 已接管当前局面。轮到你走时可任意走合法棋步。`
      : `${profile?.label || 'Engine'} has taken over this position. When it is your turn, any legal move is allowed.`;
    state.engine.sparringSnapshot = state.mode === 'endgame' ? createEndgameSparringSnapshot() : null;
    state.candidates = [];
    state.opponentChoices = [];
    state.selected = null;
    if (state.mode === 'endgame') {
      state.endgame.hintsVisible = false;
      state.endgame.answerVisible = false;
      setEndgameMessage('引擎对练已开启。现在从当前残局局面继续自由对弈。');
      setStatus('残局引擎对练已开启。');
    } else {
      setStatus('拟人训练已开启。现在从当前局面继续对弈。');
    }
    render();

    if (!sameSideToMove(state.currentFen, state.side)) {
      requestEngineReply();
    }
  }

  function stopEngineTraining() {
    state.engine.active = false;
    state.engine.thinking = false;
    state.engine.status = state.mode === 'endgame'
      ? '从当前残局局面开始，选择档位后点击开始。'
      : '从当前局面开始，选择档位后点击开始。';
    state.selected = null;
    if (state.mode === 'endgame') {
      restoreEndgameSparringSnapshot();
      setEndgameMessage('引擎对练已退出，已回到进入对练前的残局位置。');
      setStatus('已退出残局引擎对练。');
    } else {
      updatePrompt();
    }
    state.engine.sparringSnapshot = null;
    render();
  }

  function createEndgameSparringSnapshot() {
    return {
      mode: 'endgame',
      side: state.side,
      currentFen: state.currentFen,
      lastMove: state.lastMove ? { ...state.lastMove } : null,
      moveHistory: state.moveHistory.map((move) => ({ ...move })),
      session: state.endgame.session ? { ...state.endgame.session } : null,
      message: state.endgame.message,
      hintsVisible: state.endgame.hintsVisible,
      answerVisible: state.endgame.answerVisible
    };
  }

  function restoreEndgameSparringSnapshot() {
    const snapshot = state.engine.sparringSnapshot;
    if (!snapshot || snapshot.mode !== 'endgame') return;
    state.side = snapshot.side;
    state.currentFen = snapshot.currentFen;
    state.currentState = stateFromKeyFen(state.currentFen);
    state.lastMove = snapshot.lastMove;
    state.moveHistory = snapshot.moveHistory.map((move) => ({ ...move }));
    state.endgame.session = snapshot.session;
    state.endgame.hintsVisible = snapshot.hintsVisible;
    state.endgame.answerVisible = snapshot.answerVisible;
  }

  async function requestEngineReply() {
    if (!state.engine.active || state.engine.thinking) return;
    const profile = getEngineProfile(state.engine.profileId) || getEngineProfile('human-2400');
    const displayProfile = localizeEngineProfile(profile, currentLocale());
    const engineFen = displayFen(state.currentFen);
    state.engine.thinking = true;
    state.engine.status = currentLocale() === 'zh' ? `${displayProfile.label} 正在思考...` : `${displayProfile.label} is thinking...`;
    render();

    try {
      const response = await fetch('/engine-move', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: engineFen,
          profileId: profile.id,
          multipv: profile.multipv,
          skillLevel: profile.skillLevel,
          depth: profile.depth,
          searchMoveTimeMs: profile.searchMoveTimeMs,
          ply: state.moveHistory.length,
          randomSeed: `${profile.id}|${engineFen}|${state.moveHistory.length}|${Date.now()}|${Math.random()}`
        })
      });
      const responseText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        throw new Error(parseEngineErrorPayload(responseText, response.status, contentType));
      }
      const payload = contentType.includes('application/json') ? JSON.parse(responseText) : {};

      const candidates = parseUciInfoLines(payload.lines || payload.output || '');
      const picked = selectEngineReplyMove({ payload, candidates, profile });
      if (!picked) {
        state.engine.status = '当前局面没有可用引擎走法。';
        if (state.mode === 'endgame') {
          setEndgameMessage('当前局面没有可用引擎走法。', true);
        }
        return;
      }

      const result = playLegalUciMove(state.currentFen, picked);
      playFreeMove({ uci: picked, san: result.move.san }, false);
      state.engine.lastLine = candidates[0]?.pv?.slice(0, 4).join(' ') || picked;
      state.engine.status = currentLocale() === 'zh' ? `${displayProfile.label} 走了 ${picked}。轮到你。` : `${displayProfile.label} played ${picked}. Your move.`;
      if (state.mode === 'endgame') {
        setEndgameMessage(currentLocale() === 'zh' ? `${displayProfile.label} 走了 ${picked}。轮到你自由应对。` : `${displayProfile.label} played ${picked}. Respond freely.`);
        setStatus('残局引擎对练进行中。轮到你走。');
      } else {
        setStatus('拟人训练进行中。轮到你走。');
      }
    } catch (error) {
      state.engine.status = `引擎不可用：${error.message}`;
      if (state.mode === 'endgame') {
        setEndgameMessage(`引擎不可用：${error.message}`, true);
      }
      setStatus(`引擎不可用：${error.message}`, true);
    } finally {
      state.engine.thinking = false;
      render();
    }
  }

  function revealAnswers() {
    if (state.engine.active) {
      state.candidates = [];
      state.engine.status = '拟人训练中不显示准备答案；这里按实战继续下。';
      setStatus('拟人训练中不显示准备答案；这里按实战继续下。');
      render();
      return;
    }
    if (!state.trainer) return;
    state.candidates = getCandidateMoves(state.trainer, state.currentFen);
    setStatus(state.candidates.length ? '当前局面的准备走法已显示。' : '这条线已经结束，没有后续准备走法。');
    render();
  }

  function updatePrompt() {
    if (state.engine.active) {
      setStatus('拟人训练进行中。轮到你时可任意走合法棋步。');
      return;
    }
    if (!state.trainer) return;
    if (state.opponentChoices.length) {
      setStatus('选择对手分支：可直接在棋盘点击或拖动高亮走法。');
      return;
    }
    const rawMoves = getCandidateMoves(state.trainer, state.currentFen);
    if (!rawMoves.length) {
      setStatus('这一条线已经走完，已记录完成。');
    } else if (sameSideToMove(state.currentFen, state.side)) {
      setStatus('轮到你走。只接受研讨里准备过的走法。');
    }
  }

  function setStatus(message, isError = false) {
    state.status = message;
    state.statusError = isError;
    if (state.mode !== 'endgame') {
      state.feedback = message;
      state.feedbackError = isError;
    }
    renderFeedback();
  }

  function setEndgameMessage(message, isError = false) {
    state.endgame.message = message;
    state.endgame.feedbackError = isError;
    renderFeedback();
  }

  function renderFeedback() {
    if (!els.feedback) return;
    const message = getVisibleFeedbackMessage({
      mode: state.mode,
      feedback: state.feedback,
      status: state.status,
      endgameMessage: state.endgame.message,
      prepMessage: state.prep.status
    });
    const isError = state.mode === 'endgame' ? state.endgame.feedbackError : state.feedbackError;
    els.feedback.textContent = localizeMessage(message);
    els.feedback.dataset.tone = isError ? 'error' : 'normal';
  }

  function render() {
    renderBoard();
    renderPanels();
    renderPromotionPicker();
  }

  function currentBoardOrientation() {
    return state.mode === 'opening' ? state.openingSide : normalizeBoardOrientation(state.side);
  }

  function renderBoard() {
    if (!els.board) return;
    els.board.innerHTML = '';
    els.board.classList.toggle('is-wrong', state.wrongFlash);
    const orientation = currentBoardOrientation();
    const ranks = boardDisplayRanks(orientation);
    const files = boardDisplayFiles(orientation);
    const legalTargets = state.selected ? getLegalDestinationSquares(state.currentFen, state.selected) : [];
    renderBoardLabels(ranks, files);

    for (const rank of ranks) {
      for (const file of files) {
        const square = `${file}${rank}`;
        const index = squareToIndex(square);
        const piece = state.currentState.board[index];
        const button = document.createElement('button');
        button.className = `square ${boardSquareColor(square)}`;
        button.type = 'button';
        button.dataset.square = square;
        button.setAttribute('aria-label', square);
        if (piece) button.classList.add('occupied');
        if (state.selected === square) button.classList.add('selected');
        if (legalTargets.includes(square)) button.classList.add('legal-target');
        if (state.drag.dragging && state.drag.from === square) button.classList.add('drag-source');
        if (state.lastMove && (state.lastMove.from === square || state.lastMove.to === square)) button.classList.add('last');
        const hintedMoves = state.candidates.length ? state.candidates : state.opponentChoices;
        if (hintedMoves.some((move) => move.from === square || move.to === square)) button.classList.add('hint');
        button.innerHTML = `<span class="piece ${pieceAssetClass(piece)}" aria-label="${piece ? PIECES[piece] : ''}"></span>`;
        if (piece) {
          button.addEventListener('pointerdown', (event) => beginBoardDrag(event, square, piece));
        }
        button.addEventListener('click', () => attemptSquare(square));
        els.board.appendChild(button);
      }
    }

    renderDragGhost();
  }

  function renderDragGhost() {
    if (!state.drag.dragging || !state.drag.piece) {
      removeDragGhost();
      return;
    }
    ensureDragGhost();
  }

  function renderPromotionPicker() {
    if (!els.promotionPicker) return;
    const pending = state.pendingPromotion;
    if (!pending?.choices?.length) {
      els.promotionPicker.classList.add('hidden');
      els.promotionPicker.innerHTML = '';
      return;
    }

    const color = state.currentFen.split(/\s+/)[1] || 'w';
    els.promotionPicker.classList.remove('hidden');
    els.promotionPicker.innerHTML = `
      <span>${tr('promotion.choose')}</span>
      <div>
        ${pending.choices.map((choice) => {
          const piece = color === 'w' ? choice.promotion.toUpperCase() : choice.promotion;
          return `
            <button class="promotion-choice" type="button" data-promotion="${choice.promotion}">
              <span class="piece ${pieceAssetClass(piece)}" aria-hidden="true"></span>
              <strong>${escapeHtml(choice.label)}</strong>
            </button>
          `;
        }).join('')}
      </div>
    `;
    els.promotionPicker.querySelectorAll('[data-promotion]').forEach((button) => {
      button.addEventListener('click', () => choosePromotion(button.dataset.promotion));
    });
  }

  function choosePromotion(promotion) {
    const pending = state.pendingPromotion;
    if (!pending) return;
    const selected = pending.choices.find((choice) => choice.promotion === promotion);
    if (!selected) return;
    state.pendingPromotion = null;
    attemptMoveFromSquares(pending.from, pending.to, selected.promotion, { skipPromotionPrompt: true });
  }

  function renderBoardLabels(ranks, files) {
    if (els.rankLabels) {
      els.rankLabels.innerHTML = ranks.map((rank) => `<span>${rank}</span>`).join('');
    }
    if (els.fileLabels) {
      els.fileLabels.innerHTML = files.map((file) => `<span>${file}</span>`).join('');
    }
  }

  function renderPanels() {
    applyStaticTranslations(document, currentLocale());
    renderFeedback();
    els.status.textContent = localizeMessage(state.status);
    renderModeShell();
    els.importStatus.textContent = importStatusText();
    renderSavedStudies();

    els.sideButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.side === state.openingSide);
    });

    const accuracy = state.stats.attempts ? Math.round((state.stats.correct / state.stats.attempts) * 100) : 100;
    els.stats.innerHTML = `
      <div><strong>${accuracy}%</strong><span>${tr('stats.accuracy')}</span></div>
      <div><strong>${state.stats.streak}</strong><span>${tr('stats.streak')}</span></div>
      <div><strong>${state.stats.mistakes}</strong><span>${tr('stats.mistakes')}</span></div>
      <div><strong>${state.stats.covered.size}/${countNodesWithMoves(state.trainer)}</strong><span>${tr('stats.coverage')}</span></div>
    `;

    const opponentChoices = state.opponentChoices.length ? state.opponentChoices : [];
    if (state.mode === 'prep' && state.trainer) {
      state.candidates = getCandidateMoves(state.trainer, state.currentFen);
    }
    const candidates = state.candidates.length ? state.candidates : [];
    els.answers.innerHTML = opponentChoices.length
      ? `<p class="branch-label">${tr('opening.chooseBranch')}</p>${opponentChoices.map((move) => `<button class="answer opponent-choice" type="button" data-opponent-uci="${move.uci}">${move.san}<span>${move.uci}</span></button>`).join('')}`
      : candidates.length
        ? candidates.map((move) => `<button class="answer" type="button" data-uci="${move.uci}">${move.san}<span>${move.uci}</span></button>`).join('')
        : `<p class="empty">${tr('opening.answersEmpty')}</p>`;

    els.answers.querySelectorAll('[data-opponent-uci]').forEach((button) => {
      button.addEventListener('click', () => {
        const move = state.opponentChoices.find((candidate) => candidate.uci === button.dataset.opponentUci);
        chooseOpponentBranch(move);
      });
    });

    els.answers.querySelectorAll('[data-uci]').forEach((button) => {
      button.addEventListener('click', () => {
        const move = getCandidateMoves(state.trainer, state.currentFen)
          .find((candidate) => candidate.uci === button.dataset.uci);
        if (!move) return;
        if (state.mode === 'prep') {
          attemptPrepMove(move.from, move.to, move.promotion);
          return;
        }
        playPreparedMove(move, true);
        state.candidates = [];
        const autoplayAdvanced = autoplayOpponent();
        const advanced = autoplayAdvanced || advanceAfterOpeningLineCompleted('上一条线已完成，已停在最终局面。');
        if (!advanced) updatePrompt();
        render();
      });
    });

    if (els.currentLine) {
      const currentPgn = formatMoveHistoryPgn(state.moveHistory);
      els.currentLine.textContent = currentPgn || (state.lastCompletedPgn ? tr('opening.previousCompleted', { pgn: state.lastCompletedPgn }) : tr('opening.currentLineEmpty'));
    }
    if (els.copyPgn) {
      els.copyPgn.disabled = !state.moveHistory.length && !state.lastCompletedPgn;
    }
    if (els.next) {
      els.next.textContent = state.openingLinePaused ? tr('opening.continueNextLine') : tr('opening.nextRandomLine');
    }

    els.history.innerHTML = state.moveHistory.length
      ? state.moveHistory.map((move, index) => `<span class="${move.byUser ? 'mine' : 'opponent'}">${index + 1}. ${move.san}</span>`).join('')
      : `<span class="muted">${tr('opening.historyEmpty')}</span>`;

    renderEngineTraining();
    renderEndgameTraining();
    renderPrepMode();
  }

  function importStatusText() {
    if (state.mode === 'endgame') {
      return currentLocale() === 'zh'
        ? `残局训练 · ${listEndgameLessons().length} 题`
        : `Endgame Training · ${listEndgameLessons().length} tasks`;
    }
    if (state.mode === 'prep') {
      const total = state.prep.report?.sampleGames || 0;
      return total ? `备战模式 · ${total} 盘上传棋谱` : '备战模式 · 上传 PGN';
    }
    return state.trainer
      ? currentLocale() === 'zh'
        ? `${state.importedLabel} · ${state.trainer.chapters.length || 1} 章 · ${state.trainer.moveCount} 步`
        : `${state.importedLabel} · ${state.trainer.chapters.length || 1} chapters · ${state.trainer.moveCount} moves`
      : tr('status.notImported');
  }

  function renderModeShell() {
    const isEndgame = state.mode === 'endgame';
    const isPrep = state.mode === 'prep';
    els.modeButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.modeSwitch === state.mode);
    });
    els.openingLeft.classList.toggle('hidden', isEndgame || isPrep);
    els.openingRight.classList.toggle('hidden', isEndgame || isPrep);
    els.endgameLeft.classList.toggle('hidden', !isEndgame);
    els.endgameRight.classList.toggle('hidden', !isEndgame);
    els.prepLeft?.classList.toggle('hidden', !isPrep);
    els.prepRight?.classList.toggle('hidden', !isPrep);
  }

  function renderPrepMode() {
    if (!els.prepStatus) return;
    els.prepStatus.textContent = localizeMessage(state.prep.status);
    els.prepStatus.dataset.tone = state.prep.error ? 'error' : 'normal';
    if (els.opponentPgnBadge) {
      els.opponentPgnBadge.textContent = state.prep.opponentPgn?.trim()
        ? state.prep.opponentPgnName || '已上传'
        : '未上传';
    }
    els.prepReportBadge.textContent = state.prep.report
      ? `${state.prep.report.sampleGames || 0}`
      : tr('prep.waiting');
    els.prepSideButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.prepSide === state.prep.ourSide);
    });
    if (els.runPrepReport) els.runPrepReport.disabled = state.prep.loading;

    const report = state.prep.report;
    const explorerReport = state.prep.explorerReport || report;
    const counts = {
      sampleGames: report?.sampleGames || 0,
      unseen: report?.unseen?.length || 0,
      weak: report?.weakPerformance?.length || 0,
      gaps: report?.gaps?.length || 0
    };
    els.prepStats.innerHTML = `
      <div><strong>${counts.sampleGames}</strong><span>${tr('prep.sampleGames')}</span></div>
      <div><strong>${counts.unseen}</strong><span>${tr('prep.unseen')}</span></div>
      <div><strong>${counts.weak}</strong><span>${tr('prep.weak')}</span></div>
      <div><strong>${counts.gaps}</strong><span>${tr('prep.gaps')}</span></div>
    `;
    if (els.prepCommonReplies) {
      els.prepCommonReplies.innerHTML = renderPrepCommonReplies(explorerReport, state.currentFen);
      els.prepCommonReplies.querySelectorAll('[data-prep-reply-index]').forEach((button) => {
        button.addEventListener('click', () => selectPrepOpponentReply(button.dataset.prepReplyIndex));
      });
    }
    els.dataPrepReport.innerHTML = report ? renderPrepReportSections(report) : `<p class="empty">上传对手 PGN 后，报告会列出未见准备、低样本分支、表现差分支和准备缺口。</p>`;
  }

  function formatPrepOpeningTreeStatus(openingTree) {
    if (!openingTree) return '';
    const nodes = Number(openingTree.nodes) || 0;
    if (currentLocale() === 'zh') {
      return openingTree.fromCache
        ? `复用已制作开局树（${nodes} 个局面）`
        : `已制作开局树（${nodes} 个局面）`;
    }
    return openingTree.fromCache
      ? `reused opening tree (${nodes} positions)`
      : `built opening tree (${nodes} positions)`;
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function renderPrepReportSections(report) {
    return [
      renderPrepReportGroup(tr('prep.unseenTitle'), report.unseen, 'unseen'),
      renderPrepReportGroup(tr('prep.lowSampleTitle'), report.lowSample, 'low'),
      renderPrepReportGroup(tr('prep.weakTitle'), report.weakPerformance, 'weak'),
      renderPrepReportGroup(tr('prep.gapTitle'), report.gaps, 'gap')
    ].join('');
  }

  function renderPrepCommonReplies(report, fen = state.currentFen) {
    const title = tr('prep.commonReplies');
    const moves = getPrepExplorerRows(report, fen);
    const currentLine = formatMoveHistoryPgn(state.moveHistory);
    const scope = currentLine || (currentLocale() === 'zh' ? '起始局面' : 'Starting position');
    if (!moves.length) {
      return `
        <h3>${escapeHtml(title)}</h3>
        <p class="empty">${escapeHtml(report ? tr('prep.commonRepliesNone') : tr('prep.commonRepliesEmpty'))}</p>
      `;
    }
    const rows = moves.map((move, index) => {
      const count = Number(move.count) || 0;
      const share = Number.isFinite(move.share) ? `${Math.round(move.share * 100)}%` : '0%';
      const score = Number.isFinite(move.scoreRate)
        ? currentLocale() === 'zh' ? `得分 ${Math.round(move.scoreRate * 100)}%` : `score ${Math.round(move.scoreRate * 100)}%`
        : currentLocale() === 'zh' ? '无得分' : 'no score';
      const autoReply = move.autoReply?.san || move.autoReply?.uci || '';
      const autoText = autoReply
        ? currentLocale() === 'zh' ? `我方准备 ${autoReply}` : `prep reply ${autoReply}`
        : currentLocale() === 'zh' ? '我的库里暂无自动回应' : 'no prepared reply';
      const width = Math.max(2, Math.round((Number(move.share) || 0) * 100));
      return `
        <li>
          <button type="button" data-prep-reply-index="${index}">
            <span>${index + 1}</span>
            <strong>${escapeHtml(move.san || move.uci || '')}</strong>
            <code>${escapeHtml(move.uci || '')}</code>
            <em>${escapeHtml(currentLocale() === 'zh' ? `${count} 盘 · ${share} · ${score} · ${autoText}` : `${count} games · ${share} · ${score} · ${autoText}`)}</em>
            <i style="--prep-share:${width}%"></i>
          </button>
        </li>
      `;
    }).join('');
    return `
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(scope)}</p>
      <ol>${rows}</ol>
    `;
  }

  function renderPrepReportGroup(title, items = [], tone = 'normal') {
    const rows = items.slice(0, 8).map((item) => `
      <div class="prep-report-item" data-tone="${escapeHtml(tone)}">
        <div class="prep-report-position">
          <span>${escapeHtml(currentLocale() === 'zh' ? '局面' : 'Position')}</span>
          <strong>${escapeHtml(item.positionLine || (currentLocale() === 'zh' ? '起始局面' : 'Starting position'))}</strong>
        </div>
        <div class="prep-report-main">
          <span>${escapeHtml(prepReportActionLabel(item.reason))}</span>
          <strong>${escapeHtml(item.displayMove || item.san || item.uci || '')}</strong>
          ${item.uci ? `<code>${escapeHtml(item.uci)}</code>` : ''}
        </div>
        <p>${escapeHtml(item.explanation || prepReportFallbackExplanation(item))}</p>
        <em>${escapeHtml(prepReportMeta(item))}</em>
      </div>
    `).join('');
    return `
      <section class="prep-report-group">
        <h3>${escapeHtml(title)} <span>${items.length}</span></h3>
        ${rows || `<p class="empty">${currentLocale() === 'zh' ? '暂无' : 'None'}</p>`}
      </section>
    `;
  }

  function prepReportActionLabel(reason) {
    const zh = currentLocale() === 'zh';
    if (reason === 'prep-gap') return zh ? '对手会走，你还没准备' : 'Opponent move missing from prep';
    if (reason === 'opponent-unseen') return zh ? '对手没下过' : 'Not played by opponent';
    if (reason === 'low-sample') return zh ? '低样本可打' : 'Low-sample target';
    if (reason === 'weak-performance') return zh ? '对手得分差' : 'Weak-performance target';
    return zh ? '此处走法' : 'Move here';
  }

  function prepReportMeta(item) {
    const zh = currentLocale() === 'zh';
    const count = Number(item?.count) || 0;
    const sample = zh ? `${count} 盘样本` : `${count} games`;
    const score = Number.isFinite(item?.scoreRate)
      ? zh ? `对手得分 ${(item.scoreRate * 100).toFixed(0)}%` : `opponent score ${(item.scoreRate * 100).toFixed(0)}%`
      : zh ? '无得分样本' : 'no score sample';
    return `${sample} · ${score}`;
  }

  function prepReportFallbackExplanation(item) {
    const zh = currentLocale() === 'zh';
    const position = item?.positionLine || (zh ? '起始局面' : 'Starting position');
    const move = item?.displayMove || item?.san || item?.uci || '';
    return zh
      ? `在 ${position}，关注 ${move}。`
      : `At ${position}, focus on ${move}.`;
  }

  function renderEngineTraining() {
    if (!els.engineProfiles?.length) return;
    const profiles = listEngineProfiles().map((profile) => localizeEngineProfile(profile, currentLocale()));
    els.engineBadge.forEach((badge) => {
      badge.textContent = state.engine.thinking ? tr('engine.thinking') : state.engine.active ? tr('engine.running') : tr('engine.idle');
    });
    els.engineStatus.forEach((status) => {
      status.textContent = localizeMessage(state.engine.status);
    });
    els.engineProfiles.forEach((container) => {
      container.innerHTML = profiles.map((profile) => `
        <button class="engine-profile ${profile.id === state.engine.profileId ? 'active' : ''}" type="button" data-engine-profile="${escapeHtml(profile.id)}" title="${escapeHtml(profile.description)}">
          <strong>${escapeHtml(profile.label)}</strong>
          <span>${profile.estimatedElo >= 3000 ? '3500+' : `${profile.estimatedElo} Elo`}</span>
        </button>
      `).join('');

      container.querySelectorAll('[data-engine-profile]').forEach((button) => {
        button.addEventListener('click', () => {
          state.engine.profileId = button.dataset.engineProfile;
          const profile = localizeEngineProfile(getEngineProfile(state.engine.profileId), currentLocale());
          state.engine.status = state.engine.active
            ? currentLocale() === 'zh'
              ? `已切换到 ${profile.label}，下一步由该档位思考。`
              : `Switched to ${profile.label}. The next engine move will use this level.`
            : `${profile.label}：${profile.description}`;
          render();
        });
      });
    });

    els.engineStart.forEach((button) => {
      button.disabled = state.engine.thinking;
    });
    els.engineStop.forEach((button) => {
      button.disabled = !state.engine.active || state.engine.thinking;
    });
  }

  function renderSavedStudies() {
    if (!els.savedList) return;
    els.savedCount.textContent = String(state.savedStudies.length);
    if (els.studyName) {
      const active = state.savedStudies.find((study) => study.id === state.activeStudyId);
      els.studyName.value = active?.name || '';
    }

    if (!state.savedStudies.length) {
      els.savedList.innerHTML = `<p class="empty">${tr('opening.savedEmpty')}</p>`;
      return;
    }

    els.savedList.innerHTML = state.savedStudies.map((study) => `
      <button class="saved-study ${study.id === state.activeStudyId ? 'active' : ''}" type="button" data-study-id="${escapeHtml(study.id)}">
        <strong>${escapeHtml(study.name)}</strong>
        <span>${escapeHtml(new Date(study.updatedAt).toLocaleString())}</span>
      </button>
    `).join('');

    els.savedList.querySelectorAll('[data-study-id]').forEach((button) => {
      button.addEventListener('click', () => loadSavedStudy(button.dataset.studyId));
    });
  }

  function renderEndgameTraining() {
    if (!els.endgameCategories) return;
    ensureEndgameSession();
    const categories = getEndgameCategories().map((category) => localizeEndgameCategory(category, currentLocale()));
    const lessons = listEndgameLessons(state.endgame.categoryId).map((lesson) => localizeEndgameLesson(lesson, currentLocale()));
    const activeLesson = localizeEndgameLesson(state.endgame.session.lesson, currentLocale());
    const session = state.endgame.session;

    els.endgameCount.textContent = String(listEndgameLessons().length);
    els.endgameCategories.innerHTML = categories.map((category) => `
      <button class="endgame-category ${category.id === state.endgame.categoryId ? 'active' : ''}" type="button" data-endgame-category="${escapeHtml(category.id)}">
        <strong>${escapeHtml(category.title)}</strong>
        <span>${escapeHtml(category.subtitle)}</span>
      </button>
    `).join('');
    els.endgameCategories.querySelectorAll('[data-endgame-category]').forEach((button) => {
      button.addEventListener('click', () => selectEndgameCategory(button.dataset.endgameCategory));
    });

    els.endgameLessons.innerHTML = lessons.map((lesson, index) => `
      <button class="endgame-lesson ${lesson.id === activeLesson.id ? 'active' : ''}" type="button" data-endgame-lesson="${escapeHtml(lesson.id)}">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(lesson.title)}</strong>
        <em>${escapeHtml(lesson.trainingTargetLabel || endgameTargetLabel(lesson))} · ${escapeHtml(lesson.goal)}</em>
      </button>
    `).join('');
    els.endgameLessons.querySelectorAll('[data-endgame-lesson]').forEach((button) => {
      button.addEventListener('click', () => selectEndgameLesson(button.dataset.endgameLesson));
    });

    const sourceLine = activeLesson.source
      ? `<p class="lesson-source">${escapeHtml(formatEndgameSourceLine(activeLesson.source, currentLocale()))}</p>`
      : '';

    els.endgameTeaching.innerHTML = `
      <h3>${escapeHtml(activeLesson.title)}</h3>
      <p class="lesson-goal">${escapeHtml(activeLesson.goal)} · ${escapeHtml(activeLesson.level)}</p>
      ${sourceLine}
      <dl>
        <dt>${tr('endgame.dl.principle')}</dt>
        <dd>${escapeHtml(activeLesson.teaching.principle)}</dd>
        <dt>${tr('endgame.dl.method')}</dt>
        <dd>${escapeHtml(activeLesson.teaching.method)}</dd>
        <dt>${tr('endgame.dl.mistake')}</dt>
        <dd>${escapeHtml(activeLesson.teaching.mistake)}</dd>
      </dl>
    `;

    const totalSteps = activeLesson.steps.length;
    const accuracy = state.endgame.stats.attempts
      ? Math.round((state.endgame.stats.correct / state.endgame.stats.attempts) * 100)
      : 100;
    els.endgameBadge.textContent = session.completed ? tr('endgame.completed') : `${session.stepIndex + 1}/${totalSteps}`;
    if (els.endgameTarget) {
      els.endgameTarget.textContent = activeLesson.trainingTargetLabel || endgameTargetLabel(activeLesson);
      els.endgameTarget.dataset.target = activeLesson.trainingTarget || 'unknown';
    }
    els.endgameStatus.textContent = localizeMessage(state.endgame.message);
    els.endgameStats.innerHTML = `
      <div><strong>${accuracy}%</strong><span>${tr('stats.accuracy')}</span></div>
      <div><strong>${state.endgame.stats.streak}</strong><span>${tr('stats.streak')}</span></div>
      <div><strong>${state.endgame.stats.mistakes}</strong><span>${tr('stats.mistakes')}</span></div>
      <div><strong>${session.stepIndex}/${totalSteps}</strong><span>${tr('stats.progress')}</span></div>
    `;

    const answerParts = [];
    if (state.endgame.hintsVisible) {
      answerParts.push(...activeLesson.hints.map((hint) => `<p class="answer">${escapeHtml(hint)}</p>`));
    }
    if (state.endgame.answerVisible && session.expectedMove) {
      const step = activeLesson.steps[session.stepIndex];
      answerParts.push(`<button class="answer" type="button" data-endgame-play-answer="${escapeHtml(step.move)}">${tr('endgame.playAnswer')} <span>${escapeHtml(step.move)}</span></button>`);
      if (step.note) answerParts.push(`<p class="answer-note">${escapeHtml(step.note)}</p>`);
    }
    if (!answerParts.length) {
      answerParts.push(`<p class="empty">${tr('endgame.answersEmpty')}</p>`);
    }
    els.endgameAnswers.innerHTML = answerParts.join('');
    els.endgameAnswers.querySelectorAll('[data-endgame-play-answer]').forEach((button) => {
      button.addEventListener('click', () => {
        const result = advanceEndgameStep(state.endgame.session, button.dataset.endgamePlayAnswer);
        if (!result.ok) return;
        state.endgame.session = result.session;
        state.currentFen = result.session.currentFen;
        state.currentState = stateFromKeyFen(state.currentFen);
        state.moveHistory.push({ ...result.played.move, byUser: true });
        if (result.reply) state.moveHistory.push({ ...result.reply.move, byUser: false });
        state.endgame.answerVisible = false;
        state.endgame.hintsVisible = false;
        setEndgameMessage(result.session.completed ? '本题完成。' : '已按答案推进，继续下一步。');
        render();
      });
    });
  }
}

function samplePgn() {
  return `[Event "Italian preparation"]\n[Site "https://lichess.org/study/sample"]\n[Result "*"]\n\n1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 3. Bc4 Bc5 (3... Nf6 4. d3) 4. c3 Nf6 *\n\n[Event "Queen's Gambit note"]\n[Result "*"]\n\n1. d4 d5 2. c4 e6 (2... c6) 3. Nc3 Nf6 *`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
