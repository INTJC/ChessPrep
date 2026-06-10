import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {
    input: null,
    output: null
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') args.input = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
  }
  return args;
}

function sourceGameLabel(source) {
  const players = [source?.white, source?.black].filter(Boolean).join('-');
  const tail = [source?.event, source?.date].filter(Boolean).join(' ');
  return [players, tail].filter(Boolean).join(', ');
}

function normalizeLesson(candidate) {
  const source = {
    ...(candidate.source || {}),
    game: sourceGameLabel(candidate.source),
    chapter: 'Public PGN high-level endgame expansion',
    note: 'Public PGN source processed through the local endgame expansion pipeline; teaching text is original analysis.',
    provider: 'PGN Mentor public PGN files'
  };

  return {
    id: candidate.id,
    category: candidate.category,
    title: candidate.title,
    level: candidate.level,
    goal: candidate.goal,
    fen: candidate.fen,
    orientation: candidate.orientation,
    complexityScore: candidate.complexityScore,
    trainingTarget: candidate.trainingTarget,
    trainingTargetLabel: candidate.trainingTargetLabel,
    trainingTargetReason: candidate.trainingTargetReason,
    sourceId: candidate.sourceId,
    sourceGameId: candidate.sourceGameId,
    sourceCandidateId: candidate.sourceCandidateId,
    startPly: candidate.startPly,
    playerQualityReason: candidate.playerQualityReason,
    source,
    teaching: candidate.teaching,
    hints: candidate.hints,
    steps: candidate.steps,
    finalFen: candidate.finalFen,
    audit: candidate.audit
  };
}

export function exportCandidatesModule(candidateData) {
  const lessons = (candidateData.lessons || []).map(normalizeLesson);
  return `export const ENDGAME_EXPANSION_LESSONS = ${JSON.stringify(lessons, null, 2)};\n`;
}

export function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.output) {
    console.error('Usage: node tools/endgame-expansion/export-candidates-module.mjs --input candidates.json --output endgame-expansion-lessons.js');
    process.exit(1);
  }

  const candidateData = JSON.parse(readFileSync(args.input, 'utf8'));
  const moduleText = exportCandidatesModule(candidateData);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, moduleText);
  console.log(`Exported ${candidateData.lessons?.length || 0} candidate lessons to ${args.output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
