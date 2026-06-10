# Offline Player Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local offline-player preparation mode that imports compact PGN data, filters games to post-2010 and both players over 2000 Elo, compares an opponent's official-game opening habits against the user's current preparation, and presents actionable prep targets.

**Architecture:** Keep compact storage and report generation in focused Node modules under `tools/player-prep/`, expose server endpoints from `server.mjs`, then add a third UI mode in `index.html`/`app.js`. Store metadata JSON and move bytes separately so large PGN libraries are not re-parsed for every query.

**Tech Stack:** Node ESM, built-in `node:test`, existing chess PGN replay helpers from `app.js`, browser `fetch`, plain HTML/CSS.

---

### Task 1: Compact Import Filters

**Files:**
- Modify: `tools/player-prep/compact-games.mjs`
- Modify: `tests/compact-games.test.mjs`

- [ ] Add tests that verify PGN games before 2010 are rejected, games with either Elo <= 2000 are rejected, and accepted games retain compact move bytes.
- [ ] Run `node --test tests\\compact-games.test.mjs` and verify the new tests fail before implementation.
- [ ] Add `isEligibleOfflineGame(headers, options)` and use it inside `collectCompactGameBatch` before replaying moves.
- [ ] Run `node --test tests\\compact-games.test.mjs` and verify all compact tests pass.

### Task 2: Persistent Compact Store

**Files:**
- Create: `tools/player-prep/offline-store.mjs`
- Create: `tests/player-prep-store.test.mjs`

- [ ] Test that `buildOfflineStoreFromPgn()` writes `offline-games.json` and `offline-games.bin` with only eligible games.
- [ ] Test that `loadOfflineStore()` can decode stored moves for a selected game without PGN text.
- [ ] Run `node --test tests\\player-prep-store.test.mjs` and verify failure because the module is missing.
- [ ] Implement the store writer/loader using compact batches.
- [ ] Run `node --test tests\\player-prep-store.test.mjs tests\\compact-games.test.mjs` and verify pass.

### Task 3: Opponent Opening Tree and Report Classification

**Files:**
- Create: `tools/player-prep/prep-report.mjs`
- Create: `tests/prep-report.test.mjs`

- [ ] Test that an opponent tree counts only games where the opponent plays the requested side.
- [ ] Test classifications: unseen prepared move, weak-performance prepared move, low-sample move, and prep gap.
- [ ] Run `node --test tests\\prep-report.test.mjs` and verify failure.
- [ ] Implement tree generation from stored UCI move bytes using `playLegalUciMove`.
- [ ] Implement `buildPrepReport({ store, opponent, ourSide, prepPgn, maxPly })`.
- [ ] Run `node --test tests\\prep-report.test.mjs` and verify pass.

### Task 4: Server Endpoints

**Files:**
- Modify: `server.mjs`
- Modify: `tests/server.test.mjs`

- [ ] Test server source exposes `/offline-pgn-import` and `/prep-report` handlers and has a larger body limit for PGN imports.
- [ ] Add handlers for POST import and POST report.
- [ ] Import store/report modules and return JSON summaries.
- [ ] Run `node --test tests\\server.test.mjs tests\\player-prep-store.test.mjs tests\\prep-report.test.mjs` and verify pass.

### Task 5: Frontend Prep Mode

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `i18n.js`
- Modify: `styles.css`
- Modify: `tests/installer.test.mjs`
- Modify: `tests/trainer-core.test.mjs`

- [ ] Add HTML for mode button, import form, opponent/side form, and report list.
- [ ] Add i18n keys for Chinese and English.
- [ ] Add app state, refs, event handlers, and render logic for prep mode.
- [ ] Test source contains prep mode controls and client fetches both endpoints.
- [ ] Run frontend/source tests and verify pass.

### Task 6: Package Sync and Full Verification

**Files:**
- Modify/copy: `installer/package/app/*` matching changed runtime files

- [ ] Copy changed runtime files into `installer/package/app`.
- [ ] Run `node --test tests\\trainer-core.test.mjs tests\\server.test.mjs tests\\installer.test.mjs tests\\compact-games.test.mjs tests\\player-prep-store.test.mjs tests\\prep-report.test.mjs`.
- [ ] Start the local server if needed and check `http://localhost:8788` loads.
