import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {
    drafts: null,
    analysis: null,
    output: null
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--drafts') args.drafts = argv[++index];
    else if (arg === '--analysis') args.analysis = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
  }
  return args;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRejected(draft) {
  return draft?.importStatus === 'rejected-strict-standard';
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

function matchesSourceLine(draft, analysis) {
  if (!Array.isArray(draft.sourceLine) || draft.sourceLine.length === 0) return true;
  const expected = sourceLineMoves(draft.sourceLine);
  const actual = lessonLineMoves(analysis.steps);
  return expected.length === actual.length && expected.every((move, index) => move === actual[index]);
}

export function applyAnalysisReport(draftData, analysisReport) {
  const draftById = new Map((draftData.drafts || []).map((draft) => [draft.id, draft]));
  const missing = [];
  const skippedRejected = [];
  const invalidSourceLine = [];
  let applied = 0;

  for (const analysis of analysisReport.analyses || []) {
    const draft = draftById.get(analysis.id);
    if (!draft) {
      missing.push(analysis.id);
      continue;
    }
    if (isRejected(draft)) {
      skippedRejected.push(analysis.id);
      continue;
    }
    if (!matchesSourceLine(draft, analysis)) {
      invalidSourceLine.push(analysis.id);
      continue;
    }

    draft.importStatus = 'analysis-draft';
    draft.teaching = clone(analysis.teaching);
    draft.hints = clone(analysis.hints);
    draft.steps = clone(analysis.steps);
    draft.analysisReport = {
      stage: analysisReport.stage || '',
      generatedAt: analysisReport.generatedAt || ''
    };
    applied += 1;
  }

  draftData.importReady = false;
  return {
    draftData,
    summary: {
      applied,
      missing,
      skippedRejected,
      invalidSourceLine
    }
  };
}

export function main() {
  const args = parseArgs(process.argv);
  if (!args.drafts || !args.analysis || !args.output) {
    console.error('Usage: node tools/endgame-expansion/apply-analysis-report.mjs --drafts draft-batch.json --analysis original-analysis.json --output draft-batch.json');
    process.exit(1);
  }

  const draftData = JSON.parse(readFileSync(args.drafts, 'utf8'));
  const analysisReport = JSON.parse(readFileSync(args.analysis, 'utf8'));
  const result = applyAnalysisReport(draftData, analysisReport);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result.draftData, null, 2)}\n`);
  console.log(JSON.stringify(result.summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
