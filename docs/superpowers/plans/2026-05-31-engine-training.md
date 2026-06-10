# Engine Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-panel engine training mode that starts from the current repertoire position and lets the user continue against Stockfish strong mode or Stockfish-limited humanized Elo profiles from 2200 to 2700.

**Architecture:** Keep the browser app dependency-light and route engine calls through the existing Node local server. `app.js` owns profile metadata, legal UCI move application, UI state, and `/engine-move` calls. `server.mjs` owns Stockfish executable discovery, UCI protocol orchestration, and JSON responses.

**Tech Stack:** Vanilla HTML/CSS/JS ES modules, Node `http`, Node `child_process.spawn`, UCI chess engine protocol, Node `node:test`.

---

## File Structure

- Modify `app.js`: add engine profiles, UCI output parsing helpers, legal UCI move application, engine training state, and UI event handlers.
- Modify `server.mjs`: add `POST /engine-move`, Stockfish executable discovery, UCI command flow, and JSON errors.
- Modify `index.html`: add the "拟人训练" card under the right training controls.
- Modify `styles.css`: style the engine card, profile buttons, and active/thinking states.
- Modify `tests/trainer-core.test.mjs`: test engine profile metadata, FEN normalization, UCI parsing, humanized move selection, and legal UCI application.
- Modify `tests/server.test.mjs`: test engine executable discovery without launching a real engine.
- Modify `README.md`: document Stockfish setup and the Maia-3 boundary.

## Tasks

- [ ] Write failing tests for engine profiles and UCI helpers in `tests/trainer-core.test.mjs`.
- [ ] Run `node --test tests\trainer-core.test.mjs` and confirm the new tests fail because exports are missing.
- [ ] Implement engine profile helpers, UCI output parsing, humanized selection, and legal UCI move application in `app.js`.
- [ ] Run `node --test tests\trainer-core.test.mjs` and confirm the tests pass.
- [ ] Write failing tests for Stockfish discovery in `tests/server.test.mjs`.
- [ ] Run `node --test tests\server.test.mjs` and confirm the new tests fail because discovery is missing.
- [ ] Implement `/engine-move`, executable discovery, and UCI orchestration in `server.mjs`.
- [ ] Add the right-panel "拟人训练" HTML and CSS.
- [ ] Wire browser state so the user can start from the current FEN, play legal moves freely, and receive engine replies.
- [ ] Update `README.md` with local Stockfish setup instructions and current Maia-3 limitations.
- [ ] Run `node --test tests\server.test.mjs tests\trainer-core.test.mjs`.
