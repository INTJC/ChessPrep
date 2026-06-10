import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function containsTodo(value) {
  return JSON.stringify(value || '').includes('TODO_ORIGINAL');
}

function hasRequiredAnalysis(draft) {
  const teaching = draft.teaching || {};
  return Boolean(
    teaching.principle && teaching.method && teaching.mistake
    && Array.isArray(draft.hints) && draft.hints.length >= 2
    && Array.isArray(draft.steps) && draft.steps.length >= 1
    && !containsTodo(draft)
  );
}

function isRejected(draft) {
  return draft?.importStatus === 'rejected-strict-standard';
}

export function summarizeDraftReadiness(draftData) {
  const drafts = draftData.drafts || [];
  const rejected = drafts.filter(isRejected).length;
  const analyzed = drafts.filter((draft) => !isRejected(draft) && hasRequiredAnalysis(draft)).length;
  return {
    total: drafts.length,
    analyzed,
    todo: drafts.length - analyzed - rejected,
    rejected
  };
}

function readDraftBatches(dir) {
  return readdirSync(dir)
    .filter((name) => /^draft-batch-\d+\.json$/i.test(name))
    .flatMap((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')).drafts || []);
}

export function main() {
  const dir = process.argv[2] || join(process.cwd(), 'data', 'endgame-expansion', 'drafts');
  const result = summarizeDraftReadiness({ drafts: readDraftBatches(dir) });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
