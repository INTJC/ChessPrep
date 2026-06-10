import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  advanceEndgameStep,
  createEndgameSession,
  getEndgameCategories,
  listEndgameLessons
} from '../../endgames.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const outputPath = path.join(projectRoot, 'dist', 'endgame-training-answers.txt');

function sourceLabel(source = {}) {
  const players = [source.white, source.black].filter(Boolean).join(' - ');
  const event = [source.event, source.date].filter(Boolean).join(' ');
  const elos = [source.whiteElo, source.blackElo].filter((value) => value !== undefined && value !== null).join(' / ');
  return [
    players || source.game || '',
    event,
    elos ? `Elo: ${elos}` : ''
  ].filter(Boolean).join(' | ');
}

function buildLine(lesson) {
  let session = createEndgameSession(lesson.id);
  const lines = [];
  const errors = [];

  for (let index = 0; index < lesson.steps.length; index += 1) {
    const step = lesson.steps[index];
    try {
      const result = advanceEndgameStep(session, step.move);
      if (!result.ok) {
        errors.push(`Step ${index + 1}: expected ${result.expectedMove || 'none'}, got ${step.move}`);
        break;
      }

      const played = result.played?.move;
      const reply = result.reply?.move;
      const answerText = played ? `${played.san} [${played.uci}]` : step.move;
      const replyText = reply ? `${reply.san} [${reply.uci}]` : (step.reply || '');
      const note = step.note ? ` | ${step.note}` : '';
      lines.push(`${index + 1}. ${answerText}${replyText ? ` -> ${replyText}` : ''}${note}`);
      session = result.session;
    } catch (error) {
      errors.push(`Step ${index + 1}: ${error.message}`);
      break;
    }
  }

  return {
    firstMove: lines[0] || (lesson.steps[0]?.move || 'No move'),
    lines,
    errors,
    finalFen: session.currentFen
  };
}

function textBlock(lesson, index, categoryTitle) {
  const line = buildLine(lesson);
  const hints = Array.isArray(lesson.hints) && lesson.hints.length
    ? lesson.hints.map((hint, hintIndex) => `  - ${hintIndex + 1}. ${hint}`).join('\n')
    : '  - none';

  const teaching = lesson.teaching || {};
  const mainLine = line.lines.length ? line.lines.map((entry) => `  ${entry}`).join('\n') : '  No steps';
  const errors = line.errors.length ? `\nExport warnings:\n${line.errors.map((entry) => `  - ${entry}`).join('\n')}` : '';

  return [
    `#${String(index + 1).padStart(3, '0')} ${lesson.title || lesson.id}`,
    `ID: ${lesson.id}`,
    `Category: ${categoryTitle || lesson.category}`,
    `Goal: ${lesson.goal || ''}`,
    `Target: ${lesson.trainingTargetLabel || lesson.trainingTarget || ''}`,
    `FEN: ${lesson.fen}`,
    `Source: ${sourceLabel(lesson.source)}`,
    `First answer: ${line.firstMove}`,
    'Main line:',
    mainLine,
    'Hints:',
    hints,
    `Principle: ${teaching.principle || ''}`,
    `Method: ${teaching.method || ''}`,
    `Common mistake: ${teaching.mistake || ''}`,
    `Final FEN after answer line: ${line.finalFen}`,
    errors
  ].filter((entry) => entry !== '').join('\n');
}

const categories = new Map(getEndgameCategories().map((category) => [category.id, category.title]));
const lessons = listEndgameLessons();
const counts = lessons.reduce((acc, lesson) => {
  acc[lesson.category] = (acc[lesson.category] || 0) + 1;
  return acc;
}, {});

const header = [
  'ChessPrep Lab Endgame Training Answers',
  `Generated from current local endgame data: ${new Date().toISOString()}`,
  `Total lessons: ${lessons.length}`,
  '',
  'Category counts:',
  ...Object.entries(counts).map(([category, count]) => `  - ${categories.get(category) || category}: ${count}`),
  '',
  'Format: every answer line shows SAN first, then UCI in brackets. The UCI move is the exact move accepted by the trainer.',
  ''
].join('\n');

const body = lessons
  .map((lesson, index) => textBlock(lesson, index, categories.get(lesson.category)))
  .join('\n\n' + '-'.repeat(96) + '\n\n');

await writeFile(outputPath, `${header}\n${body}\n`, 'utf8');
console.log(outputPath);
