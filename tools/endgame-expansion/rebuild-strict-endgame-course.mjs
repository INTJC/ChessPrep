import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { playLegalUciMove, replayPgnGame, splitPgnGames } from '../../app.js';
import {
  classicalTimeControlEvidence,
  clockEvidenceAtStart,
  extractMoveCommentEvidence,
  isEndgameMaterial,
  numericElo,
  passesEliteGate
} from './scan-pgn-endgames.mjs';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'data', 'endgame-expansion', 'reports');
const RAW_DIR = join(ROOT, 'data', 'endgame-expansion', 'sources', 'raw');
const DEFAULT_OUTPUT = join(ROOT, 'data', 'endgame-expansion', 'candidates', 'strict-endgame-course.json');
const DEFAULT_REPORT = join(ROOT, 'data', 'endgame-expansion', 'reports', 'strict-endgame-course-audit.json');
const TARGET_COUNT = 300;
const MIN_SOURCE_PLIES = 8;
const MAX_SOURCE_MOVE_GAP_CP = 35;
const MIN_DEFENSIVE_DRAW_PRESSURE_CP = 80;
const MAX_DEFENSIVE_DRAW_PRESSURE_CP = 180;
const MIN_BOTH_ELO = 2650;
const PREFERRED_BOTH_ELO = 2700;
const MIN_ENGINE_DEPTH = 12;
const COMPLETE_SOURCE_DATE_RE = /^\d{4}\.\d{2}\.\d{2}$/;
const QUEEN_CATEGORIES = new Set(['queen-endgames', 'queen-minor-endgames']);
const REJECT_EVENT_PATTERN = 'tcec|computer|engine|stockfish|komodo|lc0|leela|dragon|cct_|champions chess tour|speed chess|esports|rapid|blitz|bullet|online|internet|pro league|icc|chess\\.com|lichess|prelim|play-in|\\btb\\b|tiebreak|tie-break|blindfold|armageddon|banter|showdown|basque|fischer random|freestyle|frd';
const PREFERRED_EVENT_PATTERN = 'Candidates|WCh|World Championship|World Cup|Grand Swiss|Grand Prix|FIDE GP|Tata Steel|Corus A|Norway Chess|Sinquefield|London Classic|London Chess Classic|GRENKE|Dortmund|Linares|Pearl Spring|Tal Mem|Tal Memorial|Aerosvit|M-Tel|Final Masters|Grand Slam|Shamkir|Gashimov|Olympiad|European Teams|World Teams';
const CLASSICAL_EVENT_PATTERN = `${PREFERRED_EVENT_PATTERN}|Chennai Grand Masters|Bundesliga|US Championship|Grand Chess Tour|Superbet`;

function parseArgs(argv) {
  const args = {
    output: DEFAULT_OUTPUT,
    report: DEFAULT_REPORT,
    target: TARGET_COUNT
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') args.output = argv[++index];
    else if (arg === '--report') args.report = argv[++index];
    else if (arg === '--target') args.target = Number(argv[++index]) || args.target;
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listReportFiles(pattern) {
  return readdirSync(REPORT_DIR).filter((name) => pattern.test(name));
}

function loadShortlistCandidates() {
  const byId = new Map();
  for (const file of listReportFiles(/shortlist.*\.json$/i)) {
    const data = readJson(join(REPORT_DIR, file));
    for (const candidate of data.shortlist || []) {
      if (!byId.has(candidate.id)) byId.set(candidate.id, { ...candidate, shortlistFile: file });
    }
  }
  return byId;
}

function loadReviewRows() {
  const byId = new Map();
  for (const file of listReportFiles(/review.*\.json$/i)) {
    const data = readJson(join(REPORT_DIR, file));
    for (const row of data.rows || []) {
      if (!byId.has(row.id)) byId.set(row.id, { ...row, reviewFile: file });
    }
  }
  return byId;
}

function loadAnalysisReports() {
  const byId = new Map();
  for (const file of listReportFiles(/^original-analysis-.*\.json$/i)) {
    const data = readJson(join(REPORT_DIR, file));
    for (const analysis of data.analyses || []) {
      const id = String(analysis.id || '').replace(/^draft-/, '');
      if (!byId.has(id)) byId.set(id, { ...analysis, reportFile: file });
    }
  }
  return byId;
}

function sourceGamePath(sourceGameId) {
  const parts = String(sourceGameId || '').split('|');
  const fileName = parts[0];

  if (/^lichess_db_broadcast_/i.test(fileName)) {
    return join(RAW_DIR, 'lichess-broadcast-db', fileName);
  }
  const playerFile = fileName.replace(/\.pgn$/i, '').toLowerCase();
  return join(RAW_DIR, `pgnmentor-${playerFile}`, fileName);
}

function sourceGameReplay(sourceGameId) {
  const parts = String(sourceGameId || '').split('|');
  const gameIndex = Number(parts[5]);
  if (!parts[0] || !Number.isInteger(gameIndex) || gameIndex < 1) {
    throw new Error(`invalid sourceGameId ${sourceGameId}`);
  }

  const pgnPath = sourceGamePath(sourceGameId);
  const games = splitPgnGames(readFileSync(pgnPath, 'utf8'));
  const game = games[gameIndex - 1];
  if (!game) throw new Error(`source game ${gameIndex} not found in ${pgnPath}`);
  return replayPgnGame(game);
}

function sourceGameText(sourceGameId) {
  const parts = String(sourceGameId || '').split('|');
  const gameIndex = Number(parts[5]);
  if (!parts[0] || !Number.isInteger(gameIndex) || gameIndex < 1) {
    throw new Error(`invalid sourceGameId ${sourceGameId}`);
  }
  const games = splitPgnGames(readFileSync(sourceGamePath(sourceGameId), 'utf8'));
  const game = games[gameIndex - 1];
  if (!game) throw new Error(`source game ${gameIndex} not found for ${sourceGameId}`);
  return game;
}

function positionKey(fen) {
  return String(fen || '').trim().split(/\s+/).slice(0, 4).join(' ');
}

function winnerFor(result) {
  if (result === '1-0') return 'w';
  if (result === '0-1') return 'b';
  return null;
}

function targetFor(candidate) {
  const result = candidate.source?.result;
  const winner = winnerFor(result);
  if (winner && candidate.orientation === winner) return 'win';
  if (result === '1/2-1/2') return 'draw';
  return null;
}

function targetLabel(target) {
  return target === 'win' ? '目标：赢棋' : '目标：守和';
}

function sideLabel(side) {
  return side === 'w' ? '白方' : '黑方';
}

function categoryTheme(category) {
  if (category === 'rook-activity') return '车的入口、横向调动和通路兵速度决定局面归属。';
  if (category === 'king-activity') return '王的活跃和兵形速度决定局面归属，不能只看静态子力。';
  if (category === 'practical-themes') return '这里的核心不是固定子力类型，而是实战转换、通路兵和防守资源的连续判断。';
  if (category === 'single-rook-defense') return '单车残局的关键是把被动防守转换成侧面将军或兵形反击。';
  if (category === 'rook-minor-activity') return '车和轻子的活动性比静态兵数更重要，支点一旦被换掉，评价会快速变化。';
  if (category === 'rook-bishop-knight') return '车象和车马的较量集中在关键格控制、王路和远端兵的速度。';
  if (category === 'queen-endgames') return '后残局首先比较王安全和连续将军路线，其次才是兵数。';
  if (category === 'queen-minor-endgames') return '后加轻子需要同时计算将军节奏、轻子控制格和升变兵。';
  if (category === 'opposite-bishop-initiative') return '异色象结构里主动权和第二目标往往比物质更重要。';
  return '训练重点是把实战资源连续执行到最终结果。';
}

function moveTheme(move) {
  const san = String(move?.san || '');
  if (san.includes('#')) return '这一手直接把前面累积的王位压力兑现为杀棋。';
  if (san.includes('+')) return '带将军的节奏迫使对方先处理王安全，强迫性很高。';
  if (san.includes('=')) return '升变进入计算核心，双方必须同时比较新后和王位安全。';
  if (san.includes('x')) return '吃子不是单纯收材料，而是在清除防守支点或升变支撑。';
  if (/^K/.test(san)) return '王的站位决定后续挡将、追兵和反击能否成立。';
  if (/^Q/.test(san)) return '后的换位用来控制将军节奏，让对方没有舒服的整理手。';
  if (/^R/.test(san)) return '车的横向活动在这里决定主动权，不能只守一个点。';
  if (/^[BN]/.test(san)) return '轻子换位是在争关键格，影响王路和通路兵路线。';
  return '兵形推进改变双方支点，后续计划要围绕新弱格重新组织。';
}

function pairMoves(sourceLine) {
  const steps = [];
  for (let index = 0; index < sourceLine.length; index += 2) {
    const move = sourceLine[index];
    const reply = sourceLine[index + 1] || null;
    steps.push([move, reply]);
  }
  return steps;
}

function generatedStepNote(candidate, move, reply, pairIndex, pairCount) {
  const phase = pairIndex >= pairCount - 2 ? '收束阶段' : pairIndex >= Math.floor(pairCount / 2) ? '中段转换' : '关键起点';
  const replyText = reply ? ` 对方以 ${reply.san} 应对，说明这不是单步技巧，而是需要继续计算的实战资源。` : '';
  return `${phase}：${move.san}。${moveTheme(move)}${replyText}${categoryTheme(candidate.category)}`;
}

function materialProfile(fen) {
  const placement = String(fen || '').split(/\s+/)[0] || '';
  const profile = {
    queens: 0,
    rooks: 0,
    bishops: 0,
    knights: 0,
    pawns: 0,
    total: 0
  };
  for (const piece of placement) {
    if (piece === '/' || /\d/.test(piece)) continue;
    const upper = piece.toUpperCase();
    profile.total += 1;
    if (upper === 'Q') profile.queens += 1;
    else if (upper === 'R') profile.rooks += 1;
    else if (upper === 'B') profile.bishops += 1;
    else if (upper === 'N') profile.knights += 1;
    else if (upper === 'P') profile.pawns += 1;
  }
  profile.minors = profile.bishops + profile.knights;
  return profile;
}

function bishopSquareColors(fen) {
  const placement = String(fen || '').split(/\s+/)[0] || '';
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

function categoryFromEffectiveFen(fen) {
  const profile = materialProfile(fen);
  if (profile.queens > 0 && profile.minors > 0) return 'queen-minor-endgames';
  if (profile.queens > 0) return 'queen-endgames';
  if (profile.rooks > 0 && profile.minors > 0) return 'rook-minor-activity';
  if (profile.rooks === 2 && profile.minors === 0) return 'single-rook-defense';
  if (profile.rooks >= 2) return 'rook-activity';
  if (profile.rooks === 1) return 'single-rook-defense';
  if (hasOppositeColoredBishops(fen)) return 'opposite-bishop-initiative';
  if (profile.minors > 0) return 'practical-themes';
  if (profile.pawns > 0) return 'king-activity';
  return 'practical-themes';
}

function effectiveCategoryForLine(candidate, sourceLine) {
  let fen = candidate.fen;
  if (sourceLine[0]) fen = playLegalUciMove(fen, sourceLine[0].uci).nextFen;
  const afterFirstMove = fen;
  if (sourceLine[1]) fen = playLegalUciMove(fen, sourceLine[1].uci).nextFen;
  const afterFirstPair = fen;
  const afterFirstMoveCategory = categoryFromEffectiveFen(afterFirstMove);
  const afterFirstPairCategory = categoryFromEffectiveFen(afterFirstPair);
  return {
    category: afterFirstMoveCategory === afterFirstPairCategory ? afterFirstPairCategory : 'practical-themes',
    afterFirstMoveCategory,
    afterFirstMoveFen: afterFirstMove,
    effectiveFen: afterFirstPair
  };
}

function queenCount(fen) {
  return (String(fen || '').split(/\s+/)[0].match(/[Qq]/g) || []).length;
}

function hasCompleteSourceMetadata(candidate) {
  const source = candidate.source || {};
  return COMPLETE_SOURCE_DATE_RE.test(source.date || '')
    && !/\?\?|unknown/i.test(candidate.sourceGameId || '')
    && !/\?\?|unknown/i.test(`${source.event || ''} ${source.date || ''} ${source.white || ''} ${source.black || ''}`);
}

function sourceEvidence(candidate, sourceLine = null, review = null) {
  const gameText = sourceGameText(candidate.sourceGameId);
  const replay = replayPgnGame(gameText);
  const moveEvidence = extractMoveCommentEvidence(gameText);
  const startClock = clockEvidenceAtStart(replay, moveEvidence, candidate.startPly);
  const latestEval = (() => {
    for (let cursor = Math.max(0, candidate.startPly) - 1; cursor >= 0; cursor -= 1) {
      const evalCp = moveEvidence[cursor]?.evalCp;
      if (Number.isFinite(evalCp)) return evalCp;
    }
    return null;
  })();
  const sourceMoveDepth = (review?.topLines || []).find((line) => line.move === candidate.suggestedFirstMove)?.depth
    ?? review?.topLines?.[0]?.depth
    ?? null;
  return {
    headers: replay.headers,
    whiteElo: numericElo(replay.headers.WhiteElo),
    blackElo: numericElo(replay.headers.BlackElo),
    timeControl: classicalTimeControlEvidence(replay.headers, { classicalEventPattern: CLASSICAL_EVENT_PATTERN }),
    variant: replay.headers.Variant || 'Standard',
    startClockSeconds: {
      w: startClock.w,
      b: startClock.b
    },
    startEvalCp: Number.isFinite(latestEval) ? latestEval : scoreFor(review),
    engineDepth: sourceMoveDepth,
    hasCompleteLine: Array.isArray(sourceLine) && sourceLine.length >= MIN_SOURCE_PLIES
  };
}

function hasEliteSourceEvidence(candidate, review, evidence, options = {}) {
  if (!passesEliteGate(evidence.headers, {
    minBothElo: MIN_BOTH_ELO,
    rejectEventPattern: REJECT_EVENT_PATTERN,
    requireClassicalEvidence: true,
    classicalEventPattern: CLASSICAL_EVENT_PATTERN
  })) return false;
  if (evidence.variant !== 'Standard') return false;
  if (!evidence.timeControl) return false;
  if (!Number.isFinite(evidence.startEvalCp)) return false;
  if (!Number.isInteger(evidence.engineDepth) || evidence.engineDepth < MIN_ENGINE_DEPTH) return false;
  if (!options.materialGatePassed) return false;
  return true;
}

function isFirstMoveQueenWipeoutTransition(candidate, sourceLine) {
  if (!QUEEN_CATEGORIES.has(candidate.category)) return false;
  if (!sourceLine[0]) return false;

  const beforeQueenCount = queenCount(candidate.fen);
  if (!beforeQueenCount) return false;

  const afterFirstMove = playLegalUciMove(candidate.fen, sourceLine[0].uci).nextFen;
  return queenCount(afterFirstMove) === 0;
}

function stepsFromSourceLine(candidate, sourceLine, analysis) {
  const oldByMove = new Map();
  for (const step of analysis?.steps || []) {
    const key = `${step.move}|${step.reply || ''}`;
    if (!oldByMove.has(key)) oldByMove.set(key, step.note || '');
  }
  const pairs = pairMoves(sourceLine);
  return pairs.map(([move, reply], index) => {
    const key = `${move.uci}|${reply?.uci || ''}`;
    const note = oldByMove.get(key) || generatedStepNote(candidate, move, reply, index, pairs.length);
    return {
      move: move.uci,
      ...(reply ? { reply: reply.uci } : {}),
      note
    };
  });
}

function lessonLineMoves(lesson) {
  const moves = [];
  for (const step of lesson.steps || []) {
    moves.push(step.move);
    if (step.reply) moves.push(step.reply);
  }
  return moves;
}

function finalFenFor(lesson) {
  let fen = lesson.fen;
  for (const step of lesson.steps || []) {
    fen = playLegalUciMove(fen, step.move).nextFen;
    if (step.reply) fen = playLegalUciMove(fen, step.reply).nextFen;
  }
  return fen;
}

function fullSourceLine(candidate) {
  const replay = sourceGameReplay(candidate.sourceGameId);
  const startMove = replay.moves[candidate.startPly];
  if (!startMove) throw new Error(`${candidate.id} missing start ply ${candidate.startPly}`);
  if (candidate.fen !== startMove.beforeFen) {
    throw new Error(`${candidate.id} FEN does not match source PGN start`);
  }
  return replay.moves.slice(candidate.startPly).map((move) => ({
    ply: move.ply,
    san: move.san,
    uci: move.uci,
    beforeFen: move.beforeFen,
    afterFen: move.afterFen
  }));
}

function scoreFor(review) {
  return Number.isFinite(review?.sourceScoreCp) ? review.sourceScoreCp : review?.bestScoreCp;
}

function defensivePressureCp(review) {
  const score = scoreFor(review);
  return Number.isFinite(score) ? Math.max(0, -score) : null;
}

function selectionScore(item) {
  const { candidate, review, analysis, target } = item;
  const sourceScore = scoreFor(review);
  const complexity = Number(candidate.complexityScore) || 8;
  const hasAnalysisBoost = analysis ? 10000 : 0;
  const decisionBoost = review.initialDecision === 'keep-for-original-analysis' ? 1000 : 0;
  const rankBoost = review.engineRank === 1 ? 250 : 0;
  const gapPenalty = Number.isFinite(review.gapCp) ? review.gapCp : 50;
  const eventBoost = new RegExp(PREFERRED_EVENT_PATTERN, 'i').test(candidate.source?.event || '') ? 600 : 0;
  const eloBoost = Math.min(numericElo(candidate.source?.whiteElo) || 0, numericElo(candidate.source?.blackElo) || 0) >= PREFERRED_BOTH_ELO ? 350 : 0;
  const targetScore =
    target === 'win'
      ? Math.max(0, Number.isFinite(sourceScore) ? sourceScore : 0)
      : Math.max(0, -(Number.isFinite(sourceScore) ? sourceScore : 0)) + 400;
  return hasAnalysisBoost + decisionBoost + rankBoost + eventBoost + eloBoost + complexity * 25 + targetScore - gapPenalty;
}

function generatedAnalysis(candidate, review, target) {
  const side = sideLabel(candidate.orientation);
  const sourceScore = scoreFor(review);
  const resultText = target === 'win' ? '最终实战赢下' : '最终实战守和';
  const scoreText = Number.isFinite(sourceScore)
    ? `引擎复核给源着法约 ${sourceScore}cp，并且它是第 ${review.engineRank || '?'} 候选。`
    : '引擎复核显示源着法在候选主线内。';
  const pressureText = target === 'draw' && Number.isFinite(sourceScore)
    ? `题面起点从防守方视角约 ${sourceScore}cp，已经不是普通均势和棋。`
    : '';
  return {
    principle:
      target === 'win'
        ? `${side}训练目标是把优势转换成实战胜利。这里不能只数材料，必须用主动子力持续限制对方最顽强的防守资源。`
        : `${side}训练目标是在明显劣势压力下守和。${pressureText} 关键是先拆掉对方最直接的赢棋路径，再用活动性争取半分。`,
    method:
      `${candidate.source.white} - ${candidate.source.black} 的实战线从当前局面一直走到 ${candidate.source.result}。${scoreText} 训练时要按原局连续执行：先确认第一手为什么能保留结果，再看每个应手如何迫使计划继续。${categoryTheme(candidate.category)} 最终这条线${resultText}，所以训练重点是结果导向，而不是停在中途评价。`,
    mistake:
      target === 'win'
        ? '常见错误是看到优势后提前简化或只追求多吃一兵，给防守方留下长将、堡垒或远端通路兵反击。'
        : '常见错误是把防守理解成原地等待；在这种压力局面里，少走一步主动资源就会让对方把优势稳定兑现。'
  };
}

function generatedHints(candidate, target) {
  return target === 'win'
    ? [
        '先找能把对方防守子固定住的第一手。',
        `目标不是马上结束，而是把 ${candidate.source.result} 的实战胜利连续兑现。`
      ]
    : [
        '先找能减少对方最直接赢棋路线的防守资源。',
        '守和题的关键是活动性，不是被动等对方犯错。'
      ];
}

function sourceGameLabel(source) {
  const players = [source?.white, source?.black].filter(Boolean).join('-');
  const tail = [source?.event, source?.date].filter(Boolean).join(' ');
  return [players, tail].filter(Boolean).join(', ');
}

function normalizeLesson(item) {
  const { candidate, review, analysis, sourceLine, target, evidence } = item;
  const effectiveCategory = effectiveCategoryForLine(candidate, sourceLine);
  const lessonCandidate = { ...candidate, category: effectiveCategory.category };
  const categoryChanged = candidate.category !== effectiveCategory.category;
  const usableAnalysis = categoryChanged ? null : analysis;
  const teaching = usableAnalysis?.teaching || generatedAnalysis(lessonCandidate, review, target);
  const hints = usableAnalysis?.hints || generatedHints(lessonCandidate, target);
  const lesson = {
    id: candidate.id,
    category: effectiveCategory.category,
    title: candidate.title.replace(/: move \d+$/i, `: ${sourceLine[0]?.san || '关键手'}`),
    level: candidate.level || '高水平复杂残局',
    goal: `${candidate.orientation === 'w' ? '白先' : '黑先'}，${target === 'win' ? '把实战优势赢下来' : '在压力下走出守和资源'}`,
    fen: candidate.fen,
    orientation: candidate.orientation,
    complexityScore: Number(candidate.complexityScore) || 8,
    trainingTarget: target,
    trainingTargetLabel: targetLabel(target),
    trainingTargetReason:
      target === 'win'
        ? '训练方与实战最终胜方一致，主线从题面连续走到真实胜局结果。'
        : `实战最终和棋，且题面起点从训练方视角处在 -${MIN_DEFENSIVE_DRAW_PRESSURE_CP} 到 -${MAX_DEFENSIVE_DRAW_PRESSURE_CP}cp 的“差一点”压力区间；训练方需要按真实连续线守住半分。`,
    sourceId: candidate.sourceId,
    sourceGameId: candidate.sourceGameId,
    sourceCandidateId: candidate.id,
    startPly: candidate.startPly,
    playerQualityReason:
      `${candidate.source.white} vs ${candidate.source.black}, ${candidate.source.event} ${candidate.source.date}. ` +
      `Selected by strict result-target gate, verified against the real PGN continuation, and annotated with original ChessPrep Lab analysis.`,
    source: {
      ...(candidate.source || {}),
      whiteElo: evidence.whiteElo,
      blackElo: evidence.blackElo,
      timeControl: evidence.timeControl,
      variant: evidence.variant,
      game: sourceGameLabel(candidate.source),
      chapter: 'Public PGN strict result-target endgame course',
      note: 'Public PGN source processed through the strict result-target course pipeline; teaching text is original ChessPrep Lab analysis.',
      provider: candidate.sourceId === 'lichess-broadcast-db' ? 'Lichess Broadcast Database' : 'PGN Mentor public PGN files'
    },
    teaching,
    hints,
    steps: stepsFromSourceLine(lessonCandidate, sourceLine, usableAnalysis),
    sourceLine: sourceLine.map((move) => ({ ...move })),
    audit: {
      reviewFile: review.reviewFile,
      analysisFile: analysis?.reportFile || null,
      analysisUsed: Boolean(usableAnalysis),
      analysisRebuiltForEffectiveCategory: categoryChanged,
      sourceCategory: candidate.category,
      effectiveCategory: effectiveCategory.category,
      afterFirstMoveCategory: effectiveCategory.afterFirstMoveCategory,
      afterFirstMoveFen: effectiveCategory.afterFirstMoveFen,
      categoryEffectiveFen: effectiveCategory.effectiveFen,
      engineRank: review.engineRank || null,
      gapCp: review.gapCp ?? null,
      sourceScoreCp: scoreFor(review) ?? null,
      startEvalCp: evidence.startEvalCp,
      engineDepth: evidence.engineDepth,
      startClockSeconds: evidence.startClockSeconds,
      minBothElo: MIN_BOTH_ELO,
      preferredBothElo: PREFERRED_BOTH_ELO,
      defensivePressureCp: defensivePressureCp(review),
      minDefensiveDrawPressureCp: target === 'draw' ? MIN_DEFENSIVE_DRAW_PRESSURE_CP : null,
      maxDefensiveDrawPressureCp: target === 'draw' ? MAX_DEFENSIVE_DRAW_PRESSURE_CP : null,
      selectionScore: item.score,
      manualGmReviewStatus: 'not-verified-locally',
      deepLineVerificationStatus: 'not-verified-locally',
      unverifiedRequirements: [
        '2600+ GM manual review',
        'Stockfish 40-50 ply full-line verification'
      ]
    }
  };
  const actual = lessonLineMoves(lesson);
  const expected = sourceLine.map((move) => move.uci);
  if (actual.length !== expected.length || actual.some((move, index) => move !== expected[index])) {
    throw new Error(`${lesson.id} line does not match full source line`);
  }
  lesson.finalFen = finalFenFor(lesson);
  return lesson;
}

function isEligible(candidate, review) {
  const target = targetFor(candidate);
  if (!target) return false;
  if (!hasCompleteSourceMetadata(candidate)) return false;
  if (!['1-0', '0-1', '1/2-1/2'].includes(candidate.source?.result)) return false;
  const goodMove = review.engineRank === 1 || (Number.isFinite(review.gapCp) && review.gapCp <= MAX_SOURCE_MOVE_GAP_CP);
  if (!goodMove) return false;
  if (target === 'draw') {
    const pressure = defensivePressureCp(review);
    return Number.isFinite(pressure)
      && pressure >= MIN_DEFENSIVE_DRAW_PRESSURE_CP
      && pressure <= MAX_DEFENSIVE_DRAW_PRESSURE_CP;
  }
  return true;
}

function continuationKeys(lesson) {
  let fen = lesson.fen;
  const keys = [];
  for (const step of lesson.steps || []) {
    fen = playLegalUciMove(fen, step.move).nextFen;
    keys.push(positionKey(fen));
    if (step.reply) {
      fen = playLegalUciMove(fen, step.reply).nextFen;
      keys.push(positionKey(fen));
    }
  }
  return keys;
}

function chooseLessons(items, targetCount) {
  const selected = [];
  const rejected = [];
  const starts = new Set();
  const startTasks = new Set();
  const continuations = new Set();

  for (const item of items) {
    if (selected.length >= targetCount) {
      rejected.push({ id: item.candidate.id, reason: 'target-filled' });
      continue;
    }
    let lesson;
    try {
      lesson = normalizeLesson(item);
    } catch (error) {
      rejected.push({ id: item.candidate.id, reason: error.message });
      continue;
    }

    const startKey = positionKey(lesson.fen);
    const taskKey = `${startKey}|${lesson.steps[0]?.move || ''}`;
    if (starts.has(startKey)) {
      rejected.push({ id: lesson.id, reason: 'duplicate-start-position' });
      continue;
    }
    if (startTasks.has(taskKey)) {
      rejected.push({ id: lesson.id, reason: 'duplicate-start-task' });
      continue;
    }
    if (continuations.has(startKey)) {
      rejected.push({ id: lesson.id, reason: 'starts-inside-selected-main-line' });
      continue;
    }
    const lineKeys = continuationKeys(lesson);
    if (lineKeys.some((key) => starts.has(key))) {
      rejected.push({ id: lesson.id, reason: 'line-covers-selected-start' });
      continue;
    }

    selected.push(lesson);
    starts.add(startKey);
    startTasks.add(taskKey);
    for (const key of lineKeys) continuations.add(key);
  }
  return { selected, rejected };
}

function lessonConflictKeySets(lessons) {
  const starts = new Set();
  const startTasks = new Set();
  const continuations = new Set();
  const ids = new Set();

  for (const lesson of lessons) {
    const startKey = positionKey(lesson.fen);
    starts.add(startKey);
    startTasks.add(`${startKey}|${lesson.steps?.[0]?.move || ''}`);
    ids.add(lesson.id);
    for (const key of continuationKeys(lesson)) continuations.add(key);
  }

  return { starts, startTasks, continuations, ids };
}

function lessonConflictsWithSets(lesson, sets) {
  if (sets.ids.has(lesson.id)) return 'duplicate-id';
  const startKey = positionKey(lesson.fen);
  const taskKey = `${startKey}|${lesson.steps?.[0]?.move || ''}`;
  if (sets.starts.has(startKey)) return 'duplicate-start-position';
  if (sets.startTasks.has(taskKey)) return 'duplicate-start-task';
  if (sets.continuations.has(startKey)) return 'starts-inside-existing-main-line';
  const lineKeys = continuationKeys(lesson);
  if (lineKeys.some((key) => sets.starts.has(key))) return 'line-covers-existing-start';
  return '';
}

function addLessonToSets(lesson, sets) {
  const startKey = positionKey(lesson.fen);
  sets.starts.add(startKey);
  sets.startTasks.add(`${startKey}|${lesson.steps?.[0]?.move || ''}`);
  sets.ids.add(lesson.id);
  for (const key of continuationKeys(lesson)) sets.continuations.add(key);
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function nestedReasonCounts(items, keyFn = (item) => item.category) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'uncategorized';
    if (!counts[key]) counts[key] = {};
    counts[key][item.reason] = (counts[key][item.reason] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => [
        key,
        Object.fromEntries(Object.entries(value).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
      ])
  );
}

function buildStrictCandidateItems({ allowedEffectiveCategories = null } = {}) {
  const candidates = loadShortlistCandidates();
  const reviews = loadReviewRows();
  const analyses = loadAnalysisReports();
  const allowedEffectiveCategorySet = allowedEffectiveCategories
    ? new Set(allowedEffectiveCategories)
    : null;
  const rejectedBeforeBuild = [];
  const items = [];

  function reject(id, candidate, reason) {
    rejectedBeforeBuild.push({
      id,
      category: candidate?.category || null,
      target: candidate ? targetFor(candidate) : null,
      reason
    });
  }

  for (const [id, candidate] of candidates) {
    const review = reviews.get(id);
    if (!review) {
      reject(id, candidate, 'missing-review');
      continue;
    }
    if (!isEligible(candidate, review)) {
      reject(id, candidate, 'result-target-or-engine-gate');
      continue;
    }
    let sourceLine;
    try {
      sourceLine = fullSourceLine(candidate);
    } catch (error) {
      reject(id, candidate, error.message);
      continue;
    }
    if (isFirstMoveQueenWipeoutTransition(candidate, sourceLine)) {
      reject(id, candidate, 'first move wipes out queen-endgame source tension');
      continue;
    }
    if (sourceLine.length < MIN_SOURCE_PLIES) {
      reject(id, candidate, `source line shorter than ${MIN_SOURCE_PLIES} plies`);
      continue;
    }
    let materialGatePassed = isEndgameMaterial(candidate.fen);
    if (!materialGatePassed && allowedEffectiveCategorySet?.size) {
      const effectiveCategory = effectiveCategoryForLine(candidate, sourceLine).category;
      materialGatePassed = allowedEffectiveCategorySet.has(effectiveCategory);
    }
    let evidence;
    try {
      evidence = sourceEvidence(candidate, sourceLine, review);
    } catch (error) {
      reject(id, candidate, `source evidence failed: ${error.message}`);
      continue;
    }
    if (!hasEliteSourceEvidence(candidate, review, evidence, { materialGatePassed })) {
      reject(id, candidate, 'missing 2650+ classical Elo, engine, or endgame evidence');
      continue;
    }
    const targetKind = targetFor(candidate);
    const item = {
      candidate,
      review,
      analysis: analyses.get(id) || null,
      sourceLine,
      target: targetKind,
      evidence
    };
    item.score = selectionScore(item);
    items.push(item);
  }

  items.sort((a, b) => {
    const analysisDelta = Number(Boolean(b.analysis)) - Number(Boolean(a.analysis));
    if (analysisDelta) return analysisDelta;
    return b.score - a.score || a.candidate.id.localeCompare(b.candidate.id);
  });

  return { items, rejectedBeforeBuild };
}

export function buildStrictCategoryFillLessons({
  existingLessons = [],
  categoryIds = [],
  minByCategory = 15
} = {}) {
  const existingCounts = countBy(existingLessons, (lesson) => lesson.category);
  const neededByCategory = Object.fromEntries(
    categoryIds.map((category) => [category, Math.max(0, minByCategory - (existingCounts[category] || 0))])
  );
  const selected = [];
  const rejected = [];
  const sets = lessonConflictKeySets(existingLessons);
  const { items, rejectedBeforeBuild } = buildStrictCandidateItems({ allowedEffectiveCategories: categoryIds });
  const strictInputCounts = countBy(items, (item) => item.candidate.category);
  const effectiveCounts = {};
  const targetEffectiveCounts = {};
  const targetConflictCounts = {};

  for (const item of items) {
    let lesson;
    try {
      lesson = normalizeLesson(item);
    } catch (error) {
      rejected.push({ id: item.candidate.id, reason: error.message });
      continue;
    }
    effectiveCounts[lesson.category] = (effectiveCounts[lesson.category] || 0) + 1;
    if (categoryIds.includes(lesson.category)) {
      targetEffectiveCounts[lesson.category] = (targetEffectiveCounts[lesson.category] || 0) + 1;
    }
    if (!neededByCategory[lesson.category]) continue;
    const conflict = lessonConflictsWithSets(lesson, sets);
    if (conflict) {
      targetConflictCounts[conflict] = (targetConflictCounts[conflict] || 0) + 1;
      rejected.push({ id: lesson.id, reason: conflict });
      continue;
    }
    selected.push(lesson);
    addLessonToSets(lesson, sets);
    neededByCategory[lesson.category] -= 1;
    if (Object.values(neededByCategory).every((needed) => needed <= 0)) break;
  }

  return {
    generatedAt: new Date().toISOString(),
    minByCategory,
    requestedCategories: categoryIds,
    existingCounts,
    strictInputCounts,
    targetRejectedBeforeBuildCounts: nestedReasonCounts(
      rejectedBeforeBuild.filter((row) => categoryIds.includes(row.category))
    ),
    effectiveCounts: Object.fromEntries(Object.entries(effectiveCounts).sort((a, b) => a[0].localeCompare(b[0]))),
    targetEffectiveCounts: Object.fromEntries(Object.entries(targetEffectiveCounts).sort((a, b) => a[0].localeCompare(b[0]))),
    targetConflictCounts: Object.fromEntries(Object.entries(targetConflictCounts).sort((a, b) => a[0].localeCompare(b[0]))),
    addedCounts: countBy(selected, (lesson) => lesson.category),
    remainingByCategory: neededByCategory,
    lessons: selected,
    rejected: rejected.slice(0, 200)
  };
}

export function rebuildStrictEndgameCourse({ target = TARGET_COUNT } = {}) {
  const { items, rejectedBeforeBuild } = buildStrictCandidateItems();

  const { selected, rejected } = chooseLessons(items, target);
  return {
    candidateData: {
      generatedAt: new Date().toISOString(),
      importReady: true,
      targetCount: target,
      lessons: selected,
      qualityGate: {
        sourcePgnMustReachGameResult: true,
        sourceFenMustMatchStartPly: true,
        trainingTargetMustMatchResult: true,
        noContinuationDuplicateStarts: true,
        minSourcePlies: MIN_SOURCE_PLIES,
        maxSourceMoveGapCp: MAX_SOURCE_MOVE_GAP_CP,
        defensiveDrawMustStartWorse: true,
        minDefensiveDrawPressureCp: MIN_DEFENSIVE_DRAW_PRESSURE_CP,
        maxDefensiveDrawPressureCp: MAX_DEFENSIVE_DRAW_PRESSURE_CP,
        completeSourceDateRequired: true,
        rejectFirstMoveQueenWipeoutTransition: true,
        minBothElo: MIN_BOTH_ELO,
        preferBothElo: PREFERRED_BOTH_ELO,
        preferredEventPattern: PREFERRED_EVENT_PATTERN,
        requireClassicalTimeControlEvidence: true,
        requireStartClockSecondsAtLeast: null,
        startClockEvidenceOptional: true,
        requireStartEvalEvidence: true,
        minEngineDepth: MIN_ENGINE_DEPTH,
        requireEndgameMaterialGate: true,
        manualGmReviewStatus: 'not-verified-locally',
        deepLineVerificationStatus: 'not-verified-locally',
        generatedFallbackAnalysisCount: selected.filter((lesson) => !lesson.audit.analysisFile).length,
        sourceRegistry: basename(join(ROOT, 'data', 'endgame-expansion', 'sources', 'source-registry.json'))
      }
    },
    audit: {
      generatedAt: new Date().toISOString(),
      target,
      selected: selected.length,
      shortfall: Math.max(0, target - selected.length),
      byTarget: countBy(selected, (lesson) => lesson.trainingTarget),
      byResult: countBy(selected, (lesson) => lesson.source.result),
      byCategory: countBy(selected, (lesson) => lesson.category),
      defensiveDrawPressure: {
        minCp: selected
          .filter((lesson) => lesson.trainingTarget === 'draw')
          .reduce((min, lesson) => Math.min(min, lesson.audit.defensivePressureCp), Infinity),
        byBucket: countBy(
          selected.filter((lesson) => lesson.trainingTarget === 'draw'),
          (lesson) => {
            const pressure = lesson.audit.defensivePressureCp;
            if (pressure >= 150) return '150-180';
            return '80-149';
          }
        )
      },
      generatedFallbackAnalysis: selected.filter((lesson) => !lesson.audit.analysisFile).map((lesson) => lesson.id),
      rejectedBeforeBuildCount: rejectedBeforeBuild.length,
      rejectedAfterBuildCount: rejected.length,
      rejectedAfterBuild: rejected.slice(0, 200)
    }
  };
}

export function main() {
  const args = parseArgs(process.argv);
  const result = rebuildStrictEndgameCourse({ target: args.target });
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result.candidateData, null, 2)}\n`);
  mkdirSync(dirname(args.report), { recursive: true });
  writeFileSync(args.report, `${JSON.stringify(result.audit, null, 2)}\n`);
  console.log(JSON.stringify(result.audit, null, 2));
  if (result.audit.selected < args.target) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
