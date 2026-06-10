# Endgame 300 Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-level endgame course of about 300 total lessons, including the existing book lessons, with no more than 12 categories, original analysis, full source metadata, legal move replay, and no split-continuation duplicates.

**Architecture:** Keep all new content outside `endgames.js` until the full set passes validation. Add a course-audit tool that treats website lessons and offline expansion drafts as one future course, then promote analyzed drafts into formal candidates, continue legal PGN intake only from approved sources, and import the full course only after all gates pass.

**Tech Stack:** Static JavaScript modules, Node built-in test runner, local `app.js` chess move engine, local Stockfish verification tools.

---

### File Structure

- Modify `docs/endgame-expansion/standards.md`: keep this as the course contract; add any stricter gates discovered during execution.
- Create `tools/endgame-expansion/audit-course-target.mjs`: summarize existing website lessons, analyzed drafts, rejected drafts, source metadata gaps, category counts, duplicate-continuation risks, and remaining count toward 300.
- Modify `tests/endgame-expansion-tools.test.mjs`: TDD coverage for the audit tool and later promotion/import helpers.
- Create `tools/endgame-expansion/promote-drafts-to-candidates.mjs`: convert `analysis-draft` items into candidate lesson JSON with `complexityScore`, source metadata, `playerQualityReason`, and final FEN.
- Modify `tools/endgame-expansion/validate-candidates.mjs`: add stronger checks for source game metadata, original analysis specificity, final count mode, and candidate/category interaction with existing website lessons.
- Create `data/endgame-expansion/candidates/*.json`: formal offline candidate files only after draft validation passes.
- Modify `endgames.js`: final import only after all offline validation gates pass.
- Modify `tests/endgames.test.mjs`: update expected final counts/categories and keep legal replay/continuation duplicate tests.
- Modify `installer/package/app/endgames.js` and installer package only after the site dataset is finalized.

### Task 1: Course Audit Baseline

- [ ] **Step 1: Write failing audit tests**

Add tests in `tests/endgame-expansion-tools.test.mjs` for an exported `auditCourseTarget()` that accepts `siteLessons`, `siteCategories`, `drafts`, `targetCount`, and `maxCategories`.

Expected assertions:

```js
const result = auditCourseTarget({
  siteCategories: [{ id: 'rook-activity' }, { id: 'queen-endgames' }],
  siteLessons: [
    {
      id: 'site-1',
      category: 'rook-activity',
      fen: '8/8/8/8/8/8/R7/K6k w - -',
      orientation: 'w',
      source: { game: 'A-B, Event 2020', white: 'A', black: 'B', event: 'Event', date: '2020.01.01' },
      teaching: { principle: 'x'.repeat(40), method: 'y'.repeat(70), mistake: 'z'.repeat(40) },
      hints: ['one', 'two'],
      steps: [{ move: 'a2a8' }]
    }
  ],
  drafts: [
    {
      id: 'draft-1',
      importStatus: 'analysis-draft',
      category: 'queen-endgames',
      fen: '8/8/8/8/8/8/1R6/K6k w - -',
      orientation: 'w',
      source: { white: 'C', black: 'D', event: 'Event', date: '2021.01.01' },
      teaching: { principle: 'p'.repeat(40), method: 'm'.repeat(70), mistake: 'e'.repeat(40) },
      hints: ['one', 'two'],
      steps: [{ move: 'b2b8' }]
    },
    { id: 'draft-bad', importStatus: 'draft-not-ready', category: 'rook-activity' }
  ],
  targetCount: 3,
  maxCategories: 12
});

assert.equal(result.counts.siteLessons, 1);
assert.equal(result.counts.analyzedDrafts, 1);
assert.equal(result.counts.totalReady, 2);
assert.equal(result.counts.remainingToTarget, 1);
assert.equal(result.counts.todoDrafts, 1);
assert.equal(result.valid, true);
```

- [ ] **Step 2: Run red test**

Run:

```powershell
node --test tests\endgame-expansion-tools.test.mjs
```

Expected: fail because `tools/endgame-expansion/audit-course-target.mjs` does not exist.

- [ ] **Step 3: Implement audit tool**

Create `tools/endgame-expansion/audit-course-target.mjs` exporting:

```js
export function auditCourseTarget({
  siteLessons = [],
  siteCategories = [],
  drafts = [],
  targetCount = 300,
  maxCategories = 12
} = {}) { /* implementation */ }
```

The tool must count analyzed drafts, rejected drafts, TODO drafts, category distribution, metadata gaps, duplicate ids, duplicate `fen + first move`, and any lesson/draft starting inside another main line.

- [ ] **Step 4: Run green test**

Run:

```powershell
node --test tests\endgame-expansion-tools.test.mjs
```

Expected: all expansion-tool tests pass.

### Task 2: Current Course Gap Report

- [ ] **Step 1: Run the audit tool on real data**

Run:

```powershell
node .\tools\endgame-expansion\audit-course-target.mjs
```

Expected: report the current ready total, category distribution, remaining count, and metadata gaps.

- [ ] **Step 2: Update progress report**

Append the audit result to `data/endgame-expansion/reports/progress-2026-06-03.md` under a new "Course Target Audit" section.

### Task 3: Promote Analyzed Drafts

- [ ] **Step 1: Write failing promotion tests**

Add tests for `promoteDraftsToCandidates()` requiring:

- only `analysis-draft` items are promoted;
- `rejected-strict-standard` and `draft-not-ready` are skipped;
- `finalFen` is calculated by legal replay;
- `complexityScore` defaults to the scan/review score when available and otherwise to 8;
- source metadata contains `white`, `black`, `event`, `date`, `result`.

- [ ] **Step 2: Implement promotion tool**

Create `tools/endgame-expansion/promote-drafts-to-candidates.mjs` and output `data/endgame-expansion/candidates/pgnmentor-analyzed-drafts.json`.

- [ ] **Step 3: Validate promoted candidates**

Run:

```powershell
node .\tools\endgame-expansion\validate-candidates.mjs
node .\tools\endgame-expansion\audit-course-target.mjs
```

Expected: candidate validation passes and audit shows site 91 + promoted 139 ready lessons.

### Task 4: Fill Remaining High-Quality Lessons

- [ ] **Step 1: Re-scan approved local PGN sources**

Use only source registry entries with approved access methods. For local PGN Mentor files, scan deeper with balanced caps and one candidate per source game.

- [ ] **Step 2: Select balanced batches**

Prioritize underfilled categories: `rook-minor-activity`, `pawn-race-transitions`, `fortress-defense`, `conversion-under-counterplay`, `king-activity`, and underfilled rook categories.

- [ ] **Step 3: Evaluate with Stockfish**

Run the local evaluator at depth sufficient for triage. Treat engine output as verification only.

- [ ] **Step 4: Write original analysis**

Each accepted lesson gets human explanatory fields: principle, method, mistake, hints, and critical step notes. Reject simple technique, one-move tactics, unclear provenance, and adjacent continuations.

- [ ] **Step 5: Repeat audit**

Repeat until the ready total is near 300 and categories are at most 12.

### Task 5: Rewrite Existing Website Lessons Metadata

- [ ] **Step 1: Add tests for source normalization**

Require every website lesson to expose either a structured source with `white`, `black`, `event`, `date`, or a documented `source.needsStructuredMetadata` flag for book study positions.

- [ ] **Step 2: Normalize source records**

Parse existing `source.game` strings into structured fields where unambiguous; manually mark study positions.

- [ ] **Step 3: Re-audit original analysis**

Flag weak teaching text, copied-looking text, missing defender resources, and missing plausible mistake explanations.

### Task 6: Final Import

- [ ] **Step 1: Add final count/category tests**

Set final tests to require:

- lesson count between 285 and 305;
- category count <= 12;
- no basic-technique category;
- all source metadata and legal replay checks pass.

- [ ] **Step 2: Generate `endgames.js` import**

Merge existing lessons and approved candidates into `endgames.js`, preserving current trainer API.

- [ ] **Step 3: Run full verification**

Run:

```powershell
node --test .\tests\endgame-expansion-tools.test.mjs
node --test .\tests\trainer-core.test.mjs .\tests\endgames.test.mjs .\tests\installer.test.mjs .\tests\server.test.mjs
node .\tools\endgame-expansion\validate-candidates.mjs
node .\tools\endgame-expansion\audit-course-target.mjs
```

Expected: all pass before website import is considered complete.
