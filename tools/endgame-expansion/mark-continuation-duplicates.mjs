import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { playLegalUciMove } from '../../app.js';

function parseArgs(argv) {
  const args = {
    drafts: null,
    candidates: null,
    output: null
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--drafts') args.drafts = argv[++index];
    else if (arg === '--candidates') args.candidates = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
  }
  return args;
}

function contextPlyRange(draft) {
  const plies = (draft.contextWindow || [])
    .map((move) => Number(move.ply))
    .filter(Number.isFinite);
  if (!plies.length) {
    const ply = Number(draft.startPly) + 1;
    return Number.isFinite(ply) ? { min: ply, max: ply } : { min: 0, max: 0 };
  }
  return {
    min: Math.min(...plies),
    max: Math.max(...plies)
  };
}

function draftMovePly(draft) {
  return Number(draft.startPly) + 1;
}

function isAlreadyRejected(draft) {
  return draft?.importStatus === 'rejected-strict-standard';
}

function isAnalyzed(draft) {
  return draft?.importStatus === 'analysis-draft';
}

function rejectionPayload(owner) {
  return {
    reason: 'same-source-continuation-duplicate',
    relatedDraftId: owner.id,
    note: '同一 sourceGameId 中该候选落在更早候选的上下文/主线窗口内，不作为独立残局题。'
  };
}

function positionKey(fen) {
  return String(fen || '').trim().split(/\s+/).slice(0, 4).join(' ');
}

function firstMove(item) {
  return item?.steps?.[0]?.move || '';
}

function startTaskKey(item) {
  const move = firstMove(item);
  if (!item?.fen || !move) return '';
  return `${positionKey(item.fen)}|${move}`;
}

function duplicateRejectionPayload(owner) {
  return {
    reason: 'duplicate-start-task',
    relatedDraftId: owner.id,
    note: '该 FEN + 第一手已经存在于更早草稿或正式候选中，不作为独立残局题。'
  };
}

function startsInsideCandidatePayload(owner) {
  return {
    reason: 'starts-inside-candidate-main-line',
    relatedDraftId: owner.id,
    note: '该起点已经落在正式候选的主线后续局面内，不作为独立残局题。'
  };
}

function continuationKeys(item) {
  let fen = item.fen;
  const keys = [];
  for (const step of item.steps || []) {
    if (!step?.move) continue;
    const played = playLegalUciMove(fen, step.move);
    fen = played.nextFen;
    keys.push(positionKey(fen));
    if (step.reply) {
      const replied = playLegalUciMove(fen, step.reply);
      fen = replied.nextFen;
      keys.push(positionKey(fen));
    }
  }
  return keys;
}

export function markContinuationDuplicates(draftData) {
  const groups = new Map();
  for (const draft of draftData.drafts || []) {
    if (!draft.sourceGameId) continue;
    const list = groups.get(draft.sourceGameId) || [];
    list.push(draft);
    groups.set(draft.sourceGameId, list);
  }

  const rejectedIds = [];
  const analyzedConflicts = [];

  for (const group of groups.values()) {
    group.sort((a, b) => Number(a.startPly) - Number(b.startPly));
    const owners = [];
    for (const draft of group) {
      if (isAlreadyRejected(draft)) continue;
      const ply = draftMovePly(draft);
      const owner = owners.find((candidate) => {
        const range = contextPlyRange(candidate);
        return ply > draftMovePly(candidate) && ply >= range.min && ply <= range.max;
      });

      if (owner) {
        if (isAnalyzed(draft)) {
          analyzedConflicts.push(draft.id);
        } else {
          draft.importStatus = 'rejected-strict-standard';
          draft.rejection = rejectionPayload(owner);
          rejectedIds.push(draft.id);
          continue;
        }
      }

      owners.push(draft);
    }
  }

  draftData.importReady = false;
  return {
    draftData,
    summary: {
      rejected: rejectedIds.length,
      rejectedIds,
      analyzedConflicts
    }
  };
}

export function markDuplicateStartTasks(draftData, { candidates = [] } = {}) {
  const ownersByTask = new Map();
  const rejectedIds = [];

  for (const candidate of candidates) {
    const key = startTaskKey(candidate);
    if (!key || ownersByTask.has(key)) continue;
    ownersByTask.set(key, { id: candidate.id || candidate.sourceCandidateId || '<candidate>' });
  }

  for (const draft of draftData.drafts || []) {
    if (isAlreadyRejected(draft)) continue;
    const key = startTaskKey(draft);
    if (!key) continue;
    const owner = ownersByTask.get(key);
    if (owner) {
      draft.importStatus = 'rejected-strict-standard';
      draft.rejection = duplicateRejectionPayload(owner);
      rejectedIds.push(draft.id);
      continue;
    }
    ownersByTask.set(key, { id: draft.id });
  }

  draftData.importReady = false;
  return {
    draftData,
    summary: {
      rejected: rejectedIds.length,
      rejectedIds
    }
  };
}

export function markStartsInsideCandidateLines(draftData, { candidates = [] } = {}) {
  const ownersByPosition = new Map();
  const rejectedIds = [];

  for (const candidate of candidates) {
    for (const key of continuationKeys(candidate)) {
      if (!ownersByPosition.has(key)) {
        ownersByPosition.set(key, { id: candidate.id || candidate.sourceCandidateId || '<candidate>' });
      }
    }
  }

  for (const draft of draftData.drafts || []) {
    if (isAlreadyRejected(draft)) continue;
    const owner = ownersByPosition.get(positionKey(draft.fen));
    if (!owner) continue;
    draft.importStatus = 'rejected-strict-standard';
    draft.rejection = startsInsideCandidatePayload(owner);
    rejectedIds.push(draft.id);
  }

  draftData.importReady = false;
  return {
    draftData,
    summary: {
      rejected: rejectedIds.length,
      rejectedIds
    }
  };
}

export function main() {
  const args = parseArgs(process.argv);
  if (!args.drafts || !args.output) {
    console.error('Usage: node tools/endgame-expansion/mark-continuation-duplicates.mjs --drafts draft-batch.json [--candidates candidates.json] --output draft-batch.json');
    process.exit(1);
  }
  const draftData = JSON.parse(readFileSync(args.drafts, 'utf8'));
  const continuationResult = markContinuationDuplicates(draftData);
  const candidateData = args.candidates ? JSON.parse(readFileSync(args.candidates, 'utf8')) : { lessons: [] };
  const duplicateResult = markDuplicateStartTasks(continuationResult.draftData, {
    candidates: candidateData.lessons || candidateData
  });
  const insideCandidateResult = markStartsInsideCandidateLines(duplicateResult.draftData, {
    candidates: candidateData.lessons || candidateData
  });
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(insideCandidateResult.draftData, null, 2)}\n`);
  console.log(JSON.stringify({
    continuation: continuationResult.summary,
    duplicateStartTasks: duplicateResult.summary,
    startsInsideCandidateLines: insideCandidateResult.summary
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
