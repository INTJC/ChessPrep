# Prebuilt Offline Player Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual opponent PGN import with a prebuilt local offline-game database so the user only enters a player name and side to generate a preparation report.

**Architecture:** Add a builder module that scans known public offline PGN source folders and writes the compact store. Add server endpoints for database status and build/update. Change the UI so Prep Mode shows database status plus query controls, not an opponent PGN import textarea.

**Tech Stack:** Node ESM, built-in `node:test`, existing compact store modules, browser `fetch`, plain HTML/CSS.

---

### Task 1: Database Builder

**Files:**
- Create: `tools/player-prep/database-builder.mjs`
- Create/modify: `tests/player-prep-builder.test.mjs`

- [ ] Write tests for source discovery, status reporting, and building from multiple PGN files.
- [ ] Verify tests fail because builder is missing.
- [ ] Implement `discoverOfflinePgnSources`, `getOfflineDatabaseStatus`, and `buildOfflineDatabase`.
- [ ] Verify builder tests pass.

### Task 2: Server Status and Build Endpoints

**Files:**
- Modify: `server.mjs`
- Modify: `tests/server.test.mjs`

- [ ] Replace frontend-facing manual import endpoint with `/prep-database-status` and `/prep-database-build`.
- [ ] Keep `/prep-report` using the compact store.
- [ ] Verify server tests pass.

### Task 3: Frontend Query-Only Prep Mode

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `i18n.js`
- Modify: `styles.css`
- Modify: `tests/installer.test.mjs`

- [ ] Remove the user-facing opponent PGN textarea and upload controls.
- [ ] Add database status, source count, game count, build/update button, opponent name, side, and report button.
- [ ] Wire status/build/report calls.
- [ ] Verify frontend tests pass.

### Task 4: Build Local Compact Database

**Files/Data:**
- Generate: `data/player-prep/offline-games.json`
- Generate: `data/player-prep/offline-games.bin`

- [ ] Run builder against current broadcast PGN sources.
- [ ] Confirm filters are applied: post-2010 and both Elo > 2000.
- [ ] Report final compact database size and game count.

### Task 5: Package Sync and Verification

**Files:**
- Modify/copy: `installer/package/app/*`

- [ ] Sync changed app files and `tools/player-prep` modules.
- [ ] Run full test suite.
- [ ] Restart local server and smoke-test status/report endpoints.
