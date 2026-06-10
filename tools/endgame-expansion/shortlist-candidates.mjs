import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    summary: null,
    minScore: 8,
    target: 360,
    minPerCategory: 0,
    perFileCap: 35,
    perCategoryCap: 180,
    perSourceGameCap: 1
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') args.input = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--summary') args.summary = argv[++index];
    else if (arg === '--min-score') args.minScore = Number(argv[++index]) || args.minScore;
    else if (arg === '--target') args.target = Number(argv[++index]) || args.target;
    else if (arg === '--min-per-category') args.minPerCategory = Number(argv[++index]) || args.minPerCategory;
    else if (arg === '--per-file-cap') args.perFileCap = Number(argv[++index]) || args.perFileCap;
    else if (arg === '--per-category-cap') args.perCategoryCap = Number(argv[++index]) || args.perCategoryCap;
    else if (arg === '--per-source-game-cap') args.perSourceGameCap = Number(argv[++index]) || args.perSourceGameCap;
  }
  return args;
}

function positionKey(fen) {
  return String(fen || '').trim().split(/\s+/).slice(0, 4).join(' ');
}

function sourceFile(candidate) {
  return String(candidate.sourceGameId || '').split('|')[0] || 'unknown.pgn';
}

function candidateSort(a, b) {
  return b.complexityScore - a.complexityScore
    || String(a.category).localeCompare(String(b.category))
    || String(a.sourceGameId).localeCompare(String(b.sourceGameId))
    || a.startPly - b.startPly
    || String(a.id).localeCompare(String(b.id));
}

export function shortlistCandidates(report, options = {}) {
  const minScore = Number(options.minScore) || 8;
  const target = Number(options.target) || 360;
  const minPerCategory = Number(options.minPerCategory) || 0;
  const perFileCap = Number(options.perFileCap) || 35;
  const perCategoryCap = Number(options.perCategoryCap) || 180;
  const perSourceGameCap = Number(options.perSourceGameCap) || 1;
  const rejections = {
    lowScore: 0,
    duplicateFenMove: 0,
    perSourceGameCap: 0,
    perFileCap: 0,
    perCategoryCap: 0,
    overTarget: 0
  };
  const seenFenMove = new Set();
  const fileCounts = new Map();
  const sourceGameCounts = new Map();
  const categoryCounts = new Map();
  const shortlist = [];
  const prepared = [];

  for (const candidate of [...(report.candidates || [])].sort(candidateSort)) {
    if (candidate.complexityScore < minScore) {
      rejections.lowScore += 1;
      continue;
    }
    const fenMove = `${positionKey(candidate.fen)}|${candidate.suggestedFirstMove}`;
    if (seenFenMove.has(fenMove)) {
      rejections.duplicateFenMove += 1;
      continue;
    }
    seenFenMove.add(fenMove);
    prepared.push(candidate);
  }

  function tryAdd(candidate) {
    if (shortlist.some((item) => item.id === candidate.id)) return false;

    const file = sourceFile(candidate);
    if ((fileCounts.get(file) || 0) >= perFileCap) {
      rejections.perFileCap += 1;
      return false;
    }
    const sourceGame = candidate.sourceGameId || candidate.id;
    if ((sourceGameCounts.get(sourceGame) || 0) >= perSourceGameCap) {
      rejections.perSourceGameCap += 1;
      return false;
    }
    const category = candidate.category || 'uncategorized';
    if ((categoryCounts.get(category) || 0) >= perCategoryCap) {
      rejections.perCategoryCap += 1;
      return false;
    }
    if (shortlist.length >= target) {
      rejections.overTarget += 1;
      return false;
    }

    fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
    sourceGameCounts.set(sourceGame, (sourceGameCounts.get(sourceGame) || 0) + 1);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    shortlist.push({
      ...candidate,
      shortlistStatus: 'needs-original-analysis',
      reviewTier: candidate.complexityScore >= 9 ? 'priority-review' : 'standard-review',
      sourceFile: file
    });
    return true;
  }

  if (minPerCategory > 0) {
    const categories = [...new Set(prepared.map((candidate) => candidate.category || 'uncategorized'))].sort();
    for (const category of categories) {
      const categoryCandidates = prepared.filter((candidate) => (candidate.category || 'uncategorized') === category);
      for (const candidate of categoryCandidates) {
        if ((categoryCounts.get(category) || 0) >= minPerCategory) break;
        tryAdd(candidate);
      }
    }
  }

  for (const candidate of prepared) {
    tryAdd(candidate);
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceReportGeneratedAt: report.generatedAt || null,
    shortlist,
    counts: {
      rawCandidates: (report.candidates || []).length,
      shortlisted: shortlist.length,
      byFile: Object.fromEntries([...fileCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
      byCategory: Object.fromEntries([...categoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])))
    },
    rejections
  };
}

function markdownSummary(result, options) {
  const lines = [
    '# Endgame Expansion Shortlist Report',
    '',
    `Generated: ${result.generatedAt}`,
    `Input: ${options.input}`,
    `Shortlisted: ${result.counts.shortlisted} / ${result.counts.rawCandidates}`,
    `Filters: minScore ${options.minScore}, minPerCategory ${options.minPerCategory}, perFileCap ${options.perFileCap}, perCategoryCap ${options.perCategoryCap}, perSourceGameCap ${options.perSourceGameCap}, target ${options.target}`,
    '',
    '## Category Counts',
    ''
  ];
  for (const [category, count] of Object.entries(result.counts.byCategory)) {
    lines.push(`- ${category}: ${count}`);
  }
  lines.push('', '## File Counts', '');
  for (const [file, count] of Object.entries(result.counts.byFile)) {
    lines.push(`- ${file}: ${count}`);
  }
  lines.push('', '## Rejections', '');
  for (const [reason, count] of Object.entries(result.rejections)) {
    lines.push(`- ${reason}: ${count}`);
  }
  lines.push('', '## Priority Examples', '');
  for (const candidate of result.shortlist.slice(0, 30)) {
    lines.push(`- ${candidate.id} | ${candidate.complexityScore} | ${candidate.category} | ${candidate.title} | ${candidate.source?.event || ''} ${candidate.source?.date || ''} | ${candidate.suggestedFirstMove}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.output) {
    console.error('Usage: node tools/endgame-expansion/shortlist-candidates.mjs --input scan.json --output shortlist.json [--summary report.md]');
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(args.input, 'utf8'));
  const result = shortlistCandidates(report, args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, JSON.stringify(result, null, 2));
  if (args.summary) {
    mkdirSync(dirname(args.summary), { recursive: true });
    writeFileSync(args.summary, markdownSummary(result, args));
  }
  console.log(`Shortlisted ${result.counts.shortlisted} of ${result.counts.rawCandidates} raw candidates.`);
  console.log(`Wrote ${args.output}.`);
  if (args.summary) console.log(`Wrote ${args.summary}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
