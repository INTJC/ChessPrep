# Mastering Complex Endgames Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next verified batch from *Mastering Complex Endgames* while enforcing side-to-move and board-orientation correctness.

**Architecture:** Keep `endgames.js` as the single lesson dataset for now, but tighten test coverage before adding more lessons. Add only positions that can be checked from the PDF diagram plus the book's main line, and avoid guessed positions.

**Tech Stack:** Static JavaScript modules, existing legal move engine in `app.js`, Node's built-in test runner, local PDF rendering for manual source checks.

---

### File Structure

- Modify `tests/endgames.test.mjs`: update lesson count and add invariants for orientation, unique ids, source coverage, and duplicate FEN detection.
- Modify `endgames.js`: add a verified batch from Chapter 2 double-rook examples.
- Do not modify `app.js`, `index.html`, or `styles.css` unless the dataset requires new display fields.

### Task 1: Strengthen Dataset Tests

**Files:**
- Modify: `tests/endgames.test.mjs`

- [ ] **Step 1: Write failing tests**

Change expected lesson count from `6` to `10` and add these assertions:

```js
const ids = new Set(lessons.map((lesson) => lesson.id));
assert.equal(ids.size, lessons.length);
assert.ok(lessons.every((lesson) => lesson.orientation === lesson.fen.split(/\s+/)[1]));
assert.ok(lessons.every((lesson) => ['w', 'b'].includes(lesson.orientation)));

const fenKeys = new Set(lessons.map((lesson) => `${lesson.fen}|${lesson.steps[0].move}`));
assert.equal(fenKeys.size, lessons.length);
assert.ok(lessons.some((lesson) => lesson.orientation === 'b'));
assert.ok(lessons.some((lesson) => lesson.source.example === 4));
assert.ok(lessons.some((lesson) => lesson.source.example === 5));
```

- [ ] **Step 2: Run red test**

Run:

```powershell
node --test tests\endgames.test.mjs
```

Expected: fail because the project currently has only six lessons and no black-to-move lessons.

### Task 2: Add Verified Double-Rook Lessons

**Files:**
- Modify: `endgames.js`

- [ ] **Step 1: Add four lessons**

Add four lessons:

1. `mce-reprintsev-grigoriants-keep-activity`
   - Example 4, Reprintsev-Grigoriants, Russia Cup Moscow 1999, PDF p.30/book p.27.
   - Black to move, board orientation `b`.
   - FEN from the diagram:
     `6k1/pR3ppR/3rp2p/3p4/3p4/3P1P2/PP4PP/1K5R b - - 0 27`
   - Main line: `a7a6 b7c7 g7g5 c7c8 g8g7 c8a8`.

2. `mce-reprintsev-grigoriants-bad-pawn-sac`
   - Same source.
   - Black to move, orientation `b`.
   - Same FEN.
   - Main line: `g7g5 b7a7 g8g7 h7c7 h7h8 c7c7f8` is invalid in UCI, so this item must instead encode the legal sequence after verifying every move with `playLegalUciMove`.

3. `mce-vanderwiel-ernst-sacrifice-for-activity`
   - Example 5, Van der Wiel-Ernst, Dutch Championship Rotterdam 1998, PDF p.31/book p.28.
   - White to move, orientation `w`.
   - FEN must be read from the rendered diagram and verified before writing.

4. `mce-vanderwiel-ernst-black-activation`
   - Same source.
   - White to move, orientation `w`.
   - FEN and main line must be verified before writing.

- [ ] **Step 2: Correct the lesson details before implementation**

Before editing `endgames.js`, convert every SAN/figurine move from the PDF into legal UCI. Use `playLegalUciMove` through the test suite to reject any wrong move or wrong FEN.

- [ ] **Step 3: Run green test**

Run:

```powershell
node --test tests\endgames.test.mjs
```

Expected: pass with all ten lessons legal.

### Task 3: Full Verification

**Files:**
- No additional files.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
node --test tests\endgames.test.mjs tests\trainer-core.test.mjs tests\installer.test.mjs tests\server.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Check local service**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\start-trainer.ps1'
Start-Sleep -Seconds 1
Invoke-WebRequest -UseBasicParsing http://localhost:8788/endgames.js
```

Expected: HTTP 200.

### Self-Review

- Spec coverage: this adds a next batch and explicitly checks black/white perspective.
- Placeholder scan: lesson 2 and Van der Wiel lessons must not be implemented until their UCI lines are verified; the plan makes that a blocking step rather than allowing guessed content.
- Type consistency: `orientation` remains `w` or `b`, matching FEN side to move.
