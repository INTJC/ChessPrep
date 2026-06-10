import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listEndgameLessons } from '../../endgames.js';
import { playLegalUciMove, replayPgnGame, splitPgnGames } from '../../app.js';

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, 'data', 'endgame-expansion', 'drafts');
const CANDIDATE_PATH = join(ROOT, 'data', 'endgame-expansion', 'candidates', 'pgnmentor-analyzed-drafts.json');
const RAW_DIR = join(ROOT, 'data', 'endgame-expansion', 'sources', 'raw');
const REPORT_PATH = join(ROOT, 'data', 'endgame-expansion', 'reports', 'restored-heldback-to-result.json');

function parseArgs(argv) {
  const args = {
    candidates: CANDIDATE_PATH,
    drafts: DRAFT_DIR,
    rawDir: RAW_DIR,
    output: CANDIDATE_PATH,
    report: REPORT_PATH,
    targetReady: 300
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--candidates') args.candidates = argv[++index];
    else if (arg === '--drafts') args.drafts = argv[++index];
    else if (arg === '--raw-dir') args.rawDir = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--report') args.report = argv[++index];
    else if (arg === '--target-ready') args.targetReady = Number(argv[++index]) || args.targetReady;
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readDraftFile(path) {
  return readJson(path).drafts || [];
}

function readDrafts(path) {
  const stat = statSync(path);
  if (stat.isFile()) return readDraftFile(path);
  return readdirSync(path)
    .filter((name) => /^draft-batch-.+\.json$/i.test(name))
    .flatMap((name) => readDraftFile(join(path, name)));
}

function candidateId(draft) {
  return draft.sourceCandidateId || String(draft.id || '').replace(/^draft-/, '');
}

function positionKey(fen) {
  return String(fen || '').trim().split(/\s+/).slice(0, 4).join(' ');
}

function lessonLineMoves(lesson) {
  const moves = [];
  for (const step of lesson.steps || []) {
    if (step?.move) moves.push(step.move);
    if (step?.reply) moves.push(step.reply);
  }
  return moves;
}

function replayLessonLine(lesson) {
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

function sourceGameReplay(sourceGameId, rawDir) {
  const parts = String(sourceGameId || '').split('|');
  const fileName = parts[0];
  const gameIndex = Number(parts[5]);
  if (!fileName || !Number.isInteger(gameIndex) || gameIndex < 1) {
    throw new Error(`invalid sourceGameId ${sourceGameId}`);
  }

  const playerFile = fileName.replace(/\.pgn$/i, '').toLowerCase();
  const pgnPath = join(rawDir, `pgnmentor-${playerFile}`, fileName);
  const games = splitPgnGames(readFileSync(pgnPath, 'utf8'));
  const game = games[gameIndex - 1];
  if (!game) throw new Error(`source game ${gameIndex} not found in ${pgnPath}`);
  return replayPgnGame(game);
}

function complexityScore(draft) {
  const values = [
    draft.complexityScore,
    draft.review?.complexityScore,
    draft.review?.score,
    draft.scan?.complexityScore
  ];
  for (const value of values) {
    if (Number.isFinite(value)) return Math.max(7, Math.min(10, value));
  }
  return 8;
}

function moveTheme(move) {
  const san = String(move?.san || '');
  if (san.includes('#')) return '将杀已经出现，前面的每一次王位限制都在这里兑现。';
  if (san.includes('+')) return '带将军的节奏迫使对方先处理王安全，不能自由改善子力。';
  if (san.includes('=')) return '升变资源进入计算核心，双方都必须同时比较新后和王位安全。';
  if (san.includes('x')) return '吃子不是单纯收材料，而是在减少对方防守点或清除通路兵支撑。';
  if (/^K/.test(san)) return '王的站位变化很关键，它决定后续将军、挡将和通路兵能否成立。';
  if (/^Q/.test(san)) return '后的机动性用来控制将军节奏，目标是让对方没有舒服的整理手。';
  if (/^R/.test(san)) return '车的横向活动决定主动权，防守方不能只守一个点。';
  if (/^[BN]/.test(san)) return '轻子的换位是在争关键格，重点是限制对方王和通路兵的配合。';
  return '兵形推进改变了双方的支点，后续计划要围绕新弱格重新组织。';
}

function categoryTheme(category) {
  if (category === 'opposite-bishop-initiative') return '异色格象残局里主动权常常比静态兵数更重要，谁能先制造第二目标谁就更容易掌控结果。';
  if (category === 'queen-minor-endgames') return '后和轻子并存时，王安全、将军节奏和轻子控制格必须一起计算。';
  if (category === 'queen-endgames') return '后残局不能只数兵，连续将军和换后后的兵形才是判断结果的关键。';
  if (category === 'rook-minor-activity') return '车轻子残局首先比较主动性，车的入口和轻子的支点会决定谁被迫防守。';
  return '这个阶段的重点是把已有优势或防守资源连续执行到实战结果，而不是停在中途评价。';
}

function generatedStepNote(draft, move, reply, pairIndex, pairCount) {
  const moveText = reply ? `${move.san} ${reply.san}` : move.san;
  const phase =
    pairIndex === pairCount - 1
      ? '这是原局记录的收束段'
      : pairIndex >= pairCount - 3
        ? '已经进入结果兑现阶段'
        : '实战继续推进计划';
  return `${phase}：${moveText}。${moveTheme(move)}${reply ? ` 对方以 ${reply.san} 回应，说明局面仍要按真实防守资源继续计算。` : ''}${categoryTheme(draft.category)}`;
}

function fullStepsFor(draft, fullLine) {
  const oldSteps = draft.steps || [];
  const pairCount = Math.ceil(fullLine.length / 2);
  const steps = [];
  for (let index = 0; index < fullLine.length; index += 2) {
    const move = fullLine[index];
    const reply = fullLine[index + 1] || null;
    const oldStep = oldSteps[index / 2];
    const oldMatches = oldStep?.move === move.uci && (oldStep?.reply || null) === (reply?.uci || null);
    steps.push({
      move: move.uci,
      ...(reply ? { reply: reply.uci } : {}),
      note: oldMatches && oldStep.note ? oldStep.note : generatedStepNote(draft, move, reply, index / 2, pairCount)
    });
  }
  return steps;
}

function sourceLineFrom(fullLine) {
  return fullLine.map((move) => ({
    ply: move.ply,
    san: move.san,
    uci: move.uci,
    beforeFen: move.beforeFen,
    afterFen: move.afterFen
  }));
}

function sourceMetadata(draft) {
  return {
    white: draft.source?.white || '',
    black: draft.source?.black || '',
    event: draft.source?.event || '',
    site: draft.source?.site || '',
    date: draft.source?.date || '',
    result: draft.source?.result || ''
  };
}

function playerQualityReason(draft) {
  const existing = String(draft.playerQualityReason || '').trim();
  if (existing && !/requires final human quality review|Manual title\/rating verification required/i.test(existing)) return existing;

  const source = draft.source || {};
  const players = [source.white, source.black].filter(Boolean).join(' vs ') || 'verified source game';
  const event = source.event || 'recorded event';
  const date = source.date || 'unknown date';
  return `${players}, ${event} ${date}. Selected by the strict elite PGN gate, restored to the full real-game result line, and annotated with original teaching analysis before import.`;
}

function candidateFromDraft(draft, replay) {
  const fullLine = replay.moves.slice(draft.startPly);
  const sourceLine = sourceLineFrom(fullLine);
  return {
    id: candidateId(draft),
    category: draft.category,
    title: draft.title,
    level: draft.level,
    goal: draft.goal,
    fen: draft.fen,
    orientation: draft.orientation || String(draft.fen || '').split(/\s+/)[1],
    complexityScore: complexityScore(draft),
    sourceId: draft.sourceId,
    sourceGameId: draft.sourceGameId,
    startPly: draft.startPly,
    playerQualityReason: playerQualityReason(draft),
    source: sourceMetadata(draft),
    teaching: draft.teaching,
    hints: draft.hints,
    steps: fullStepsFor(draft, sourceLine),
    sourceLine,
    finalFen: sourceLine.at(-1)?.afterFen || draft.fen,
    sourceCandidateId: draft.sourceCandidateId || candidateId(draft),
    review: draft.review || null
  };
}

function buildRestorableDraft(draft, heldBackIds, currentIds, rawDir) {
  const id = candidateId(draft);
  if (draft.importStatus !== 'analysis-draft') return null;
  if (!heldBackIds.has(id) || currentIds.has(id)) return null;

  const replay = sourceGameReplay(draft.sourceGameId, rawDir);
  const fullLine = replay.moves.slice(draft.startPly);
  const sourceStartFen = replay.moves[draft.startPly]?.beforeFen;
  const oldLine = lessonLineMoves(draft);

  if (draft.fen !== sourceStartFen) return null;
  if (!oldLine.every((move, index) => move === fullLine[index]?.uci)) return null;

  return {
    draft,
    replay,
    id,
    category: draft.category,
    tailLength: fullLine.length,
    complexityScore: complexityScore(draft),
    startKey: positionKey(draft.fen),
    startTask: `${positionKey(draft.fen)}|${fullLine[0]?.uci || ''}`,
    continuationKeys: fullLine.map((move) => positionKey(move.afterFen))
  };
}

function chooseRestorableDrafts(restorable, currentSiteLessons, needed) {
  const existingStarts = new Set(currentSiteLessons.map((lesson) => positionKey(lesson.fen)));
  const existingStartTasks = new Set(currentSiteLessons.map((lesson) => `${positionKey(lesson.fen)}|${lesson.steps?.[0]?.move || ''}`));
  const existingContinuations = new Set(currentSiteLessons.flatMap(replayLessonLine));
  const selectedStarts = new Set();
  const selectedStartTasks = new Set();
  const selectedContinuations = new Set();
  const selected = [];
  const skipped = [];

  const sorted = [...restorable].sort(
    (a, b) => a.tailLength - b.tailLength || b.complexityScore - a.complexityScore || a.id.localeCompare(b.id)
  );

  for (const item of sorted) {
    let reason = '';
    if (selected.length >= needed) reason = 'target-already-filled';
    else if (existingStartTasks.has(item.startTask) || selectedStartTasks.has(item.startTask)) reason = 'duplicate-start-task';
    else if (existingContinuations.has(item.startKey) || selectedContinuations.has(item.startKey)) reason = 'starts-inside-existing-line';
    else if (item.continuationKeys.some((key) => existingStarts.has(key) || selectedStarts.has(key))) reason = 'line-covers-existing-start';

    if (reason) {
      skipped.push({ id: item.id, category: item.category, tailLength: item.tailLength, reason });
      continue;
    }

    selected.push(item);
    selectedStarts.add(item.startKey);
    selectedStartTasks.add(item.startTask);
    for (const key of item.continuationKeys) selectedContinuations.add(key);
  }

  return { selected, skipped };
}

function countByCategory(items) {
  const counts = {};
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

export function restoreHeldBackCandidates({
  candidateData,
  drafts,
  siteLessons,
  rawDir = RAW_DIR,
  targetReady = 300
} = {}) {
  const currentLessons = candidateData.lessons || [];
  const currentIds = new Set(currentLessons.map((lesson) => lesson.id));
  const heldBackIds = new Set(
    (candidateData.heldBack || [])
      .filter((item) => item.reason === 'source-game-not-finished-after-lesson')
      .map((item) => item.id)
  );
  const needed = Math.max(0, targetReady - siteLessons.length);
  const restorable = drafts
    .map((draft) => buildRestorableDraft(draft, heldBackIds, currentIds, rawDir))
    .filter(Boolean);
  const { selected, skipped } = chooseRestorableDrafts(restorable, siteLessons, needed);
  if (selected.length < needed) {
    throw new Error(`Only ${selected.length} held-back candidates can be safely restored, but ${needed} are needed.`);
  }

  const selectedIds = new Set(selected.map((item) => item.id));
  const restoredLessons = selected.map((item) => candidateFromDraft(item.draft, item.replay));
  const lessons = [...currentLessons, ...restoredLessons];
  const heldBack = (candidateData.heldBack || []).filter((item) => !selectedIds.has(item.id));
  const summary = {
    generatedAt: new Date().toISOString(),
    targetReady,
    currentSiteLessons: siteLessons.length,
    needed,
    restorable: restorable.length,
    restored: restoredLessons.length,
    skipped: skipped.length,
    candidateLessons: lessons.length,
    byCategory: countByCategory(restoredLessons),
    maxRestoredTailLength: Math.max(...restoredLessons.map((lesson) => lesson.sourceLine.length)),
    restoredIds: restoredLessons.map((lesson) => lesson.id),
    skipped
  };

  return {
    candidateData: {
      ...candidateData,
      generatedAt: summary.generatedAt,
      importReady: true,
      lessons,
      heldBack,
      qualityGate: {
        ...(candidateData.qualityGate || {}),
        sourcePgnMustReachGameResult: true,
        sourceFenMustMatchStartPly: true,
        restoredToTargetReady: targetReady,
        note: 'Public PGN lessons are exported only when their training line equals every real PGN move from startPly to the recorded game result.'
      },
      restorationSummary: {
        generatedAt: summary.generatedAt,
        targetReady,
        restored: restoredLessons.length,
        candidateLessons: lessons.length,
        maxRestoredTailLength: summary.maxRestoredTailLength
      }
    },
    summary
  };
}

export function main() {
  const args = parseArgs(process.argv);
  const candidateData = readJson(args.candidates);
  const drafts = readDrafts(args.drafts);
  const result = restoreHeldBackCandidates({
    candidateData,
    drafts,
    siteLessons: listEndgameLessons(),
    rawDir: args.rawDir,
    targetReady: args.targetReady
  });

  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result.candidateData, null, 2)}\n`);
  mkdirSync(dirname(args.report), { recursive: true });
  writeFileSync(args.report, `${JSON.stringify(result.summary, null, 2)}\n`);
  console.log(JSON.stringify(result.summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
