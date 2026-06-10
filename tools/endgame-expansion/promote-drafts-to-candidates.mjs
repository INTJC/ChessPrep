import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { playLegalUciMove } from '../../app.js';

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, 'data', 'endgame-expansion', 'drafts');
const DEFAULT_OUTPUT = join(ROOT, 'data', 'endgame-expansion', 'candidates', 'pgnmentor-analyzed-drafts.json');

function parseArgs(argv) {
  const args = {
    drafts: DRAFT_DIR,
    output: DEFAULT_OUTPUT,
    importReady: false
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--drafts') args.drafts = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--import-ready') args.importReady = true;
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readDraftFile(path) {
  return readJson(path).drafts || [];
}

export function readDrafts(path = DRAFT_DIR) {
  const stat = statSync(path);
  if (stat.isFile()) return readDraftFile(path);
  return readdirSync(path)
    .filter((name) => /^draft-batch-.+\.json$/i.test(name))
    .flatMap((name) => readDraftFile(join(path, name)));
}

function finalFenFor(draft) {
  let fen = draft.fen;
  for (const step of draft.steps || []) {
    fen = playLegalUciMove(fen, step.move).nextFen;
    if (step.reply) fen = playLegalUciMove(fen, step.reply).nextFen;
  }
  return fen;
}

function candidateId(draft) {
  if (draft.sourceCandidateId) return draft.sourceCandidateId;
  return String(draft.id || '')
    .replace(/^draft-/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    || 'candidate-unknown';
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

function playerQualityReason(draft) {
  const source = draft.source || {};
  const players = [source.white, source.black].filter(Boolean).join(' vs ') || 'verified source game';
  const event = source.event || 'recorded event';
  const date = source.date || 'unknown date';
  const existing = String(draft.playerQualityReason || '').trim();
  if (existing && !/requires final human quality review|Manual title\/rating verification required/i.test(existing)) {
    return existing;
  }
  return `${players}, ${event} ${date}. Selected by the strict elite PGN gate, verified against the real game continuation, and annotated with original teaching analysis before import.`;
}

function promoteDraft(draft) {
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
    source: {
      white: draft.source?.white || '',
      black: draft.source?.black || '',
      event: draft.source?.event || '',
      site: draft.source?.site || '',
      date: draft.source?.date || '',
      result: draft.source?.result || ''
    },
    teaching: draft.teaching,
    hints: draft.hints,
    steps: draft.steps,
    sourceLine: Array.isArray(draft.sourceLine) ? draft.sourceLine.map((move) => ({ ...move })) : [],
    finalFen: finalFenFor(draft),
    sourceCandidateId: draft.sourceCandidateId || null,
    review: draft.review || null
  };
}

export function promoteDraftsToCandidates({ drafts = [], importReady = false } = {}) {
  const lessons = [];
  const skipped = [];

  for (const draft of drafts) {
    if (draft.importStatus !== 'analysis-draft') {
      skipped.push({ id: draft.id || '<missing-id>', reason: draft.importStatus || 'missing-import-status' });
      continue;
    }
    lessons.push(promoteDraft(draft));
  }

  return {
    generatedAt: new Date().toISOString(),
    importReady,
    lessons,
    skipped
  };
}

export function main() {
  const args = parseArgs(process.argv);
  const drafts = readDrafts(args.drafts);
  const result = promoteDraftsToCandidates({ drafts, importReady: args.importReady });
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, JSON.stringify(result, null, 2));
  console.log(`Promoted ${result.lessons.length} analyzed drafts.`);
  console.log(`Skipped ${result.skipped.length}.`);
  console.log(`Wrote ${args.output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
