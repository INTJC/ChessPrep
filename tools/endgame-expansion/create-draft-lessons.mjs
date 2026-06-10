import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {
    review: null,
    contexts: null,
    evaluations: null,
    output: null,
    limit: 45
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--review') args.review = argv[++index];
    else if (arg === '--contexts') args.contexts = argv[++index];
    else if (arg === '--evaluations') args.evaluations = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--limit') args.limit = Number(argv[++index]) || args.limit;
  }
  return args;
}

function inferCategoryFromFen(fen) {
  const placement = String(fen || '').split(/\s+/)[0] || '';
  const queens = (placement.match(/q/gi) || []).length;
  const rooks = (placement.match(/r/gi) || []).length;
  const bishops = (placement.match(/b/gi) || []).length;
  const knights = (placement.match(/n/gi) || []).length;
  if (queens && (bishops || knights || rooks)) return 'queen-minor-endgames';
  if (queens) return 'queen-endgames';
  if (bishops >= 2) return 'opposite-bishop-initiative';
  if (rooks === 1) return 'single-rook-defense';
  if (rooks >= 2) return 'rook-activity';
  return 'practical-themes';
}

function stepsFromSourceLine(context) {
  const sourceLine = Array.isArray(context.sourceLine) ? context.sourceLine : [];
  const moves = sourceLine.length ? sourceLine.map((move) => move.uci) : [context.focusMove?.uci || context.suggestedFirstMove].filter(Boolean);
  const steps = [];
  for (let index = 0; index < moves.length; index += 2) {
    const step = {
      move: moves[index],
      note: 'TODO_ORIGINAL_STEP_NOTE'
    };
    if (moves[index + 1]) step.reply = moves[index + 1];
    steps.push(step);
  }
  return steps;
}

export function createDraftLessons(reviewData, contextData, evaluationData, options = {}) {
  const contextById = new Map((contextData.contexts || []).map((context) => [context.id, context]));
  const evalById = new Map((evaluationData.evaluations || []).map((evaluation) => [evaluation.id, evaluation]));
  const limit = Number(options.limit) || 45;
  const drafts = [];
  const skipped = [];

  for (const row of reviewData.rows || []) {
    if (drafts.length >= limit) break;
    if (row.initialDecision !== 'keep-for-original-analysis') {
      skipped.push({ id: row.id, reason: row.initialDecision });
      continue;
    }
    const context = contextById.get(row.id);
    const evaluation = evalById.get(row.id);
    if (!context || !evaluation) {
      skipped.push({ id: row.id, reason: 'missing-context-or-evaluation' });
      continue;
    }

    drafts.push({
      id: `draft-${row.id}`,
      sourceCandidateId: row.id,
      importStatus: 'draft-not-ready',
      category: context.category || inferCategoryFromFen(context.candidateFen),
      title: `${context.headers?.White || 'White'} - ${context.headers?.Black || 'Black'}: ${context.focusMove?.san || row.suggestedFirstMove}`,
      level: '高水平复杂残局候选',
      goal: `${String(context.candidateFen).split(/\s+/)[1] === 'w' ? '白先' : '黑先'}，用原创分析确认关键计划`,
      fen: context.candidateFen,
      orientation: String(context.candidateFen).split(/\s+/)[1],
      sourceId: 'pgnmentor-files',
      sourceGameId: context.sourceGameId,
      startPly: context.focusPly - 1,
      source: {
        white: context.headers?.White || '',
        black: context.headers?.Black || '',
        event: context.headers?.Event || '',
        site: context.headers?.Site || '',
        date: context.headers?.Date || '',
        result: context.headers?.Result || ''
      },
      review: {
        engineRank: row.engineRank,
        gapCp: row.gapCp,
        initialDecision: row.initialDecision,
        topLines: row.topLines || evaluation.lines?.slice(0, 4) || []
      },
      contextWindow: context.window,
      sourceLine: Array.isArray(context.sourceLine) ? context.sourceLine.map((move) => ({ ...move })) : [],
      engineLines: evaluation.lines,
      teaching: {
        principle: 'TODO_ORIGINAL_ANALYSIS',
        method: 'TODO_ORIGINAL_ANALYSIS',
        mistake: 'TODO_ORIGINAL_ANALYSIS'
      },
      hints: [
        'TODO_ORIGINAL_HINT',
        'TODO_ORIGINAL_HINT'
      ],
      steps: stepsFromSourceLine(context)
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    importReady: false,
    drafts,
    skipped
  };
}

export function main() {
  const args = parseArgs(process.argv);
  if (!args.review || !args.contexts || !args.evaluations || !args.output) {
    console.error('Usage: node tools/endgame-expansion/create-draft-lessons.mjs --review review.json --contexts contexts.json --evaluations eval.json --output drafts.json');
    process.exit(1);
  }
  const review = JSON.parse(readFileSync(args.review, 'utf8'));
  const contexts = JSON.parse(readFileSync(args.contexts, 'utf8'));
  const evaluations = JSON.parse(readFileSync(args.evaluations, 'utf8'));
  const result = createDraftLessons(review, contexts, evaluations, args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, JSON.stringify(result, null, 2));
  console.log(`Created ${result.drafts.length} draft lesson skeletons.`);
  console.log(`Skipped ${result.skipped.length}.`);
  console.log(`Wrote ${args.output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
