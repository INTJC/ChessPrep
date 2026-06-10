# Elite Endgame And Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the endgame course under verifiable 2650+ classical evidence before regenerating the demo video with cleaner subtitles and no lower-left badge.

**Architecture:** Enforce hard, locally verifiable gates in the PGN scanner, course rebuild, candidate validation, and public endgame tests. Treat missing proof as failure, and record unprovable requirements such as GM manual review as audit gaps rather than pretending they passed.

**Tech Stack:** Node.js test runner and endgame pipeline, Stockfish evaluation reports, Python Playwright/FFmpeg demo video generator.

---

### Task 1: Lock Elite Endgame Evidence Tests

**Files:**
- Modify: `tests/endgame-expansion-tools.test.mjs`
- Modify: `tests/endgames.test.mjs`
- Modify: `tests/demo-video.test.mjs`

- [ ] Add failing tests for both players having standard Elo >= 2650, classical/non-rapid event filters, clock evidence >= 15 minutes at the selected start, explicit start evaluation/depth, and strict scanner defaults.
- [ ] Add failing tests that the published 300 lessons expose `source.whiteElo`, `source.blackElo`, `source.timeControl`, `audit.engineDepth`, and `audit.startClockSeconds`.
- [ ] Add failing video tests for removing the lower-left demo badge, using forced-alignment subtitle inputs, and raising subtitle legibility.
- [ ] Run targeted tests and confirm they fail for the current implementation.

### Task 2: Implement Verifiable Endgame Gates

**Files:**
- Modify: `tools/endgame-expansion/scan-pgn-endgames.mjs`
- Modify: `tools/endgame-expansion/rebuild-strict-endgame-course.mjs`
- Modify: `tools/endgame-expansion/validate-candidates.mjs`

- [ ] Export helper functions for numeric Elo, event class filtering, endgame material profile, PGN clock extraction, and gate checks.
- [ ] Change `--strict-elite` to require both players >= 2650 and prefer 2700+ pairings without allowing a sub-2650 opponent.
- [ ] Preserve source ratings, time control, variant, and start clock/eval evidence on each candidate and final lesson.
- [ ] Reject lessons lacking local evidence for the user’s hard requirements.
- [ ] Record unverified manual GM review / 40-50 ply line verification as explicit audit gaps.

### Task 3: Rebuild To Target 300

**Files:**
- Modify: `data/endgame-expansion/candidates/strict-endgame-course.json`
- Modify: `endgame-expansion-lessons.js`
- Modify: `app.js`
- Modify: `installer/package/app/*` synced frontend assets

- [ ] Rescan or reuse eligible source reports under the new gates.
- [ ] Rebuild the strict course at target 300, or stop with a concrete shortfall report if the local source corpus cannot prove 300.
- [ ] Export the course module and update the default demo lesson to a valid elite lesson.
- [ ] Sync installer package assets.

### Task 4: Fix Demo Video After Endgames Pass

**Files:**
- Modify: `tools/demo-video/make-demo-video.py`

- [ ] Remove lower-left injected demo badge/title block from the recording script.
- [ ] Generate speech/subtitle timing as forced-aligned segments rather than scene-weighted estimates.
- [ ] Improve subtitle contrast and size without blocking the board.
- [ ] Regenerate the final video only after endgame tests and candidate validation pass.

### Task 5: Verify

**Files:**
- No code changes.

- [ ] Run `node --test tests\endgame-expansion-tools.test.mjs tests\endgames.test.mjs tests\demo-video.test.mjs`.
- [ ] Run `node tools\endgame-expansion\validate-candidates.mjs`.
- [ ] Run `node --test tests\*.mjs`.
- [ ] Regenerate video and extract sample frames for visual checks.
