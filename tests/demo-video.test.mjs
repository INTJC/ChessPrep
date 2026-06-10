import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(join(root, 'tools', 'demo-video', 'make-demo-video.py'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');

test('demo video composition does not overlay an extra non-site logo', () => {
  const composeVideo = script.match(/def compose_video[\s\S]*?\n\ndef main\(/)?.[0] || '';

  assert.doesNotMatch(composeVideo, /\[2:v\]/);
  assert.doesNotMatch(composeVideo, /overlay=34:34/);
  assert.doesNotMatch(composeVideo, /chessprep-lab-mark\.png/);
});

test('demo recording title card does not add another icon over the website UI', () => {
  const recordDemo = script.match(/async def record_demo[\s\S]*?\n\ndef ass_subtitle_path/)?.[0] || '';

  assert.doesNotMatch(recordDemo, /demo-title img/);
  assert.doesNotMatch(recordDemo, /<img src="assets\/icons\/chessprep-lab-mark\.png"/);
  assert.doesNotMatch(recordDemo, /demo-title/);
});

test('demo subtitle ASS conversion does not escape commas as visible backslashes', () => {
  const assSubtitle = script.match(/def ass_subtitle_path[\s\S]*?\n\ndef compose_video/)?.[0] || '';

  assert.doesNotMatch(assSubtitle, /replace\(",",\s*r"\\,"\)/);
});

test('demo subtitles use forced-aligned timings instead of scene-weight estimates', () => {
  assert.match(script, /def forced_align_subtitles/);
  assert.doesNotMatch(script, /def narration_duration_weights/);
  assert.doesNotMatch(script, /scene\["duration"\]\s*\*\s*weight/);
  assert.doesNotMatch(script, /-aligned\.mp3/);
  assert.match(script, /-aligned\.wav/);
  assert.match(script, /-c:a",\s*"pcm_s16le"/);
  assert.match(script, /boundary="WordBoundary"/);
  assert.match(script, /parse_edge_tts_word_bounds/);
  assert.doesNotMatch(script, /speech_start, speech_end = speech_bounds/);
  assert.match(script, /subtitle_start = segment\["start"\]/);
  assert.match(script, /subtitle_end = segment\["end"\]/);
});

test('demo subtitle alignment uses first and last TTS word bounds', () => {
  const forcedAlign = script.match(/def forced_align_subtitles[\s\S]*?\n\ndef normalize_audio/)?.[0] || '';

  assert.match(forcedAlign, /metadata_path = segments_dir/);
  assert.match(forcedAlign, /synthesize_text_with_edge_tts\(voice, segment_path, metadata_path\)/);
  assert.match(forcedAlign, /tts_start, tts_end = parse_edge_tts_word_bounds\(metadata_path\) or \(0\.0, duration\)/);
  assert.doesNotMatch(forcedAlign, /speech_bounds\(segment_path\)/);
  assert.doesNotMatch(forcedAlign, /parse_edge_tts_subtitle_bounds/);
});

test('demo ASS subtitles use standard centisecond timestamps', () => {
  const assSubtitle = script.match(/def ass_subtitle_path[\s\S]*?\n\ndef compose_video/)?.[0] || '';

  assert.match(script, /def format_ass_time/);
  assert.match(assSubtitle, /format_ass_time\(parse_srt_time\(match\.group\(2\)\)\)/);
  assert.match(assSubtitle, /format_ass_time\(parse_srt_time\(match\.group\(3\)\)\)/);
  assert.doesNotMatch(assSubtitle, /replace\(",",\s*"\\."\)/);
});

test('demo subtitle style is high-contrast and legible', () => {
  const assSubtitle = script.match(/def ass_subtitle_path[\s\S]*?\n\ndef compose_video/)?.[0] || '';
  const styleLine = assSubtitle.match(/Style: Default,([^\\"]+)/)?.[1] || '';
  const values = styleLine.split(',');

  assert.equal(values[1], '42');
  assert.match(values[5] || '', /^&H[0-9A-Fa-f]{8}$/);
  assert.equal(values[15], '3');
});

test('demo scenes show opening quality content while narrating opening priors', () => {
  assert.doesNotMatch(script, /230,836|43,089|Automated tests|146 tests|invited testers|temporary cpolar|safe private sharing/i);
  assert.doesNotMatch(script, /"id": "quality"|"id": "sharing"|"id": "tests"/);
});

test('demo narrative emphasizes opening memory and human-like off-book preparation', () => {
  assert.match(script, /Opening repertoires are easy to forget after deep analysis/);
  assert.match(script, /Drop your own prepared openings into the workspace and rehearse them as a memory tree/);
  assert.match(script, /off-book Human-Like sparring/);
  assert.match(script, /From any current position/);
  assert.match(script, /match preparation/);
  assert.match(script, /Human-Like off-book prep from any position/);
});

test('demo has exactly two second visual transitions at the start and end', () => {
  const transitions = [...script.matchAll(/"id": "(intro_transition|outro_transition)"[\s\S]*?"duration": ([0-9.]+)/g)]
    .map((match) => ({ id: match[1], duration: Number(match[2]) }));

  assert.deepEqual(transitions, [
    { id: 'intro_transition', duration: 2 },
    { id: 'outro_transition', duration: 2 }
  ]);
});

test('demo recording drives scene actions from absolute deadlines', () => {
  const recordDemo = script.match(/async def record_demo[\s\S]*?\n\ndef ass_subtitle_path/)?.[0] || '';

  assert.match(recordDemo, /time\.perf_counter\(\)/);
  assert.match(recordDemo, /sleep_to_progress/);
  assert.match(recordDemo, /finish_scene/);
  assert.doesNotMatch(recordDemo, /await wait\(scene\)/);
  assert.doesNotMatch(recordDemo, /await wait\(\{"duration":/);
});

test('demo composition trims video explicitly instead of hiding drift with shortest', () => {
  const composeVideo = script.match(/def compose_video[\s\S]*?\n\ndef main\(/)?.[0] || '';

  assert.match(composeVideo, /video_offset/);
  assert.match(composeVideo, /trim=start=\{max\(0\.0, video_offset\):\.3f\}:duration=\{duration:\.3f\}/);
  assert.match(composeVideo, /setpts=PTS-STARTPTS/);
  assert.match(composeVideo, /fps=30/);
  assert.doesNotMatch(composeVideo, /"-ss"/);
  assert.doesNotMatch(composeVideo, /"-shortest"/);
});

test('demo highlight boxes use exact bounding boxes with a controlled outline margin', () => {
  const highlight = script.match(/async def highlight[\s\S]*?\n\nasync def clear_highlight/)?.[0] || '';

  assert.match(highlight, /margin = 4/);
  assert.match(highlight, /left: \$\{Math\.max\(0, rect\.left - margin\)\}px/);
  assert.match(highlight, /top: \$\{Math\.max\(0, rect\.top - margin\)\}px/);
  assert.match(highlight, /width: \$\{rect\.width \+ margin \* 2\}px/);
  assert.match(highlight, /height: \$\{rect\.height \+ margin \* 2\}px/);
  assert.doesNotMatch(highlight, /rect\.width \+ 16/);
  assert.doesNotMatch(highlight, /rect\.height \+ 16/);
});

test('demo highlight selectors exist in the current app markup or styles', () => {
  const selectors = [...script.matchAll(/highlight\(page,\s*"([^"]+)"/g)].map((match) => match[1]);
  const source = `${html}\n${css}`;

  assert.ok(selectors.length > 0);
  for (const selector of selectors) {
    for (const part of selector.split(/\s+/)) {
      if (part.startsWith('.')) {
        assert.match(source, new RegExp(`class="[^"]*${part.slice(1)}|\\${part}\\b`), `${selector} is not present`);
      } else if (part.startsWith('[')) {
        const attribute = part.match(/^\[([^=\]]+)/)?.[1];
        assert.ok(attribute && source.includes(attribute), `${selector} is not present`);
      }
    }
  }
});
