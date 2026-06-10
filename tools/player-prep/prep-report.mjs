import {
  createTrainerFromPgn,
  getCandidateMoves,
  playLegalUciMove,
  replayPgnGame,
  splitPgnGames
} from '../../app.js';
import { decodeStoredGameMoves } from './offline-store.mjs';
import chinesePlayerPinyin from '../../data/player-prep/chinese-player-pinyin.json' with { type: 'json' };

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
export const PLAYER_NAME_MATCH_VERSION = 3;

const CHINESE_PLAYER_ALIASES = [
  ['ding liren', '丁立人', 'liren ding'],
  ['wei yi', '韦奕', 'yi wei'],
  ['hou yifan', '侯逸凡', '候逸凡', 'yifan hou'],
  ['ju wenjun', '居文君', 'wenjun ju'],
  ['tan zhongyi', '谭中怡', 'zhongyi tan'],
  ['lei tingjie', '雷挺婕', 'tingjie lei'],
  ['wang hao', '王皓', 'hao wang'],
  ['wang yue', '王玥', 'yue wang'],
  ['wang chen', '王晨', 'chen wang'],
  ['wang ziyue', '王子悦', 'ziyue wang'],
  ['bu xiangzhi', '卜祥志', 'xiangzhi bu'],
  ['yu yangyi', '余泱漪', 'yangyi yu'],
  ['ni hua', '倪华', 'hua ni'],
  ['li chao', '李超', 'li chao2', 'chao li'],
  ['li di', '李荻', 'di li'],
  ['lu shanglei', '卢尚磊', 'shanglei lu'],
  ['xu xiangyu', '徐翔宇', 'xiangyu xu'],
  ['xu jun', '徐俊', 'jun xu'],
  ['xu yi', '徐译', 'yi xu'],
  ['xu yuhua', '徐昱华', '徐雨华', 'yuhua xu'],
  ['xu ziyuan', '徐子媛', 'ziyuan xu'],
  ['bai jinshi', '白金石', 'jinshi bai'],
  ['zhao xue', '赵雪', 'xue zhao'],
  ['zhu jiner', '朱锦尔', '朱锦儿', 'jiner zhu'],
  ['zhu chen', '诸宸', 'chen zhu'],
  ['zhu jianchao', '祝建超', 'jianchao zhu'],
  ['xie jun', '谢军', 'jun xie'],
  ['ye jiangchuan', '叶江川', 'jiangchuan ye'],
  ['zhang zhong', '章钟', 'zhong zhang'],
  ['zhang pengxiang', '张鹏翔', 'pengxiang zhang'],
  ['zhou jianchao', '周健超', 'jianchao zhou'],
  ['zhou qiyu', '周齐宇', 'qiyu zhou'],
  ['wen yang', '温阳', 'yang wen'],
  ['liang chong', '梁充', 'chong liang'],
  ['yi xin', '易欣', 'xin yi'],
  ['liu yan', '刘言', 'yan liu'],
  ['liu xiangyi', '刘湘翊', '刘翔宇', 'xiangyi liu'],
  ['dai changren', '戴常人', 'changren dai'],
  ['he junchen', '何君宸', 'junchen he'],
  ['jin ruijun', '金锐君', 'ruijun jin'],
  ['peng hongchi', '彭泓池', 'hongchi peng'],
  ['lu miaoyi', '卢妙仪', 'miaoyi lu'],
  ['miao ziyi', '苗紫怡', 'ziyi miao'],
  ['song yuxin', '宋宇新', '宋雨馨', 'yuxin song'],
  ['guo qi', '郭琦', 'qi guo'],
  ['ni shiqun', '倪诗群', 'shiqun ni'],
  ['zhai mo', '翟墨', 'mo zhai'],
  ['huang qian', '黄茜', 'qian huang'],
  ['shen yang', '沈阳', 'yang shen'],
  ['zhang xiaowen', '张晓雯', 'xiaowen zhang'],
  ['yuan ye', '袁野', 'ye yuan']
];

function baseNormalizePlayerName(name) {
  let text = String(name || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/[，、]/g, ',')
    .replace(/\s+/g, ' ');
  text = text
    .replace(/\s*\([A-Za-z]{2,3}\)\s*$/g, '')
    .replace(/\s+(?:chn|china)\s*$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const comma = text.match(/^([^,]+),\s*(.+)$/);
  text = comma ? `${comma[2]} ${comma[1]}`.replace(/\s+/g, ' ').trim() : text;
  return text.trim();
}

function buildPlayerAliasMap() {
  const aliases = new Map();
  const fixedAliases = [];
  for (const names of CHINESE_PLAYER_ALIASES) {
    const canonical = baseNormalizePlayerName(names[0]);
    for (const name of names) {
      const normalized = baseNormalizePlayerName(name);
      if (normalized) fixedAliases.push([normalized, canonical]);
      const compact = normalized.replace(/[^a-z0-9]+/g, '');
      if (compact) fixedAliases.push([compact, canonical]);
    }
  }
  for (const player of Array.isArray(chinesePlayerPinyin?.players) ? chinesePlayerPinyin.players : []) {
    const rawName = String(player?.name || '').trim();
    const canonical = baseNormalizePlayerName(rawName);
    if (!canonical) continue;
    const variants = new Set([rawName, canonical, canonical.replace(/\s+/g, '')]);
    const comma = rawName.match(/^([^,]+),\s*(.+)$/);
    if (comma) {
      variants.add(`${comma[1]} ${comma[2]}`);
      variants.add(`${comma[1]}${comma[2]}`);
      variants.add(`${comma[2]} ${comma[1]}`);
      variants.add(`${comma[2]}${comma[1]}`);
    }
    for (const variant of variants) {
      const normalized = baseNormalizePlayerName(variant);
      if (normalized && !aliases.has(normalized)) aliases.set(normalized, canonical);
      const compact = normalized.replace(/[^a-z0-9]+/g, '');
      if (compact && !aliases.has(compact)) aliases.set(compact, canonical);
    }
  }
  for (const [alias, canonical] of fixedAliases) {
    aliases.set(alias, canonical);
  }
  return aliases;
}

const PLAYER_NAME_ALIASES = buildPlayerAliasMap();

export function normalizePlayerName(name) {
  const normalized = baseNormalizePlayerName(name);
  return PLAYER_NAME_ALIASES.get(normalized) || normalized;
}

function stringValue(store, id) {
  return store?.stringTable?.[id] || '';
}

function gamePlayerScore(game, side) {
  const result = String(game.resultText || game.result || '');
  const normalized = result.includes('-') ? result : '';
  if (normalized === '1-0') return side === 'w' ? 1 : 0;
  if (normalized === '0-1') return side === 'b' ? 1 : 0;
  if (normalized === '1/2-1/2') return 0.5;
  return 0.5;
}

function hydrateGame(store, game) {
  return {
    ...game,
    eventText: stringValue(store, game.event),
    siteText: stringValue(store, game.site),
    dateText: stringValue(store, game.date),
    roundText: stringValue(store, game.round),
    whiteText: stringValue(store, game.white),
    blackText: stringValue(store, game.black),
    resultText: stringValue(store, game.result),
    ecoText: stringValue(store, game.eco)
  };
}

function opponentMatches(store, game, opponent, side) {
  const target = normalizePlayerName(opponent);
  const white = normalizePlayerName(stringValue(store, game.white));
  const black = normalizePlayerName(stringValue(store, game.black));
  return side === 'w' ? white === target : black === target;
}

function addTreeMove(node, uci, nextFen, score) {
  let move = node.moveMap.get(uci);
  if (!move) {
    move = {
      uci,
      count: 0,
      score: 0,
      nextFen,
      scoreRate: 0
    };
    node.moveMap.set(uci, move);
    node.moves.push(move);
  }
  move.count += 1;
  move.score += score;
  move.scoreRate = move.count ? move.score / move.count : 0;
  return move;
}

function ensureNode(nodes, fen) {
  if (!nodes.has(fen)) {
    nodes.set(fen, {
      fen,
      total: 0,
      moves: [],
      moveMap: new Map()
    });
  }
  return nodes.get(fen);
}

function publicNode(node) {
  if (!node) return { fen: START_FEN, total: 0, moves: [] };
  return {
    fen: node.fen,
    total: node.total,
    moves: node.moves
      .map((move) => ({
        uci: move.uci,
        count: move.count,
        score: move.score,
        scoreRate: move.scoreRate,
        nextFen: move.nextFen
      }))
      .sort((a, b) => b.count - a.count || a.uci.localeCompare(b.uci))
  };
}

export function buildOpponentOpeningTree(store, {
  opponent,
  opponentSide = 'w',
  maxPly = 40
} = {}) {
  const side = opponentSide === 'b' ? 'b' : 'w';
  const games = [];
  const nodes = new Map();
  ensureNode(nodes, START_FEN);

  for (const storedGame of Array.isArray(store?.games) ? store.games : []) {
    if (!opponentMatches(store, storedGame, opponent, side)) continue;
    const game = hydrateGame(store, storedGame);
    games.push(game);
    const score = gamePlayerScore(game, side);
    const moves = decodeStoredGameMoves(store, storedGame).slice(0, maxPly);
    let fen = START_FEN;
    for (const uci of moves) {
      const node = ensureNode(nodes, fen);
      node.total += 1;
      let played;
      try {
        played = playLegalUciMove(fen, uci);
      } catch {
        break;
      }
      addTreeMove(node, uci, played.nextFen, score);
      fen = played.nextFen;
      ensureNode(nodes, fen);
    }
  }

  return {
    opponent,
    opponentSide: side,
    maxPly,
    sampleGames: games.length,
    games,
    nodes,
    root: publicNode(nodes.get(START_FEN))
  };
}

function getOpponentSideForOurSide(ourSide) {
  return ourSide === 'w' ? 'b' : 'w';
}

function sideToMove(fen) {
  return String(fen || '').split(/\s+/)[1] || 'w';
}

function normalizeReportFen(fen) {
  const parts = String(fen || '').trim().split(/\s+/);
  if (parts.length < 4) return '';
  return `${parts[0]} ${parts[1]} ${parts[2] || '-'} ${parts[3] || '-'}`;
}

function moveNumberFromPly(ply) {
  return Math.floor(Number(ply || 0) / 2) + 1;
}

function formatHistoryLine(history) {
  if (!Array.isArray(history) || !history.length) return '起始局面';
  return history.join(' ');
}

function displayMoveForSide(side, moveNumber, san, uci) {
  const moveText = san || uci || '';
  return side === 'b' ? `...${moveText}` : `${moveNumber}. ${moveText}`;
}

function historyLabelForMove(fen, ply, move) {
  const moveNumber = moveNumberFromPly(ply);
  const side = sideToMove(fen);
  return side === 'w'
    ? `${moveNumber}. ${move.san || move.uci}`
    : move.san || move.uci;
}

function sideThatMovedAtPly(ply) {
  const value = Number(ply) || 0;
  if (value <= 0) return null;
  return value % 2 === 1 ? 'w' : 'b';
}

function plyIncludesSide(ply, side) {
  const value = Math.max(0, Number(ply) || 0);
  for (let index = 1; index <= value; index += 1) {
    if (sideThatMovedAtPly(index) === side) return true;
  }
  return false;
}

function isOpeningEntryScope({ fen, lastMover, sawOpponentMove, ourSide, opponentSide }) {
  return sideToMove(fen) === opponentSide
    && lastMover === ourSide
    && sawOpponentMove;
}

function stripPgnVariations(text) {
  let depth = 0;
  let output = '';
  for (const char of String(text || '')) {
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) output += char;
  }
  return output;
}

function replayMainlineGames(pgn) {
  const lines = [];
  for (const game of splitPgnGames(pgn)) {
    try {
      lines.push(replayPgnGame(stripPgnVariations(game)));
    } catch {
      // Ignore malformed chapters; the trainer parser already records PGN errors separately.
    }
  }
  return lines;
}

function findMainlineStart(line, fen) {
  const normalized = normalizeReportFen(fen);
  if (!normalized) return -1;
  if (normalizeReportFen(line.startFen) === normalized) return 0;
  const index = line.moves.findIndex((move) => normalizeReportFen(move.afterFen) === normalized);
  return index < 0 ? -1 : index + 1;
}

function advanceScopeAlongMainline({ prepPgn, startFen, startPly, startHistory, ourSide, opponentSide, maxPly }) {
  const initial = {
    fen: normalizeReportFen(startFen),
    ply: Math.max(0, Number(startPly) || 0),
    history: Array.isArray(startHistory) ? startHistory.filter(Boolean) : []
  };
  let lastMover = sideThatMovedAtPly(initial.ply);
  let sawOpponentMove = plyIncludesSide(initial.ply, opponentSide);

  if (isOpeningEntryScope({ fen: initial.fen, lastMover, sawOpponentMove, ourSide, opponentSide })) {
    return initial;
  }

  for (const line of replayMainlineGames(prepPgn)) {
    const startIndex = findMainlineStart(line, initial.fen);
    if (startIndex < 0) continue;

    const scope = {
      fen: initial.fen,
      ply: initial.ply,
      history: [...initial.history]
    };
    lastMover = sideThatMovedAtPly(scope.ply);
    sawOpponentMove = plyIncludesSide(scope.ply, opponentSide);

    for (let index = startIndex; index < line.moves.length && scope.ply < maxPly; index += 1) {
      const lineMove = line.moves[index];
      if (normalizeReportFen(lineMove.beforeFen) !== scope.fen) break;
      const mover = sideToMove(scope.fen);
      const move = { san: lineMove.san, uci: lineMove.uci };
      scope.history.push(historyLabelForMove(scope.fen, scope.ply, move));
      scope.fen = normalizeReportFen(lineMove.afterFen);
      scope.ply += 1;
      lastMover = mover;
      if (mover === opponentSide) sawOpponentMove = true;
      if (isOpeningEntryScope({ fen: scope.fen, lastMover, sawOpponentMove, ourSide, opponentSide })) {
        return scope;
      }
    }
  }

  return initial;
}

function formatScorePercent(scoreRate) {
  return Number.isFinite(scoreRate) ? `${Math.round(scoreRate * 100)}%` : null;
}

function explainReportItem({ reason, positionLine, side, displayMove, count, scoreRate }) {
  const sideText = side === 'b' ? '黑方' : '白方';
  const where = positionLine === '起始局面'
    ? '在起始局面'
    : `在 ${positionLine} 之后`;
  if (reason === 'opponent-unseen') {
    return `${where}，这里轮到${sideText}，你的准备走 ${displayMove}；对手公开线下对局里还没下过这步。`;
  }
  if (reason === 'low-sample') {
    return `${where}，这里轮到${sideText}，${displayMove} 在对手样本中只出现 ${count || 0} 次，样本很少，适合作为备战武器。`;
  }
  if (reason === 'weak-performance') {
    const percent = formatScorePercent(scoreRate);
    return `${where}，这里轮到${sideText}，对手下 ${displayMove} 的得分偏低${percent ? `（${percent}）` : ''}，可以重点准备后续方案。`;
  }
  return `${where}，这里轮到${sideText}，对手常走 ${displayMove}，但你的准备没有覆盖，需要补一条应对线。`;
}

function preparedNodes(trainer, maxPly, {
  startFen = '',
  startPly = 0,
  startHistory = []
} = {}) {
  const results = [];
  const rootFen = normalizeReportFen(startFen) || trainer.rootFen;
  const rootPly = Math.max(0, Number(startPly) || 0);
  const rootHistory = Array.isArray(startHistory)
    ? startHistory.filter(Boolean)
    : String(startHistory || '').trim()
      ? [String(startHistory).trim()]
      : [];
  const queue = [{ fen: rootFen, ply: rootPly, history: rootHistory }];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(`${current.fen}|${current.ply}`) || current.ply > maxPly) continue;
    seen.add(`${current.fen}|${current.ply}`);
    const moves = getCandidateMoves(trainer, current.fen);
    results.push({ fen: current.fen, ply: current.ply, history: current.history, moves });
    for (const move of moves) {
      const label = historyLabelForMove(current.fen, current.ply, move);
      queue.push({ fen: move.nextFen, ply: current.ply + 1, history: [...current.history, label] });
    }
  }
  return results;
}

function makeReportItem({ fen, ply, history = [], move, opponentMove = null, reason }) {
  const side = sideToMove(fen);
  const moveNumber = moveNumberFromPly(ply);
  const uci = move?.uci || opponentMove?.uci;
  let san = move?.san || null;
  if (!san && uci) {
    try {
      san = playLegalUciMove(fen, uci).move.san;
    } catch {
      san = null;
    }
  }
  const positionLine = formatHistoryLine(history);
  const displayMove = displayMoveForSide(side, moveNumber, san, uci);
  const count = opponentMove?.count || 0;
  const scoreRate = Number.isFinite(opponentMove?.scoreRate) ? opponentMove.scoreRate : null;
  return {
    fen,
    ply,
    positionLine,
    moveNumber,
    sideToMove: side,
    displayMove,
    uci,
    san,
    count,
    scoreRate,
    explanation: explainReportItem({ reason, positionLine, side, displayMove, count, scoreRate }),
    reason
  };
}

function findOpponentMove(opponentTree, fen, uci) {
  return opponentTree.nodes.get(fen)?.moves.find((move) => move.uci === uci) || null;
}

function moveDetailsFromFen(fen, uci) {
  if (!uci) return null;
  try {
    const played = playLegalUciMove(fen, uci);
    return {
      uci,
      san: played.move.san,
      from: played.move.from,
      to: played.move.to,
      promotion: played.move.promotion || null,
      nextFen: normalizeReportFen(played.nextFen)
    };
  } catch {
    return {
      uci,
      san: null,
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4) : null,
      nextFen: ''
    };
  }
}

function publicPreparedMove(move) {
  if (!move) return null;
  return {
    uci: move.uci,
    san: move.san || null,
    from: move.from || move.uci?.slice(0, 2) || '',
    to: move.to || move.uci?.slice(2, 4) || '',
    promotion: move.promotion || null,
    nextFen: normalizeReportFen(move.nextFen)
  };
}

function preparedMoveScore(move, trainer, seen = new Set()) {
  if (!move) return 0;
  const nextFen = normalizeReportFen(move.nextFen);
  if (!nextFen || seen.has(nextFen)) return 1;
  seen.add(nextFen);
  const replies = getCandidateMoves(trainer, nextFen);
  return 1 + replies.reduce((total, reply) => total + preparedMoveScore(reply, trainer, new Set(seen)), 0);
}

function rankPreparedMoves(trainer, fen) {
  return getCandidateMoves(trainer, fen)
    .map((move, index) => ({
      move,
      index,
      score: preparedMoveScore(move, trainer)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.move);
}

function autoAdvanceOurPreparedReply({ trainer, fen, ply, history, ourSide }) {
  const normalizedFen = normalizeReportFen(fen);
  const result = {
    fen: normalizedFen,
    ply: Math.max(0, Number(ply) || 0),
    history: Array.isArray(history) ? [...history] : [],
    appliedPrepLine: [],
    preparedReplies: []
  };

  if (sideToMove(normalizedFen) !== ourSide) return result;
  const preparedReplies = rankPreparedMoves(trainer, normalizedFen);
  result.preparedReplies = preparedReplies.map(publicPreparedMove);
  const selected = preparedReplies[0];
  if (!selected) return result;

  result.appliedPrepLine.push(publicPreparedMove(selected));
  result.history.push(historyLabelForMove(result.fen, result.ply, selected));
  result.fen = normalizeReportFen(selected.nextFen);
  result.ply += 1;
  return result;
}

function makeNextScope({ trainer, fen, ply, history, opponentMove, ourSide }) {
  const opponentDetails = moveDetailsFromFen(fen, opponentMove?.uci);
  const movedHistory = [
    ...(Array.isArray(history) ? history : []),
    historyLabelForMove(fen, ply, {
      san: opponentDetails?.san || null,
      uci: opponentMove?.uci || ''
    })
  ].filter(Boolean);
  const afterOpponent = {
    fen: opponentDetails?.nextFen || opponentMove?.nextFen || '',
    ply: Math.max(0, Number(ply) || 0) + 1,
    history: movedHistory
  };
  const advanced = autoAdvanceOurPreparedReply({
    trainer,
    fen: afterOpponent.fen,
    ply: afterOpponent.ply,
    history: afterOpponent.history,
    ourSide
  });

  return {
    fen: advanced.fen,
    ply: advanced.ply,
    positionLine: formatHistoryLine(advanced.history),
    opponentMove: opponentDetails,
    autoReply: advanced.appliedPrepLine[0] || null,
    preparedReplies: advanced.preparedReplies,
    appliedPrepLine: advanced.appliedPrepLine
  };
}

function opponentMovesAtScope(opponentTree, fen, limit = 12, enrich = null) {
  const node = opponentTree.nodes.get(fen);
  const total = Number(node?.total) || 0;
  return (Array.isArray(node?.moves) ? node.moves : [])
    .slice()
    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.uci).localeCompare(String(b.uci)))
    .slice(0, limit)
    .map((move) => {
      const details = moveDetailsFromFen(fen, move.uci);
      const count = Number(move.count) || 0;
      return {
        uci: move.uci,
        san: details?.san || null,
        from: details?.from || '',
        to: details?.to || '',
        promotion: details?.promotion || null,
        nextFen: details?.nextFen || move.nextFen || '',
        count,
        total,
        share: total ? count / total : 0,
        scoreRate: Number.isFinite(move.scoreRate) ? move.scoreRate : null,
        ...(typeof enrich === 'function' ? enrich(move, details) : {})
      };
    });
}

function makeOpponentExplorer(opponentTree) {
  const nodes = {};
  for (const node of opponentTree.nodes.values()) {
    const fen = normalizeReportFen(node.fen);
    if (!fen) continue;
    const total = Number(node.total) || 0;
    nodes[fen] = {
      fen,
      total,
      moves: (Array.isArray(node.moves) ? node.moves : [])
        .slice()
        .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.uci).localeCompare(String(b.uci)))
        .slice(0, 24)
        .map((move) => {
          const count = Number(move.count) || 0;
          return {
            uci: move.uci,
            count,
            total,
            share: total ? count / total : 0,
            scoreRate: Number.isFinite(move.scoreRate) ? move.scoreRate : null,
            nextFen: move.nextFen || ''
          };
        })
    };
  }
  return {
    opponent: opponentTree.opponent || '',
    opponentSide: opponentTree.opponentSide || 'w',
    sampleGames: Number(opponentTree.sampleGames ?? opponentTree.games?.length) || 0,
    nodes
  };
}

function makeOpponentDecision({ opponentTree, trainer, fen, ply, history, ourSide, limit = 12 }) {
  const normalizedFen = normalizeReportFen(fen);
  const scopeHistory = Array.isArray(history) ? history : [];
  const moves = opponentMovesAtScope(opponentTree, normalizedFen, limit, (move) => {
    const nextScope = makeNextScope({
      trainer,
      fen: normalizedFen,
      ply,
      history: scopeHistory,
      opponentMove: move,
      ourSide
    });
    return {
      nextScope,
      autoReply: nextScope.autoReply,
      preparedReplies: nextScope.preparedReplies,
      appliedPrepLine: nextScope.appliedPrepLine
    };
  });
  return {
    fen: normalizedFen,
    ply,
    positionLine: formatHistoryLine(scopeHistory),
    moves
  };
}

function coerceOpponentTree(opponentTree) {
  if (!opponentTree) return null;
  if (opponentTree.nodes instanceof Map) {
    return {
      ...opponentTree,
      sampleGames: Number(opponentTree.sampleGames ?? opponentTree.games?.length) || 0
    };
  }

  const nodes = new Map();
  for (const node of Array.isArray(opponentTree.nodes) ? opponentTree.nodes : []) {
    nodes.set(node.fen, {
      fen: node.fen,
      total: Number(node.total) || 0,
      moves: (Array.isArray(node.moves) ? node.moves : []).map((move) => ({
        uci: move.uci,
        count: Number(move.count) || 0,
        score: Number(move.score) || 0,
        scoreRate: Number.isFinite(move.scoreRate) ? move.scoreRate : 0,
        nextFen: move.nextFen || ''
      }))
    });
  }

  return {
    ...opponentTree,
    nodes,
    root: opponentTree.root || publicNode(nodes.get(START_FEN)),
    games: Array.isArray(opponentTree.games) ? opponentTree.games : [],
    sampleGames: Number(opponentTree.sampleGames ?? opponentTree.games?.length) || 0
  };
}

export function buildPrepReport({
  store,
  opponentTree: providedOpponentTree = null,
  opponent,
  ourSide = 'w',
  prepPgn = '',
  focusFen = '',
  focusPly = 0,
  focusLine = '',
  maxPly = 40,
  lowSampleThreshold = 2,
  weakScoreThreshold = 0.35
} = {}) {
  const opponentSide = getOpponentSideForOurSide(ourSide);
  const opponentTree = coerceOpponentTree(providedOpponentTree)
    || buildOpponentOpeningTree(store, { opponent, opponentSide, maxPly });
  const trainer = createTrainerFromPgn(prepPgn);
  const unseen = [];
  const lowSample = [];
  const weakPerformance = [];
  const gaps = [];
  const initialScopeFen = normalizeReportFen(focusFen) || trainer.rootFen;
  const initialScopePly = Math.max(0, Number(focusPly) || 0);
  const initialScopeHistory = String(focusLine || '').trim() ? [String(focusLine).trim()] : [];
  const hasExplicitFocus = Boolean(normalizeReportFen(focusFen) || initialScopePly || initialScopeHistory.length);
  const initialScope = {
    fen: initialScopeFen,
    ply: initialScopePly,
    history: initialScopeHistory
  };
  const advancedScope = hasExplicitFocus
    ? autoAdvanceOurPreparedReply({
      trainer,
      fen: initialScope.fen,
      ply: initialScope.ply,
      history: initialScope.history,
      ourSide
    })
    : initialScope;
  const scope = hasExplicitFocus && !advancedScope.appliedPrepLine?.length && sideToMove(advancedScope.fen) !== opponentSide
    ? advanceScopeAlongMainline({
      prepPgn,
      startFen: advancedScope.fen,
      startPly: advancedScope.ply,
      startHistory: advancedScope.history,
      ourSide,
      opponentSide,
      maxPly
    })
    : advancedScope;
  const scopeFen = scope.fen;
  const scopePly = scope.ply;
  const scopeHistory = scope.history;
  const decision = makeOpponentDecision({
    opponentTree,
    trainer,
    fen: scopeFen,
    ply: scopePly,
    history: scopeHistory,
    ourSide
  });
  const scopeOpponentMoves = decision.moves;

  for (const prepNode of preparedNodes(trainer, maxPly, {
    startFen: scopeFen,
    startPly: scopePly,
    startHistory: scopeHistory
  })) {
    if (sideToMove(prepNode.fen) !== opponentSide) continue;
    const opponentNode = opponentTree.nodes.get(prepNode.fen);
    const preparedUcis = new Set(prepNode.moves.map((move) => move.uci));

    for (const move of prepNode.moves) {
      const opponentMove = findOpponentMove(opponentTree, prepNode.fen, move.uci);
      if (!opponentMove) {
        unseen.push(makeReportItem({ fen: prepNode.fen, ply: prepNode.ply, history: prepNode.history, move, reason: 'opponent-unseen' }));
      } else {
        if (opponentMove.count <= lowSampleThreshold) {
          lowSample.push(makeReportItem({ fen: prepNode.fen, ply: prepNode.ply, history: prepNode.history, move, opponentMove, reason: 'low-sample' }));
        }
        if (opponentMove.scoreRate <= weakScoreThreshold) {
          weakPerformance.push(makeReportItem({ fen: prepNode.fen, ply: prepNode.ply, history: prepNode.history, move, opponentMove, reason: 'weak-performance' }));
        }
      }
    }

    for (const opponentMove of opponentNode?.moves || []) {
      if (!preparedUcis.has(opponentMove.uci)) {
        gaps.push(makeReportItem({ fen: prepNode.fen, ply: prepNode.ply, history: prepNode.history, opponentMove, reason: 'prep-gap' }));
      }
    }
  }

  return {
    opponent: opponent || opponentTree.opponent,
    ourSide,
    opponentSide,
    sampleGames: Number(opponentTree.sampleGames ?? opponentTree.games?.length) || 0,
    totalStoreGames: Array.isArray(store?.games) ? store.games.length : 0,
    scope: {
      fen: scopeFen,
      ply: scopePly,
      positionLine: formatHistoryLine(scopeHistory)
    },
    decision,
    explorer: makeOpponentExplorer(opponentTree),
    appliedPrepLine: Array.isArray(scope.appliedPrepLine) ? scope.appliedPrepLine : [],
    unseen,
    lowSample,
    weakPerformance,
    gaps,
    scopeOpponentMoves,
    topOpponentMoves: opponentTree.root.moves.slice(0, 8)
  };
}
