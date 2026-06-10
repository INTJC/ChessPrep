import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { replayPgnGame, splitPgnGames } from '../../app.js';

const ROOT = process.cwd();
const RAW_DIR = join(ROOT, 'data', 'endgame-expansion', 'sources', 'raw');
const REPORT_DIR = join(ROOT, 'data', 'endgame-expansion', 'reports');
const MIN_COMPLEXITY = 7;

const PIECE_VALUES = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0
};

export function parseArgs(argv) {
  const args = {
    sourceId: 'user-provided-pgn',
    maxGames: 200,
    maxGamesPerFile: null,
    maxCandidatesPerGame: 1,
    minComplexity: MIN_COMPLEXITY,
    sourceLineLength: 12,
    minAnyElo: null,
    minOpponentElo: null,
    minBothElo: null,
    preferBothElo: null,
    requireTimeControl: false,
    requireClassicalEvidence: false,
    classicalEventPattern: null,
    preferResultTargets: false,
    requireClockAtStart: false,
    minStartClockSeconds: 0,
    rejectEventPattern: null,
    requireEventPattern: null,
    includeFilePattern: null,
    rejectFilePattern: null,
    output: null,
    rawDir: RAW_DIR
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source-id') args.sourceId = argv[++index];
    else if (arg === '--max-games') args.maxGames = Number(argv[++index]) || args.maxGames;
    else if (arg === '--max-games-per-file') args.maxGamesPerFile = Number(argv[++index]) || args.maxGamesPerFile;
    else if (arg === '--max-candidates-per-game') args.maxCandidatesPerGame = Number(argv[++index]) || args.maxCandidatesPerGame;
    else if (arg === '--min-complexity') args.minComplexity = Number(argv[++index]) || args.minComplexity;
    else if (arg === '--source-line-length') args.sourceLineLength = Number(argv[++index]) || args.sourceLineLength;
    else if (arg === '--min-any-elo') args.minAnyElo = Number(argv[++index]) || args.minAnyElo;
    else if (arg === '--min-opponent-elo') args.minOpponentElo = Number(argv[++index]) || args.minOpponentElo;
    else if (arg === '--min-both-elo') args.minBothElo = Number(argv[++index]) || args.minBothElo;
    else if (arg === '--prefer-both-elo') args.preferBothElo = Number(argv[++index]) || args.preferBothElo;
    else if (arg === '--require-time-control') args.requireTimeControl = true;
    else if (arg === '--require-classical-evidence') args.requireClassicalEvidence = true;
    else if (arg === '--classical-event-pattern') args.classicalEventPattern = argv[++index];
    else if (arg === '--prefer-result-targets') args.preferResultTargets = true;
    else if (arg === '--require-clock-at-start') args.requireClockAtStart = true;
    else if (arg === '--min-start-clock-seconds') args.minStartClockSeconds = Number(argv[++index]) || args.minStartClockSeconds;
    else if (arg === '--reject-event-pattern') args.rejectEventPattern = argv[++index];
    else if (arg === '--require-event-pattern') args.requireEventPattern = argv[++index];
    else if (arg === '--include-file-pattern') args.includeFilePattern = argv[++index];
    else if (arg === '--reject-file-pattern') args.rejectFilePattern = argv[++index];
    else if (arg === '--strict-elite') {
      args.minComplexity = 9;
      args.sourceLineLength = 10;
      args.minBothElo = 2650;
      args.preferBothElo = 2700;
      args.requireClassicalEvidence = true;
      args.preferResultTargets = true;
      args.classicalEventPattern = 'Candidates|WCh|World Championship|World Cup|Grand Swiss|Grand Prix|FIDE GP|Tata Steel|Corus A|Norway Chess|Sinquefield|London Classic|London Chess Classic|GRENKE|Dortmund|Linares|Pearl Spring|Tal Mem|Tal Memorial|Aerosvit|M-Tel|Final Masters|Grand Slam|Shamkir|Gashimov|Olympiad|European Teams|World Teams|Chennai Grand Masters|Bundesliga|US Championship|Grand Chess Tour|Superbet';
      args.rejectEventPattern = 'tcec|computer|engine|stockfish|komodo|lc0|leela|dragon|cct_|champions chess tour|speed chess|esports|rapid|blitz|bullet|online|internet|pro league|icc|chess\\.com|lichess|prelim|play-in|\\btb\\b|tiebreak|tie-break|blindfold|armageddon|banter|showdown|basque|fischer random|freestyle|frd';
    }
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--raw-dir') args.rawDir = argv[++index];
  }
  return args;
}

export function listRawPgnFiles(rawDir = RAW_DIR) {
  const files = [];
  try {
    for (const entry of readdirSync(rawDir, { withFileTypes: true })) {
      const fullPath = join(rawDir, entry.name);
      if (entry.isDirectory()) files.push(...listRawPgnFiles(fullPath));
      else if (entry.isFile() && /\.(pgn|txt)$/i.test(entry.name)) files.push(fullPath);
    }
  } catch {
    return [];
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function pieceCounts(fen) {
  const placement = String(fen || '').split(/\s+/)[0] || '';
  const counts = {
    white: { P: 0, N: 0, B: 0, R: 0, Q: 0 },
    black: { P: 0, N: 0, B: 0, R: 0, Q: 0 }
  };
  for (const char of placement.replace(/\//g, '')) {
    if (/\d/.test(char) || char.toUpperCase() === 'K') continue;
    const side = char === char.toUpperCase() ? 'white' : 'black';
    counts[side][char.toUpperCase()] += 1;
  }
  return counts;
}

function materialValue(sideCounts) {
  return Object.entries(sideCounts).reduce((total, [piece, count]) => total + PIECE_VALUES[piece] * count, 0);
}

function countPieces(counts) {
  return Object.values(counts.white).reduce((a, b) => a + b, 0)
    + Object.values(counts.black).reduce((a, b) => a + b, 0);
}

function totalMaterialValue(counts) {
  return materialValue(counts.white) + materialValue(counts.black);
}

export function isEndgameMaterial(fen) {
  const counts = pieceCounts(fen);
  const queens = counts.white.Q + counts.black.Q;
  const remainingMaterial = totalMaterialValue(counts);
  if (queens === 0) return true;
  if (queens === 1 && remainingMaterial <= 13) return true;
  if (remainingMaterial <= 13) return true;
  return false;
}

function hasPassedPawnSignal(fen) {
  const placement = String(fen || '').split(/\s+/)[0] || '';
  return /P/.test(placement) && /p/.test(placement);
}

function pawnSquares(fen) {
  const placement = String(fen || '').split(/\s+/)[0] || '';
  const pawns = { white: [], black: [] };
  let rank = 7;
  let file = 0;
  for (const char of placement) {
    if (char === '/') {
      rank -= 1;
      file = 0;
    } else if (/\d/.test(char)) {
      file += Number(char);
    } else {
      if (char === 'P') pawns.white.push({ file, rank });
      if (char === 'p') pawns.black.push({ file, rank });
      file += 1;
    }
  }
  return pawns;
}

function hasAdvancedUnopposedPawn(fen) {
  const pawns = pawnSquares(fen);
  const whiteFiles = new Set(pawns.white.map((pawn) => pawn.file));
  const blackFiles = new Set(pawns.black.map((pawn) => pawn.file));
  return pawns.white.some((pawn) => pawn.rank >= 4 && !blackFiles.has(pawn.file))
    || pawns.black.some((pawn) => pawn.rank <= 3 && !whiteFiles.has(pawn.file));
}

function hasPawnRaceSignal(fen, counts, totalPieces) {
  const pawns = counts.white.P + counts.black.P;
  return totalPieces <= 8 && pawns >= 4 && counts.white.P >= 1 && counts.black.P >= 1 && hasAdvancedUnopposedPawn(fen);
}

function bishopSquareColors(fen) {
  const placement = String(fen || '').split(/\s+/)[0] || '';
  const colors = { white: [], black: [] };
  let rank = 7;
  let file = 0;
  for (const char of placement) {
    if (char === '/') {
      rank -= 1;
      file = 0;
    } else if (/\d/.test(char)) {
      file += Number(char);
    } else {
      if (char.toUpperCase() === 'B') {
        const side = char === 'B' ? 'white' : 'black';
        colors[side].push((file + rank) % 2 === 0 ? 'dark' : 'light');
      }
      file += 1;
    }
  }
  return colors;
}

function hasOppositeColoredBishops(fen, counts) {
  if (counts.white.B !== 1 || counts.black.B !== 1) return false;
  const colors = bishopSquareColors(fen);
  return colors.white[0] && colors.black[0] && colors.white[0] !== colors.black[0];
}

export function classifyPosition(fen) {
  if (!isEndgameMaterial(fen)) {
    return {
      score: 0,
      category: 'practical-themes',
      reasons: ['not simplified enough for the endgame material gate']
    };
  }

  const counts = pieceCounts(fen);
  const totalPieces = countPieces(counts);
  const whiteValue = materialValue(counts.white);
  const blackValue = materialValue(counts.black);
  const majorPieces = counts.white.R + counts.black.R + counts.white.Q + counts.black.Q;
  const queens = counts.white.Q + counts.black.Q;
  const rooks = counts.white.R + counts.black.R;
  const minorPieces = counts.white.N + counts.black.N + counts.white.B + counts.black.B;
  const materialImbalance = Math.abs(whiteValue - blackValue);
  const pawnImbalance = Math.abs(counts.white.P - counts.black.P);

  let score = 0;
  const reasons = [];
  const categories = [];

  if (totalPieces <= 14 && totalPieces >= 5) {
    score += 1;
    reasons.push('reduced material with enough pieces for practical decisions');
  }
  if (hasOppositeColoredBishops(fen, counts)) {
    score += 2;
    reasons.push('opposite-colored bishops create initiative and fortress tension');
    categories.push('opposite-bishop-initiative');
  }
  if (materialImbalance || pawnImbalance >= 2) {
    score += Math.min(2, materialImbalance || pawnImbalance);
    reasons.push('material or pawn imbalance');
  }
  if (queens >= 1 && totalPieces <= 12) {
    score += 2;
    reasons.push('queen endgame king-safety calculation');
    categories.push(minorPieces ? 'queen-minor-endgames' : 'queen-endgames');
  }
  if (minorPieces >= 1 && rooks >= 1) {
    score += 2;
    reasons.push('rook and minor-piece coordination');
    categories.push('rook-minor-activity');
  }
  if (rooks >= 1) {
    score += 2;
    reasons.push('rook activity and counterplay potential');
    categories.push(rooks === 1 ? 'single-rook-defense' : 'rook-activity');
  }
  if (hasPawnRaceSignal(fen, counts, totalPieces)) {
    score += 2;
    reasons.push('multi-pawn race or transition calculation');
    categories.push('pawn-race-transitions');
  }
  if (totalPieces <= 8 && rooks === 0 && queens === 0 && minorPieces === 0 && (counts.white.P + counts.black.P) >= 4) {
    score += 1;
    reasons.push('king activity decides a pure-pawn conversion');
    categories.push('king-activity');
  }
  if (hasPassedPawnSignal(fen) && totalPieces <= 12) {
    score += 1;
    reasons.push('passed-pawn or pawn-race signal');
    categories.push('practical-themes');
  }
  if (totalPieces <= 5 && queens === 0 && rooks === 0) {
    score -= 3;
    reasons.push('too elementary unless embedded in richer play');
  }

  return {
    score: Math.max(0, Math.min(10, score)),
    category: categories[0] || 'practical-themes',
    reasons: [...new Set(reasons)]
  };
}

function playerQualityReason(headers) {
  const white = headers.White || 'Unknown';
  const black = headers.Black || 'Unknown';
  const event = headers.Event || 'Unknown event';
  return `${white} vs ${black}, ${event}. Manual title/rating verification required before promotion to lesson.`;
}

export function numericElo(value) {
  const match = String(value || '').match(/\d{3,4}/);
  return match ? Number(match[0]) : null;
}

function eventRejected(headers, pattern) {
  if (!pattern) return false;
  try {
    return new RegExp(pattern, 'i').test(eventText(headers));
  } catch {
    return false;
  }
}

function eventRequired(headers, pattern) {
  if (!pattern) return true;
  try {
    return new RegExp(pattern, 'i').test(eventText(headers));
  } catch {
    return true;
  }
}

function eventText(headers) {
  return [
    headers.Event,
    headers.Site,
    headers.Round,
    headers.TimeControl,
    headers.White,
    headers.Black
  ].filter(Boolean).join(' ');
}

export function classicalTimeControlEvidence(headers, options = {}) {
  const explicit = String(headers.TimeControl || '').trim();
  if (explicit) return explicit;
  const pattern = options.classicalEventPattern;
  if (!pattern) return '';
  try {
    if (new RegExp(pattern, 'i').test(eventText(headers))) {
      return 'Classical inferred from event metadata';
    }
  } catch {}
  return '';
}

function parseClockSeconds(value) {
  const text = String(value || '').trim();
  const parts = text.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts.length === 1 ? parts[0] : null;
}

function scoreFromPgnEval(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const mate = text.match(/^#(-?\d+)$/);
  if (mate) {
    const value = Number(mate[1]);
    if (!Number.isFinite(value)) return null;
    return value > 0 ? 200000 - value : -200000 - value;
  }
  const cp = Number(text);
  return Number.isFinite(cp) ? Math.round(cp * 100) : null;
}

export function extractMoveCommentEvidence(gameText) {
  const withoutHeaders = String(gameText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('['))
    .join(' ');
  const evidence = [];
  const commentsByMove = [];
  let plain = '';
  let lastIndex = 0;
  const commentRe = /\{([^}]*)\}/g;
  for (const match of withoutHeaders.matchAll(commentRe)) {
    plain += withoutHeaders.slice(lastIndex, match.index);
    commentsByMove.push({
      tokenIndex: null,
      comment: match[1],
      textBefore: plain
    });
    lastIndex = match.index + match[0].length;
  }
  plain += withoutHeaders.slice(lastIndex);

  function countMoveTokens(text) {
    return text
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
      .filter((token) => !['(', ')', '1-0', '0-1', '1/2-1/2', '*'].includes(token))
      .length;
  }

  for (const item of commentsByMove) {
    const moveIndex = countMoveTokens(item.textBefore) - 1;
    if (moveIndex < 0) continue;
    const clk = item.comment.match(/\[%clk\s+([^\]]+)\]/)?.[1] || null;
    const evalText = item.comment.match(/\[%eval\s+([^\]]+)\]/)?.[1] || null;
    if (!clk && !evalText) continue;
    if (!evidence[moveIndex]) evidence[moveIndex] = {};
    if (clk) evidence[moveIndex].clockSeconds = parseClockSeconds(clk);
    if (evalText) evidence[moveIndex].evalCp = scoreFromPgnEval(evalText);
  }
  return evidence;
}

export function clockEvidenceAtStart(replay, moveEvidence, startPly) {
  const moveIndex = Math.max(0, Number(startPly) || 0);
  const sideToMove = replay.moves[moveIndex]?.beforeFen?.split(/\s+/)[1] || 'w';
  const latest = { w: null, b: null };
  for (let index = 0; index < moveIndex; index += 1) {
    const side = index % 2 === 0 ? 'w' : 'b';
    const clock = moveEvidence[index]?.clockSeconds;
    if (Number.isFinite(clock)) latest[side] = clock;
  }
  const upcomingSide = sideToMove;
  const otherSide = upcomingSide === 'w' ? 'b' : 'w';
  const upcomingClock = latest[upcomingSide];
  const otherClock = latest[otherSide];
  return {
    w: latest.w,
    b: latest.b,
    sideToMove,
    upcomingSide,
    upcomingClockSeconds: upcomingClock,
    nonMovingSide: otherSide,
    nonMovingClockSeconds: otherClock
  };
}

function startEvalFor(moveEvidence, startPly) {
  const index = Math.max(0, Number(startPly) || 0);
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const evalCp = moveEvidence[cursor]?.evalCp;
    if (Number.isFinite(evalCp)) return evalCp;
  }
  return null;
}

export function passesEliteGate(headers, options = {}) {
  if (eventRejected(headers, options.rejectEventPattern)) return false;
  if (!eventRequired(headers, options.requireEventPattern)) return false;
  if (options.requireTimeControl && !String(headers.TimeControl || '').trim()) return false;
  if (options.requireClassicalEvidence && !classicalTimeControlEvidence(headers, options)) return false;

  const whiteElo = numericElo(headers.WhiteElo);
  const blackElo = numericElo(headers.BlackElo);
  if (options.minBothElo) {
    return Boolean(whiteElo && blackElo && whiteElo >= options.minBothElo && blackElo >= options.minBothElo);
  }

  if (!options.minAnyElo && !options.minOpponentElo) return true;
  if (!whiteElo || !blackElo) return false;

  const minAnyElo = Number(options.minAnyElo) || 0;
  const minOpponentElo = Number(options.minOpponentElo) || 0;
  return (whiteElo >= minAnyElo && blackElo >= minOpponentElo)
    || (blackElo >= minAnyElo && whiteElo >= minOpponentElo);
}

function sourceGameId(headers, file, gameIndex) {
  return [
    basename(file),
    headers.Event || 'event',
    headers.Date || 'date',
    headers.White || 'white',
    headers.Black || 'black',
    gameIndex
  ].join('|');
}

function targetPriority(candidate, result) {
  if (result === '1-0') return candidate.orientation === 'w' ? 0 : 1;
  if (result === '0-1') return candidate.orientation === 'b' ? 0 : 1;
  return 0;
}

function safeIdPart(value) {
  return String(value || 'unknown')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'unknown';
}

export function scanGame(gameText, file, gameIndex, sourceId, options = {}) {
  const maxCandidatesPerGame = Number(options.maxCandidatesPerGame) || 1;
  const sourceLineLength = Number(options.sourceLineLength) || 12;
  const minComplexity = Number(options.minComplexity) || MIN_COMPLEXITY;
  let replay;
  try {
    replay = replayPgnGame(gameText);
  } catch (error) {
    return { candidates: [], errors: [`${basename(file)} game ${gameIndex}: ${error.message}`] };
  }
  if (!passesEliteGate(replay.headers, options)) return { candidates: [], errors: [] };
  const moveEvidence = extractMoveCommentEvidence(gameText);

  const candidates = [];
  for (const [moveIndex, move] of replay.moves.entries()) {
    if (move.ply < 40) continue;
    const sourceLine = replay.moves.slice(moveIndex, moveIndex + sourceLineLength).map((lineMove) => ({
      ply: lineMove.ply,
      san: lineMove.san,
      uci: lineMove.uci,
      beforeFen: lineMove.beforeFen,
      afterFen: lineMove.afterFen
    }));
    if (sourceLine.length < sourceLineLength) continue;
    const classification = classifyPosition(move.beforeFen);
    if (classification.score < minComplexity) continue;
    const clockAtStart = clockEvidenceAtStart(replay, moveEvidence, moveIndex);
    if (options.requireClockAtStart) {
      const minimumClock = Number(options.minStartClockSeconds) || 0;
      if (!Number.isFinite(clockAtStart.w) || !Number.isFinite(clockAtStart.b)) continue;
      if (clockAtStart.w < minimumClock || clockAtStart.b < minimumClock) continue;
    }
    const startEvalCp = startEvalFor(moveEvidence, moveIndex);
    candidates.push({
      id: `candidate-${sourceId}-${safeIdPart(basename(file))}-${gameIndex}-${move.ply}`,
      category: classification.category,
      title: `${replay.headers.White || 'White'} - ${replay.headers.Black || 'Black'}: move ${move.ply}`,
      level: '候选高水平复杂残局',
      goal: `${move.beforeFen.split(/\s+/)[1] === 'w' ? '白先' : '黑先'}，判断关键残局计划`,
      fen: move.beforeFen,
      orientation: move.beforeFen.split(/\s+/)[1],
      complexityScore: classification.score,
      sourceId,
      sourceGameId: sourceGameId(replay.headers, file, gameIndex),
      startPly: move.ply - 1,
      playerQualityReason: playerQualityReason(replay.headers),
      scanReasons: classification.reasons,
      suggestedFirstMove: move.uci,
      sourceLine,
      source: {
        white: replay.headers.White || '',
        black: replay.headers.Black || '',
        event: replay.headers.Event || '',
        site: replay.headers.Site || '',
        date: replay.headers.Date || '',
        result: replay.headers.Result || '',
        whiteElo: numericElo(replay.headers.WhiteElo),
        blackElo: numericElo(replay.headers.BlackElo),
        timeControl: classicalTimeControlEvidence(replay.headers, options) || replay.headers.TimeControl || '',
        variant: replay.headers.Variant || 'Standard'
      },
      audit: {
        startClockSeconds: {
          w: clockAtStart.w,
          b: clockAtStart.b
        },
        startEvalCp,
        clockEvidenceRequired: Boolean(options.requireClockAtStart),
        minStartClockSeconds: Number(options.minStartClockSeconds) || null
      }
    });
  }

  candidates.sort((a, b) => (
    (options.preferResultTargets ? targetPriority(a, replay.headers.Result) - targetPriority(b, replay.headers.Result) : 0)
    || b.complexityScore - a.complexityScore
    || a.startPly - b.startPly
    || a.id.localeCompare(b.id)
  ));

  return { candidates: candidates.slice(0, maxCandidatesPerGame), errors: [] };
}

export function main() {
  const args = parseArgs(process.argv);
  const includeFileRe = args.includeFilePattern ? new RegExp(args.includeFilePattern, 'i') : null;
  const rejectFileRe = args.rejectFilePattern ? new RegExp(args.rejectFilePattern, 'i') : null;
  const files = listRawPgnFiles(args.rawDir).filter((file) => {
    const normalized = file.replaceAll('\\', '/');
    if (includeFileRe && !includeFileRe.test(normalized)) return false;
    if (rejectFileRe && rejectFileRe.test(normalized)) return false;
    return true;
  });
  const candidates = [];
  const errors = [];
  let gamesSeen = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const games = splitPgnGames(text);
    let fileGamesSeen = 0;
    for (const [index, game] of games.entries()) {
      if (gamesSeen >= args.maxGames) break;
      if (args.maxGamesPerFile && fileGamesSeen >= args.maxGamesPerFile) break;
      gamesSeen += 1;
      fileGamesSeen += 1;
      const result = scanGame(game, file, index + 1, args.sourceId, {
        maxCandidatesPerGame: args.maxCandidatesPerGame,
        minComplexity: args.minComplexity,
        sourceLineLength: args.sourceLineLength,
        minAnyElo: args.minAnyElo,
        minOpponentElo: args.minOpponentElo,
        minBothElo: args.minBothElo,
        preferBothElo: args.preferBothElo,
        requireTimeControl: args.requireTimeControl,
        requireClassicalEvidence: args.requireClassicalEvidence,
        classicalEventPattern: args.classicalEventPattern,
        preferResultTargets: args.preferResultTargets,
        requireClockAtStart: args.requireClockAtStart,
        minStartClockSeconds: args.minStartClockSeconds,
        rejectEventPattern: args.rejectEventPattern,
        requireEventPattern: args.requireEventPattern
      });
      candidates.push(...result.candidates);
      errors.push(...result.errors);
    }
    if (gamesSeen >= args.maxGames) break;
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const output = args.output || join(REPORT_DIR, `candidate-scan-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(output, JSON.stringify({
    generatedAt: new Date().toISOString(),
    rawDir: args.rawDir,
    filters: {
      minComplexity: args.minComplexity,
      sourceLineLength: args.sourceLineLength,
      minAnyElo: args.minAnyElo,
      minOpponentElo: args.minOpponentElo,
      minBothElo: args.minBothElo,
      preferBothElo: args.preferBothElo,
      requireTimeControl: args.requireTimeControl,
      requireClassicalEvidence: args.requireClassicalEvidence,
      classicalEventPattern: args.classicalEventPattern,
      preferResultTargets: args.preferResultTargets,
      requireClockAtStart: args.requireClockAtStart,
      minStartClockSeconds: args.minStartClockSeconds,
      rejectEventPattern: args.rejectEventPattern,
      requireEventPattern: args.requireEventPattern,
      includeFilePattern: args.includeFilePattern,
      rejectFilePattern: args.rejectFilePattern
    },
    gamesSeen,
    candidateCount: candidates.length,
    candidates,
    errors
  }, null, 2));

  console.log(`Scanned ${gamesSeen} games from ${files.length} files.`);
  console.log(`Wrote ${candidates.length} raw candidate positions to ${output}.`);
  if (errors.length) console.log(`Replay errors: ${errors.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
