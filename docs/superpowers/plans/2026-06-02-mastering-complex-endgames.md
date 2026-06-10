# Mastering Complex Endgames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old basic endgame course with a verified first batch based on Daniel Naroditsky's *Mastering Complex Endgames*.

**Architecture:** Keep the existing endgame trainer flow and board unchanged. Replace the lesson dataset with sourced complex-endgame drills, add source metadata rendering, and extend tests so every lesson has book provenance and legal UCI lines.

**Tech Stack:** Static JavaScript modules, existing board/move engine in `app.js`, Node's built-in test runner.

---

### File Structure

- Modify `endgames.js`: replace the old simple lesson pack with the first verified *Mastering Complex Endgames* batch.
- Modify `app.js`: set default endgame category/lesson to the new pack and render lesson source metadata.
- Modify `tests/endgames.test.mjs`: assert the new dataset shape, source metadata, and legal main lines.
- Keep `index.html` and `styles.css` unchanged unless the new metadata needs layout adjustment.

### Task 1: Dataset Contract

**Files:**
- Modify: `tests/endgames.test.mjs`

- [ ] **Step 1: Write failing tests**

Update the first test to require:

```js
assert.equal(categories.length, 3);
assert.equal(lessons.length, 6);
assert.ok(categories.some((category) => category.id === 'rook-activity'));
assert.ok(lessons.every((lesson) => lesson.source?.book === 'Mastering Complex Endgames'));
assert.ok(lessons.every((lesson) => Number.isInteger(lesson.source.example)));
```

Also update session tests to use the new first lesson id `mce-capa-janowski-fix-weaknesses`.

- [ ] **Step 2: Run red test**

Run:

```powershell
node --test tests\endgames.test.mjs
```

Expected: fail because the existing course still has the old 5-category, 22-lesson basic dataset and no `source` metadata.

### Task 2: Replace Endgame Pack

**Files:**
- Modify: `endgames.js`

- [ ] **Step 1: Write minimal implementation**

Replace `ENDGAME_CATEGORIES` with:

```js
[
  { id: 'rook-activity', title: '车残局：主动性', subtitle: '弃兵换主动、限制反击、车的位置' },
  { id: 'king-activity', title: '王的活跃', subtitle: '用王参与战斗，动态补偿物质损失' },
  { id: 'practical-themes', title: '实战主题', subtitle: '弱点、通路兵、主动防守和深度计算' }
]
```

Replace `ENDGAME_LESSONS` with six sourced lessons:

- `mce-capa-janowski-fix-weaknesses`: Capablanca-Janowski, New York 1913, example 8, page 37, start before `27.g4`.
- `mce-capa-janowski-stop-counterplay`: same source, start before `28.b4`.
- `mce-capa-janowski-quiet-clamp`: same source, start before `30.a4`.
- `mce-capa-janowski-breakthrough-timing`: same source, start before `35.g5`.
- `mce-capa-tartakower-king-walk`: Capablanca-Tartakower, New York 1924, example 18, page 61, start before `35.Kg3`.
- `mce-capa-tartakower-mating-net`: same source, start before `39.Kf6`.

Use only original Chinese teaching summaries, not copied book prose. Every step must be UCI and include the opponent reply where the line requires it.

- [ ] **Step 2: Run green test**

Run:

```powershell
node --test tests\endgames.test.mjs
```

Expected: pass with all six lesson main lines legal.

### Task 3: UI Source Metadata

**Files:**
- Modify: `app.js`
- Modify: `tests/endgames.test.mjs`

- [ ] **Step 1: Write failing test**

Add a test requiring every lesson source to include:

```js
source.game
source.chapter
source.pdfPage
source.note
```

- [ ] **Step 2: Run red test**

Run:

```powershell
node --test tests\endgames.test.mjs
```

Expected: fail until all source metadata is present.

- [ ] **Step 3: Implement source rendering**

In `renderEndgameTraining()`, insert a compact source line under the lesson goal:

```js
const sourceLine = activeLesson.source
  ? `<p class="lesson-source">${escapeHtml(activeLesson.source.game)} · 例 ${activeLesson.source.example} · PDF p.${activeLesson.source.pdfPage}</p>`
  : '';
```

Then include `${sourceLine}` before the `<dl>`.

- [ ] **Step 4: Run tests**

Run:

```powershell
node --test tests\endgames.test.mjs tests\trainer-core.test.mjs
```

Expected: pass.

### Task 4: Full Verification

**Files:**
- No new production files.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
node --test tests\endgames.test.mjs tests\trainer-core.test.mjs tests\installer.test.mjs tests\server.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Check local server**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\start-trainer.ps1'
```

Expected: server reachable at `http://localhost:8788`.

### Self-Review

- Spec coverage: old basic endgame content is replaced by a first verified batch from the requested book; exact expansion can continue by adding more sourced lessons.
- Placeholder scan: no placeholder lesson ids or unsourced lessons are allowed.
- Type consistency: `source` is a plain object and does not affect existing session advancement.
