import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {
    evaluations: null,
    contexts: null,
    outputJson: null,
    outputMd: null,
    reviewGapCp: 25,
    rejectGapCp: 80
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--evaluations') args.evaluations = argv[++index];
    else if (arg === '--contexts') args.contexts = argv[++index];
    else if (arg === '--output-json') args.outputJson = argv[++index];
    else if (arg === '--output-md') args.outputMd = argv[++index];
    else if (arg === '--review-gap-cp') args.reviewGapCp = Number(argv[++index]) || args.reviewGapCp;
    else if (arg === '--reject-gap-cp') args.rejectGapCp = Number(argv[++index]) || args.rejectGapCp;
  }
  return args;
}

function classifyDecision(rank, gap, options) {
  if (!rank || rank < 1 || gap === null || gap > options.rejectGapCp) return 'reject-or-deep-review';
  if (rank > 1 || gap > options.reviewGapCp) return 'human-review-multiple-plans';
  return 'keep-for-original-analysis';
}

export function buildReviewRows(evaluationData, contextData, options = {}) {
  const reviewGapCp = Number(options.reviewGapCp) || 25;
  const rejectGapCp = Number(options.rejectGapCp) || 80;
  const contextById = new Map((contextData.contexts || []).map((context) => [context.id, context]));
  const rows = [];
  const counts = {
    keepForOriginalAnalysis: 0,
    humanReviewMultiplePlans: 0,
    rejectOrDeepReview: 0
  };

  for (const evaluation of evaluationData.evaluations || []) {
    const context = contextById.get(evaluation.id);
    const best = evaluation.lines?.[0] || null;
    const sourceLine = (evaluation.lines || []).find((line) => line.move === evaluation.suggestedFirstMove) || null;
    const gapCp = best && sourceLine ? best.scoreCp - sourceLine.scoreCp : null;
    const initialDecision = classifyDecision(evaluation.suggestedMoveRank, gapCp, { reviewGapCp, rejectGapCp });
    if (initialDecision === 'keep-for-original-analysis') counts.keepForOriginalAnalysis += 1;
    else if (initialDecision === 'human-review-multiple-plans') counts.humanReviewMultiplePlans += 1;
    else counts.rejectOrDeepReview += 1;

    rows.push({
      id: evaluation.id,
      event: context?.headers?.Event || '',
      players: `${context?.headers?.White || ''} - ${context?.headers?.Black || ''}`.trim(),
      sourceMoveSan: context?.focusMove?.san || '',
      suggestedFirstMove: evaluation.suggestedFirstMove,
      engineRank: evaluation.suggestedMoveRank || null,
      gapCp,
      bestMove: best?.move || null,
      bestScoreCp: best?.scoreCp ?? null,
      sourceScoreCp: sourceLine?.scoreCp ?? null,
      initialDecision,
      topLines: (evaluation.lines || []).slice(0, 4).map((line) => ({
        move: line.move,
        scoreCp: line.scoreCp,
        depth: line.depth,
        pv: line.pv
      }))
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    settings: { reviewGapCp, rejectGapCp },
    counts,
    rows
  };
}

function markdown(result) {
  const lines = [
    '# Endgame Candidate Review Sheet',
    '',
    'Status: review aid only; no website import.',
    '',
    `Generated: ${result.generatedAt}`,
    '',
    '## Counts',
    '',
    `- keep-for-original-analysis: ${result.counts.keepForOriginalAnalysis}`,
    `- human-review-multiple-plans: ${result.counts.humanReviewMultiplePlans}`,
    `- reject-or-deep-review: ${result.counts.rejectOrDeepReview}`,
    '',
    '| Candidate | Event | Players | Source move | Engine rank | Gap | Initial decision |',
    '|---|---|---|---:|---:|---:|---|'
  ];
  for (const row of result.rows) {
    lines.push(`| ${row.id} | ${row.event} | ${row.players} | ${row.sourceMoveSan || row.suggestedFirstMove} | ${row.engineRank || 'outside'} | ${row.gapCp ?? ''} | ${row.initialDecision} |`);
  }
  lines.push('', '## Notes', '');
  lines.push('- `Gap` is best engine score minus the source move score in centipawns.');
  lines.push('- Small gaps can indicate multiple viable plans and require human explanation, not automatic rejection.');
  lines.push('- Engine output is only a verification signal; final lesson text must be original human analysis.');
  return lines.join('\n');
}

export function main() {
  const args = parseArgs(process.argv);
  if (!args.evaluations || !args.contexts || (!args.outputJson && !args.outputMd)) {
    console.error('Usage: node tools/endgame-expansion/build-review-sheet.mjs --evaluations eval.json --contexts contexts.json --output-json review.json --output-md review.md');
    process.exit(1);
  }
  const evaluationData = JSON.parse(readFileSync(args.evaluations, 'utf8'));
  const contextData = JSON.parse(readFileSync(args.contexts, 'utf8'));
  const result = buildReviewRows(evaluationData, contextData, args);
  if (args.outputJson) {
    mkdirSync(dirname(args.outputJson), { recursive: true });
    writeFileSync(args.outputJson, JSON.stringify(result, null, 2));
  }
  if (args.outputMd) {
    mkdirSync(dirname(args.outputMd), { recursive: true });
    writeFileSync(args.outputMd, markdown(result));
  }
  console.log(`Reviewed ${result.rows.length} evaluated candidates.`);
  console.log(`Keep ${result.counts.keepForOriginalAnalysis}, review ${result.counts.humanReviewMultiplePlans}, reject/deep-review ${result.counts.rejectOrDeepReview}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
