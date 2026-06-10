import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseArgs(argv) {
  const args = {
    shortlist: null,
    output: null,
    offset: 0,
    limit: 60,
    excludeReview: [],
    excludeCandidates: null,
    preferCategories: [],
    rejectEventPattern: null
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--shortlist') args.shortlist = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--offset') args.offset = Number(argv[++index]) || args.offset;
    else if (arg === '--limit') args.limit = Number(argv[++index]) || args.limit;
    else if (arg === '--exclude-review') args.excludeReview.push(argv[++index]);
    else if (arg === '--exclude-candidates') args.excludeCandidates = argv[++index];
    else if (arg === '--prefer-categories') args.preferCategories = String(argv[++index] || '').split(',').filter(Boolean);
    else if (arg === '--reject-event-pattern') args.rejectEventPattern = argv[++index];
  }
  return args;
}

function groupKey(candidate) {
  return `${candidate.sourceFile || 'unknown'}|${candidate.category || 'uncategorized'}`;
}

export function selectBalancedShortlistBatch(shortlistData, options = {}) {
  const offset = Number(options.offset) || 0;
  const limit = Number(options.limit) || 60;
  const excluded = new Set(options.excludedIds || []);
  const preferred = new Set(options.preferCategories || []);
  const rejectEventPattern = options.rejectEventPattern ? new RegExp(options.rejectEventPattern, 'i') : null;
  const groups = new Map();
  for (const candidate of shortlistData.shortlist || []) {
    if (excluded.has(candidate.id)) continue;
    if (rejectEventPattern?.test(candidate.source?.event || '')) continue;
    const key = groupKey(candidate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }

  const groupEntries = [...groups.entries()].sort((a, b) => {
    const aCategory = a[1][0]?.category || '';
    const bCategory = b[1][0]?.category || '';
    const aPreferred = preferred.has(aCategory) ? 0 : 1;
    const bPreferred = preferred.has(bCategory) ? 0 : 1;
    return aPreferred - bPreferred || a[0].localeCompare(b[0]);
  });
  const balanced = [];
  let added = true;
  let round = 0;
  while (added) {
    added = false;
    for (const [, candidates] of groupEntries) {
      const candidate = candidates[round];
      if (candidate) {
        balanced.push(candidate);
        added = true;
      }
    }
    round += 1;
  }

  const selected = balanced.slice(offset, offset + limit);
  return {
    generatedAt: new Date().toISOString(),
    offset,
    limit,
    selected,
    selectedIds: selected.map((candidate) => candidate.id),
    totalAvailable: balanced.length
  };
}

export function main() {
  const args = parseArgs(process.argv);
  if (!args.shortlist || !args.output) {
    console.error('Usage: node tools/endgame-expansion/select-balanced-batch.mjs --shortlist shortlist.json --output batch.json [--offset 0 --limit 60]');
    process.exit(1);
  }
  const shortlistData = JSON.parse(readFileSync(args.shortlist, 'utf8'));
  let excludedIds = [];
  for (const reviewPath of args.excludeReview || []) {
    const reviewData = JSON.parse(readFileSync(reviewPath, 'utf8'));
    excludedIds.push(...(reviewData.rows || []).map((row) => row.id));
  }
  if (args.excludeCandidates) {
    const candidateData = JSON.parse(readFileSync(args.excludeCandidates, 'utf8'));
    excludedIds.push(...(candidateData.lessons || []).map((lesson) => lesson.id));
  }
  const result = selectBalancedShortlistBatch(shortlistData, { ...args, excludedIds });
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, JSON.stringify({
    generatedAt: result.generatedAt,
    sourceReportGeneratedAt: shortlistData.generatedAt || null,
    shortlist: result.selected,
    selectedIds: result.selectedIds,
    offset: result.offset,
    limit: result.limit,
    totalAvailable: result.totalAvailable
  }, null, 2));
  console.log(`Selected ${result.selected.length} balanced candidates from ${result.totalAvailable} available.`);
  console.log(`Wrote ${args.output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
