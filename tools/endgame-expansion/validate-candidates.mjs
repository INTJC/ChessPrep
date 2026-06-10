import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { playLegalUciMove, replayPgnGame, splitPgnGames } from '../../app.js';

const ROOT = process.cwd();
const CANDIDATE_DIR = join(ROOT, 'data', 'endgame-expansion', 'candidates');
const SOURCE_REGISTRY = join(ROOT, 'data', 'endgame-expansion', 'sources', 'source-registry.json');
const RAW_SOURCE_DIR = join(ROOT, 'data', 'endgame-expansion', 'sources', 'raw');
const MAX_CATEGORIES = 12;
const MIN_COMPLEXITY = 7;
const MIN_BOTH_ELO = 2650;
const MIN_ENGINE_DEPTH = 12;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listCandidateFiles() {
  try {
    return readdirSync(CANDIDATE_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => join(CANDIDATE_DIR, name));
  } catch {
    return [];
  }
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function requiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function positionKey(fen) {
  return String(fen).trim().split(/\s+/).slice(0, 4).join(' ');
}

function lessonLineMoves(lesson) {
  const moves = [];
  for (const step of lesson.steps || []) {
    if (step?.move) moves.push(step.move);
    if (step?.reply) moves.push(step.reply);
  }
  return moves;
}

function sourceGameReplay(lesson, rawDir) {
  const parts = String(lesson.sourceGameId || '').split('|');
  const fileName = parts[0];
  const gameIndex = Number(parts[5]);
  if (!fileName || !Number.isInteger(gameIndex) || gameIndex < 1) {
    throw new Error(`invalid sourceGameId ${lesson.sourceGameId}`);
  }

  const playerFile = fileName.replace(/\.pgn$/i, '').toLowerCase();
  const pgnPath = /^lichess_db_broadcast_/i.test(fileName)
    ? join(rawDir, 'lichess-broadcast-db', fileName)
    : join(rawDir, `pgnmentor-${playerFile}`, fileName);
  const games = splitPgnGames(readFileSync(pgnPath, 'utf8'));
  const game = games[gameIndex - 1];
  if (!game) throw new Error(`source game ${gameIndex} not found in ${pgnPath}`);
  return replayPgnGame(game);
}

function validateSourceLine(lesson, prefix, errors, rawDir) {
  if (!['pgnmentor-files', 'lichess-broadcast-db'].includes(lesson.sourceId)) return;

  const lessonLine = lessonLineMoves(lesson);
  const sourceLine = Array.isArray(lesson.sourceLine) ? lesson.sourceLine.map((move) => move?.uci) : [];
  assert(sourceLine.length > 0, `${prefix} missing sourceLine for public PGN candidate`, errors);
  assert(
    lessonLine.length === sourceLine.length && lessonLine.every((move, index) => move === sourceLine[index]),
    `${prefix} lesson line must match sourceLine exactly`,
    errors
  );

  try {
    const replay = sourceGameReplay(lesson, rawDir);
    const sourceStartFen = replay.moves[lesson.startPly]?.beforeFen;
    const fullSourceLine = replay.moves.slice(lesson.startPly).map((move) => move.uci);
    assert(lesson.fen === sourceStartFen, `${prefix} FEN must match source PGN start position`, errors);
    assert(
      lessonLine.length === fullSourceLine.length && lessonLine.every((move, index) => move === fullSourceLine[index]),
      `${prefix} must continue to source PGN result`,
      errors
    );
  } catch (error) {
    errors.push(`${prefix} source PGN replay failed: ${error.message}`);
  }
}

function validateEliteEvidence(lesson, prefix, errors) {
  assert(Number.isInteger(lesson.source?.whiteElo), `${prefix} missing WhiteElo evidence`, errors);
  assert(Number.isInteger(lesson.source?.blackElo), `${prefix} missing BlackElo evidence`, errors);
  assert(lesson.source?.whiteElo >= MIN_BOTH_ELO, `${prefix} WhiteElo must be >= ${MIN_BOTH_ELO}`, errors);
  assert(lesson.source?.blackElo >= MIN_BOTH_ELO, `${prefix} BlackElo must be >= ${MIN_BOTH_ELO}`, errors);
  assert(requiredString(lesson.source?.timeControl), `${prefix} missing classical timeControl evidence`, errors);
  assert((lesson.source?.variant || 'Standard') === 'Standard', `${prefix} variant must be Standard`, errors);
  assert(Number.isFinite(lesson.audit?.startEvalCp), `${prefix} missing startEvalCp evidence`, errors);
  assert(Number.isInteger(lesson.audit?.engineDepth) && lesson.audit.engineDepth >= MIN_ENGINE_DEPTH, `${prefix} engineDepth must be >= ${MIN_ENGINE_DEPTH}`, errors);
  assert(lesson.audit?.manualGmReviewStatus === 'not-verified-locally', `${prefix} must not claim unverified GM review`, errors);
  assert(lesson.audit?.deepLineVerificationStatus === 'not-verified-locally', `${prefix} must not claim unverified deep line review`, errors);
}

function validateLesson(lesson, file, sourceIds, errors, seen, rawDir) {
  const prefix = `${file}:${lesson?.id || '<missing-id>'}`;

  assert(requiredString(lesson.id), `${prefix} missing id`, errors);
  assert(requiredString(lesson.category), `${prefix} missing category`, errors);
  assert(requiredString(lesson.title), `${prefix} missing title`, errors);
  assert(requiredString(lesson.level), `${prefix} missing level`, errors);
  assert(requiredString(lesson.goal), `${prefix} missing goal`, errors);
  assert(requiredString(lesson.fen), `${prefix} missing fen`, errors);
  assert(['w', 'b'].includes(lesson.orientation), `${prefix} invalid orientation`, errors);
  assert(lesson.orientation === String(lesson.fen || '').split(/\s+/)[1], `${prefix} orientation must match FEN side to move`, errors);
  assert(Number.isFinite(lesson.complexityScore) && lesson.complexityScore >= MIN_COMPLEXITY, `${prefix} complexityScore must be >= ${MIN_COMPLEXITY}`, errors);

  assert(requiredString(lesson.sourceId), `${prefix} missing sourceId`, errors);
  assert(sourceIds.has(lesson.sourceId), `${prefix} sourceId is not in source registry`, errors);
  assert(requiredString(lesson.sourceGameId), `${prefix} missing sourceGameId`, errors);
  assert(Number.isInteger(lesson.startPly) && lesson.startPly >= 0, `${prefix} invalid startPly`, errors);
  assert(requiredString(lesson.playerQualityReason), `${prefix} missing playerQualityReason`, errors);

  const teaching = lesson.teaching || {};
  assert(requiredString(teaching.principle) && teaching.principle.length >= 35, `${prefix} principle too short`, errors);
  assert(requiredString(teaching.method) && teaching.method.length >= 60, `${prefix} method too short`, errors);
  assert(requiredString(teaching.mistake) && teaching.mistake.length >= 35, `${prefix} mistake too short`, errors);
  assert(Array.isArray(lesson.hints) && lesson.hints.length >= 2, `${prefix} needs at least two hints`, errors);
  assert(Array.isArray(lesson.steps) && lesson.steps.length > 0, `${prefix} needs steps`, errors);

  if (seen.ids.has(lesson.id)) errors.push(`${prefix} duplicate id`);
  seen.ids.add(lesson.id);

  const sourceKey = `${lesson.sourceId}|${lesson.sourceGameId}|${lesson.startPly}`;
  if (seen.sourceKeys.has(sourceKey)) errors.push(`${prefix} duplicate source game/startPly`);
  seen.sourceKeys.add(sourceKey);

  const startTaskKey = `${positionKey(lesson.fen)}|${lesson.steps?.[0]?.move}`;
  if (seen.startTasks.has(startTaskKey)) errors.push(`${prefix} duplicate start position and first move`);
  seen.startTasks.add(startTaskKey);

  validateSourceLine(lesson, prefix, errors, rawDir);
  validateEliteEvidence(lesson, prefix, errors);

  let fen = lesson.fen;
  for (const [index, step] of (lesson.steps || []).entries()) {
    assert(requiredString(step.move), `${prefix} step ${index} missing move`, errors);
    try {
      const user = playLegalUciMove(fen, step.move);
      fen = user.nextFen;
      const continuationKey = positionKey(fen);
      if (seen.startPositions.has(continuationKey)) {
        errors.push(`${prefix} continuation position starts another lesson`);
      }
      if (step.reply) {
        const reply = playLegalUciMove(fen, step.reply);
        fen = reply.nextFen;
      }
    } catch (error) {
      errors.push(`${prefix} illegal step ${index}: ${error.message}`);
      break;
    }
  }

  lesson.finalFen = lesson.finalFen || fen;
}

export function validateCandidateData({ candidateFiles = [], sourceIds = new Set(), rawDir = RAW_SOURCE_DIR } = {}) {
  const publishableCandidateFiles = candidateFiles
    .map(({ file, data }) => ({
      file,
      data: Array.isArray(data) || data.importReady === true ? data : { ...data, lessons: [] }
    }));
  const errors = [];
  const categories = new Set();
  const seen = {
    ids: new Set(),
    sourceKeys: new Set(),
    startTasks: new Set(),
    startPositions: new Set()
  };

  for (const { data } of publishableCandidateFiles) {
    for (const lesson of data.lessons || []) {
      seen.startPositions.add(positionKey(lesson.fen));
    }
  }

  for (const { file, data } of publishableCandidateFiles) {
    assert(Array.isArray(data.lessons), `${file} must contain lessons[]`, errors);
    for (const lesson of data.lessons || []) {
      categories.add(lesson.category);
      validateLesson(lesson, file, sourceIds, errors, seen, rawDir);
    }
  }

  assert(categories.size <= MAX_CATEGORIES, `candidate categories exceed ${MAX_CATEGORIES}: ${categories.size}`, errors);

  return {
    valid: errors.length === 0,
    errors,
    lessonCount: seen.ids.size,
    categoryCount: categories.size
  };
}

function main() {
  const registry = readJson(SOURCE_REGISTRY);
  const sourceIds = new Set(registry.sources.map((source) => source.sourceId));
  const files = listCandidateFiles();
  const result = validateCandidateData({
    candidateFiles: files.map((file) => ({ file, data: readJson(file) })),
    sourceIds
  });

  if (!result.valid) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }

  console.log(`Validated ${result.lessonCount} candidate lessons across ${result.categoryCount} categories.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
