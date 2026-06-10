import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { playLegalUciMove } from '../../app.js';
import { getEndgameCategories, listEndgameLessons } from '../../endgames.js';

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, 'data', 'endgame-expansion', 'drafts');
const CANDIDATE_DIR = join(ROOT, 'data', 'endgame-expansion', 'candidates');

function positionKey(fen) {
  return String(fen || '').trim().split(/\s+/).slice(0, 4).join(' ');
}

function containsTodo(value) {
  return JSON.stringify(value || '').includes('TODO_ORIGINAL');
}

function hasText(value, minLength = 1) {
  return typeof value === 'string' && value.trim().length >= minLength;
}

function sourceMetadataGaps(item) {
  const source = item.source || {};
  if (source.needsStructuredMetadata) return [];
  const required = ['white', 'black', 'event', 'date'];
  return required.filter((field) => !hasText(source[field]));
}

function teachingGaps(item) {
  const teaching = item.teaching || {};
  const gaps = [];
  if (!hasText(teaching.principle, 35)) gaps.push('principle');
  if (!hasText(teaching.method, 60)) gaps.push('method');
  if (!hasText(teaching.mistake, 35)) gaps.push('mistake');
  if (!Array.isArray(item.hints) || item.hints.length < 2) gaps.push('hints');
  if (!Array.isArray(item.steps) || item.steps.length < 1) gaps.push('steps');
  if (containsTodo(item)) gaps.push('todo-placeholder');
  return gaps;
}

function normalizeReadyItem(item, kind) {
  return {
    ...item,
    auditKind: kind,
    auditId: item.id || '<missing-id>',
    startKey: positionKey(item.fen),
    firstMove: item.steps?.[0]?.move || ''
  };
}

function replayLine(item, errors) {
  let fen = item.fen;
  const continuationKeys = [];

  if (!hasText(fen, 10)) {
    errors.push(`${item.auditId} missing fen`);
    return continuationKeys;
  }

  for (const [index, step] of (item.steps || []).entries()) {
    try {
      if (!hasText(step?.move)) throw new Error('missing move');
      const played = playLegalUciMove(fen, step.move);
      fen = played.nextFen;
      continuationKeys.push(positionKey(fen));
      if (step.reply) {
        const replied = playLegalUciMove(fen, step.reply);
        fen = replied.nextFen;
        continuationKeys.push(positionKey(fen));
      }
    } catch (error) {
      errors.push(`${item.auditId} illegal step ${index}: ${error.message}`);
      break;
    }
  }

  return continuationKeys;
}

function countDraftStatuses(drafts) {
  const analyzed = [];
  let rejectedDrafts = 0;
  let todoDrafts = 0;

  for (const draft of drafts) {
    if (draft.importStatus === 'analysis-draft') analyzed.push(draft);
    else if (draft.importStatus === 'rejected-strict-standard') rejectedDrafts += 1;
    else todoDrafts += 1;
  }

  return { analyzed, rejectedDrafts, todoDrafts };
}

function candidateSourceIds(candidateLessons) {
  return new Set(
    candidateLessons
      .map((lesson) => lesson.sourceCandidateId || lesson.id)
      .filter(Boolean)
  );
}

export function auditCourseTarget({
  siteLessons = [],
  siteCategories = [],
  drafts = [],
  candidates = [],
  targetCount = 300,
  maxCategories = 12
} = {}) {
  const errors = [];
  const metadataGaps = [];
  const textGaps = [];
  const siteSourceIds = new Set(
    siteLessons
      .map((lesson) => lesson.sourceCandidateId || lesson.id)
      .filter(Boolean)
  );
  const candidateLessons = candidates
    .filter((entry) => Array.isArray(entry) || entry.importReady === true)
    .flatMap((entry) => entry.lessons || entry)
    .filter((lesson) => !siteSourceIds.has(lesson.sourceCandidateId || lesson.id));
  const promotedIds = new Set([...siteSourceIds, ...candidateSourceIds(candidateLessons)]);
  const rawDraftStatus = countDraftStatuses(drafts);
  const analyzedDrafts = rawDraftStatus.analyzed.filter((draft) => !promotedIds.has(draft.sourceCandidateId || draft.id));
  const rejectedDrafts = rawDraftStatus.rejectedDrafts;
  const todoDrafts = rawDraftStatus.todoDrafts;
  const readyItems = [
    ...siteLessons.map((lesson) => normalizeReadyItem(lesson, 'site')),
    ...candidateLessons.map((lesson) => normalizeReadyItem(lesson, 'candidate'))
  ];

  const ids = new Set();
  const startTasks = new Set();
  const continuationOwners = new Map();
  const categorySet = new Set(siteCategories.map((category) => category.id).filter(Boolean));
  const byCategory = {};

  for (const item of readyItems) {
    categorySet.add(item.category);
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;

    if (ids.has(item.auditId)) errors.push(`duplicate id ${item.auditId}`);
    ids.add(item.auditId);

    const startTask = `${item.startKey}|${item.firstMove}`;
    if (item.firstMove) {
      if (startTasks.has(startTask)) errors.push(`duplicate start task ${startTask}`);
      startTasks.add(startTask);
    }

    if (item.orientation && item.fen && item.orientation !== String(item.fen).split(/\s+/)[1]) {
      errors.push(`${item.auditId} orientation must match FEN side to move`);
    }

    const sourceGaps = sourceMetadataGaps(item);
    if (sourceGaps.length) metadataGaps.push({ id: item.auditId, fields: sourceGaps });

    const gaps = teachingGaps(item);
    if (gaps.length) textGaps.push({ id: item.auditId, fields: gaps });

    for (const key of replayLine(item, errors)) {
      const owners = continuationOwners.get(key) || new Set();
      owners.add(item.auditId);
      continuationOwners.set(key, owners);
    }
  }

  for (const item of readyItems) {
    const owners = continuationOwners.get(item.startKey);
    if (!owners) continue;
    for (const owner of owners) {
      if (owner !== item.auditId) errors.push(`${item.auditId} starts inside ${owner} main line`);
    }
  }

  if (categorySet.size > maxCategories) {
    errors.push(`category count ${categorySet.size} exceeds ${maxCategories}`);
  }

  for (const gap of metadataGaps) {
    errors.push(`${gap.id} missing structured source metadata: ${gap.fields.join(', ')}`);
  }

  for (const gap of textGaps) {
    errors.push(`${gap.id} incomplete original analysis fields: ${gap.fields.join(', ')}`);
  }

  const totalReady = siteLessons.length + candidateLessons.length;
  return {
    valid: errors.length === 0,
    counts: {
      siteLessons: siteLessons.length,
      analyzedDrafts: analyzedDrafts.length,
      candidateLessons: candidateLessons.length,
      rejectedDrafts,
      todoDrafts,
      totalReady,
      targetCount,
      remainingToTarget: Math.max(0, targetCount - totalReady),
      categoryCount: categorySet.size
    },
    byCategory: Object.fromEntries(Object.entries(byCategory).sort((a, b) => a[0].localeCompare(b[0]))),
    metadataGaps,
    textGaps,
    errors
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function readDraftFiles(path = DRAFT_DIR) {
  try {
    const stat = statSync(path);
    if (stat.isFile()) return readJson(path).drafts || [];
    return readdirSync(path)
      .filter((name) => /^draft-batch-.+\.json$/i.test(name))
      .flatMap((name) => readJson(join(path, name)).drafts || []);
  } catch {
    return [];
  }
}

function readCandidateFiles(path = CANDIDATE_DIR) {
  try {
    return readdirSync(path)
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJson(join(path, name)));
  } catch {
    return [];
  }
}

export function main() {
  const result = auditCourseTarget({
    siteLessons: listEndgameLessons(),
    siteCategories: getEndgameCategories(),
    drafts: readDraftFiles(),
    candidates: readCandidateFiles()
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
