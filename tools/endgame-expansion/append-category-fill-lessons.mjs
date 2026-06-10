import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listEndgameLessons } from '../../endgames.js';
import { buildStrictCategoryFillLessons } from './rebuild-strict-endgame-course.mjs';
import { exportCandidatesModule } from './export-candidates-module.mjs';

const DEFAULT_OUTPUT = 'data/endgame-expansion/candidates/category-fill-endgames.json';
const DEFAULT_MODULE = 'endgame-expansion-lessons.js';
const DEFAULT_REPORT = 'data/endgame-expansion/reports/category-fill-endgames-report.json';
const DEFAULT_CATEGORIES = ['queen-endgames', 'single-rook-defense'];

function parseArgs(argv) {
  const args = {
    output: DEFAULT_OUTPUT,
    module: DEFAULT_MODULE,
    report: DEFAULT_REPORT,
    minByCategory: 15,
    categories: DEFAULT_CATEGORIES
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') args.output = argv[++index];
    else if (arg === '--module') args.module = argv[++index];
    else if (arg === '--report') args.report = argv[++index];
    else if (arg === '--min-by-category') args.minByCategory = Number(argv[++index]) || args.minByCategory;
    else if (arg === '--categories') args.categories = String(argv[++index] || '').split(',').filter(Boolean);
  }
  return args;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function appendCategoryFillLessons({
  existingLessons = listEndgameLessons(),
  categories = DEFAULT_CATEGORIES,
  minByCategory = 15
} = {}) {
  const result = buildStrictCategoryFillLessons({
    existingLessons,
    categoryIds: categories,
    minByCategory
  });
  const currentLessons = existingLessons.map((lesson) => ({ ...lesson }));
  return {
    generatedAt: result.generatedAt,
    importReady: true,
    mode: 'append-category-fill',
    targetCount: currentLessons.length + result.lessons.length,
    protectedPrefixCount: currentLessons.length,
    filledCategories: categories,
    minByCategory,
    lessons: [...currentLessons, ...result.lessons],
    appendedLessons: result.lessons,
    report: {
      existingCounts: result.existingCounts,
      strictInputCounts: result.strictInputCounts,
      targetRejectedBeforeBuildCounts: result.targetRejectedBeforeBuildCounts,
      effectiveCounts: result.effectiveCounts,
      targetEffectiveCounts: result.targetEffectiveCounts,
      targetConflictCounts: result.targetConflictCounts,
      addedCounts: result.addedCounts,
      remainingByCategory: result.remainingByCategory,
      rejected: result.rejected
    }
  };
}

export function main() {
  const args = parseArgs(process.argv);
  const existingLessons = listEndgameLessons();
  const prefixIds = existingLessons.map((lesson) => lesson.id);
  const result = appendCategoryFillLessons({
    existingLessons,
    categories: args.categories,
    minByCategory: args.minByCategory
  });

  writeJson(args.output, {
    generatedAt: result.generatedAt,
    importReady: result.importReady,
    mode: result.mode,
    targetCount: result.targetCount,
    protectedPrefixCount: result.protectedPrefixCount,
    filledCategories: result.filledCategories,
    minByCategory: result.minByCategory,
    lessons: result.lessons
  });
  writeJson(args.report, {
    generatedAt: result.generatedAt,
    protectedPrefixIds: prefixIds,
    ...result.report
  });

  const moduleText = exportCandidatesModule({ lessons: result.lessons });
  mkdirSync(dirname(args.module), { recursive: true });
  writeFileSync(args.module, moduleText);

  console.log(JSON.stringify({
    targetCount: result.targetCount,
    protectedPrefixCount: result.protectedPrefixCount,
    addedCounts: result.report.addedCounts,
    remainingByCategory: result.report.remainingByCategory
  }, null, 2));

  if (Object.values(result.report.remainingByCategory).some((value) => value > 0)) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
