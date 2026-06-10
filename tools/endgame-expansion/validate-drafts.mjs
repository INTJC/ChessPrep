import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { playLegalUciMove } from '../../app.js';

const MIN_LENGTHS = {
  principle: 35,
  method: 60,
  mistake: 35
};

function containsTodo(value) {
  return JSON.stringify(value || '').includes('TODO_ORIGINAL');
}

function hasText(value, minLength) {
  return typeof value === 'string' && value.trim().length >= minLength;
}

function positionKey(fen) {
  return String(fen || '').trim().split(/\s+/).slice(0, 4).join(' ');
}

function lessonLineMoves(steps) {
  const moves = [];
  for (const step of steps || []) {
    if (step?.move) moves.push(step.move);
    if (step?.reply) moves.push(step.reply);
  }
  return moves;
}

function sourceLineMoves(sourceLine) {
  return (sourceLine || []).map((move) => move.uci).filter(Boolean);
}

function validateSourceLine(draft, errors) {
  if (!Array.isArray(draft.sourceLine) || draft.sourceLine.length === 0) return;
  const expected = sourceLineMoves(draft.sourceLine);
  const actual = lessonLineMoves(draft.steps);
  const matches = expected.length === actual.length && expected.every((move, index) => move === actual[index]);
  if (!matches) errors.push(`${draft.id} lesson line must match sourceLine`);
}

function validateLine(draft, errors) {
  let fen = draft.fen;
  const continuationKeys = [];
  if (!hasText(fen, 10)) {
    errors.push(`${draft.id} missing fen`);
    return continuationKeys;
  }

  for (const [index, step] of (draft.steps || []).entries()) {
    try {
      if (!step?.move) throw new Error('missing move');
      const played = playLegalUciMove(fen, step.move);
      fen = played.nextFen;
      continuationKeys.push(positionKey(fen));
      if (step.reply) {
        const replied = playLegalUciMove(fen, step.reply);
        fen = replied.nextFen;
        continuationKeys.push(positionKey(fen));
      }
    } catch (error) {
      errors.push(`${draft.id} illegal step ${index}: ${error.message}`);
      break;
    }
  }
  return continuationKeys;
}

export function validateDraftLessons(draftData) {
  const drafts = draftData.drafts || [];
  const errors = [];
  let checked = 0;
  let todo = 0;
  let rejected = 0;
  const analyzed = [];
  const continuationOwners = new Map();

  for (const draft of drafts) {
    if (draft.importStatus === 'rejected-strict-standard') {
      rejected += 1;
      continue;
    }
    if (draft.importStatus !== 'analysis-draft') {
      todo += 1;
      continue;
    }

    checked += 1;
    const id = draft.id || '<missing-id>';
    analyzed.push({ id, startKey: positionKey(draft.fen) });
    const teaching = draft.teaching || {};

    if (containsTodo(draft)) errors.push(`${id} contains TODO placeholder`);
    for (const [field, minLength] of Object.entries(MIN_LENGTHS)) {
      if (!hasText(teaching[field], minLength)) errors.push(`${id} ${field} too short`);
    }
    if (!Array.isArray(draft.hints) || draft.hints.length < 2) errors.push(`${id} needs at least two hints`);
    if (!Array.isArray(draft.steps) || draft.steps.length < 1) {
      errors.push(`${id} needs at least one step`);
    } else {
      validateSourceLine({ ...draft, id }, errors);
      for (const key of validateLine({ ...draft, id }, errors)) {
        const owners = continuationOwners.get(key) || new Set();
        owners.add(id);
        continuationOwners.set(key, owners);
      }
    }
  }

  for (const draft of analyzed) {
    const owners = continuationOwners.get(draft.startKey);
    if (!owners) continue;
    for (const owner of owners) {
      if (owner !== draft.id) errors.push(`${draft.id} starts inside ${owner} main line`);
    }
  }

  return {
    valid: errors.length === 0,
    checked,
    todo,
    rejected,
    errors
  };
}

function readDraftFile(path) {
  return JSON.parse(readFileSync(path, 'utf8')).drafts || [];
}

export function readDrafts(path) {
  const stat = statSync(path);
  if (stat.isFile()) return readDraftFile(path);
  return readdirSync(path)
    .filter((name) => /^draft-batch-.+\.json$/i.test(name))
    .flatMap((name) => readDraftFile(join(path, name)));
}

export function main() {
  const target = process.argv[2] || join(process.cwd(), 'data', 'endgame-expansion', 'drafts');
  const result = validateDraftLessons({ drafts: readDrafts(target) });
  const payload = JSON.stringify(result, null, 2);
  if (!result.valid) {
    console.error(payload);
    process.exit(1);
  }
  console.log(payload);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
