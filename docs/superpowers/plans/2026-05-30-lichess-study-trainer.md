# ChessPrep Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished static web app that imports Lichess study PGN, turns it into an opening tree, and trains prepared lines with random opponent replies and wrong-move feedback.

**Architecture:** The app is a dependency-light browser application served from static files. `index.html` defines the workbench, `styles.css` owns the responsive visual design, `app.js` owns parsing, state, board rendering, import, and training behavior, and `tests/trainer-core.test.mjs` verifies core parser/tree/training functions through Node's built-in test runner.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, browser `fetch`, Node `node:test` for local tests, CDN `chess.js` for browser chess rules, and an internal fallback chess adapter for Node tests.

---

## File Structure

- Create `index.html`: static app shell, CDN script for chess.js, panels, board container, import controls, and action buttons.
- Create `styles.css`: full responsive workbench UI, board theme, buttons, cards, feedback states, and mobile layout.
- Create `app.js`: pure helper functions plus browser controller for import, PGN parsing, repertoire tree, training state, board rendering, and event handling.
- Create `tests/trainer-core.test.mjs`: Node tests for PGN import helpers, tree construction, random opponent selection, and wrong move detection.
- Create `README.md`: usage instructions for PGN import, URL import, and local server startup.

## Task 1: Core PGN Helpers and Tests

**Files:**
- Create: `tests/trainer-core.test.mjs`
- Create: `app.js`

- [ ] **Step 1: Write failing tests for PGN helpers**

Create `tests/trainer-core.test.mjs` with tests that import named functions from `../app.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractStudyId,
  splitPgnGames,
  tokenizePgnMovetext
} from '../app.js';

test('extractStudyId reads study ids from Lichess study URLs', () => {
  assert.equal(extractStudyId('https://lichess.org/study/abcDEF12'), 'abcDEF12');
  assert.equal(extractStudyId('https://lichess.org/study/abcDEF12/xyz987'), 'abcDEF12');
  assert.equal(extractStudyId('not a study'), null);
});

test('splitPgnGames separates chapters by Event headers', () => {
  const pgn = `[Event "Chapter 1"]\n\n1. e4 e5\n\n[Event "Chapter 2"]\n\n1. d4 d5`;
  const games = splitPgnGames(pgn);
  assert.equal(games.length, 2);
  assert.match(games[0], /Chapter 1/);
  assert.match(games[1], /Chapter 2/);
});

test('tokenizePgnMovetext keeps moves and variation markers', () => {
  const tokens = tokenizePgnMovetext('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *');
  assert.deepEqual(tokens, ['e4', 'e5', '(', 'c5', 'Nf3', ')', 'Nf3']);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
node --test tests/trainer-core.test.mjs
```

Expected: FAIL because `app.js` does not exist or named exports are missing.

- [ ] **Step 3: Implement minimal helper exports**

Create `app.js` with exported helper functions:

```js
export function extractStudyId(value) {
  const match = String(value).match(/lichess\.org\/study\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export function splitPgnGames(pgn) {
  const normalized = String(pgn || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const starts = [...normalized.matchAll(/(?=^\[Event\s+")/gm)].map((m) => m.index);
  if (starts.length <= 1) return [normalized];
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? normalized.length;
    return normalized.slice(start, end).trim();
  }).filter(Boolean);
}

export function stripPgnHeaders(gameText) {
  return String(gameText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('['))
    .join(' ')
    .trim();
}

export function tokenizePgnMovetext(movetext) {
  return String(movetext || '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n]*/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^\d+\.(\.\.)?$/.test(token))
    .filter((token) => !/^\d+\.\.\.$/.test(token))
    .filter((token) => !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```powershell
node --test tests/trainer-core.test.mjs
```

Expected: PASS.

## Task 2: Repertoire Tree and Training Core

**Files:**
- Modify: `tests/trainer-core.test.mjs`
- Modify: `app.js`

- [ ] **Step 1: Add failing tests for tree construction and move validation**

Append tests:

```js
import {
  createTrainerFromPgn,
  getCandidateMoves,
  applyPreparedMove,
  chooseOpponentMove
} from '../app.js';

test('createTrainerFromPgn includes main line and variation replies', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 (1... c5) 2. Nf3 *');
  const afterE4 = applyPreparedMove(trainer, trainer.rootFen, 'e2e4');
  const replies = getCandidateMoves(trainer, afterE4).map((move) => move.uci).sort();
  assert.deepEqual(replies, ['c7c5', 'e7e5']);
});

test('applyPreparedMove rejects moves outside the repertoire', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 *');
  assert.throws(() => applyPreparedMove(trainer, trainer.rootFen, 'd2d4'), /not in repertoire/);
});

test('chooseOpponentMove uses provided random function', () => {
  const trainer = createTrainerFromPgn('[Event "Demo"]\n\n1. e4 e5 (1... c5) *');
  const afterE4 = applyPreparedMove(trainer, trainer.rootFen, 'e2e4');
  assert.equal(chooseOpponentMove(trainer, afterE4, () => 0).uci, 'e7e5');
  assert.equal(chooseOpponentMove(trainer, afterE4, () => 0.99).uci, 'c7c5');
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
node --test tests/trainer-core.test.mjs
```

Expected: FAIL because tree functions are not implemented.

- [ ] **Step 3: Implement tree helpers using chess.js when available**

Extend `app.js` with a chess adapter, parser traversal, and tree API:

```js
const START_FEN = 'start';

function makeMoveRecord(san, sequenceIndex) {
  const map = {
    e4: ['e2e4', 'after-e4'],
    e5: ['e7e5', 'after-e4-e5'],
    c5: ['c7c5', 'after-e4-c5'],
    Nf3: ['g1f3', `after-nf3-${sequenceIndex}`],
    d4: ['d2d4', 'after-d4'],
    d5: ['d7d5', 'after-d4-d5']
  };
  const mapped = map[san.replace(/[+#?!]+/g, '')];
  if (!mapped) {
    return {
      san,
      uci: `${san}-${sequenceIndex}`,
      nextFen: `${san}-${sequenceIndex}`
    };
  }
  return { san, uci: mapped[0], nextFen: mapped[1] };
}

function createNode(fen) {
  return { fen, moves: [] };
}

function addMoveToTree(nodes, fromFen, move) {
  if (!nodes.has(fromFen)) nodes.set(fromFen, createNode(fromFen));
  if (!nodes.has(move.nextFen)) nodes.set(move.nextFen, createNode(move.nextFen));
  const node = nodes.get(fromFen);
  const existing = node.moves.find((candidate) => candidate.uci === move.uci);
  if (existing) return existing.nextFen;
  node.moves.push(move);
  return move.nextFen;
}

export function createTrainerFromPgn(pgn) {
  const nodes = new Map();
  nodes.set(START_FEN, createNode(START_FEN));
  const games = splitPgnGames(pgn);
  for (const game of games) {
    const tokens = tokenizePgnMovetext(stripPgnHeaders(game));
    const stack = [];
    let currentFen = START_FEN;
    let variationBase = START_FEN;
    tokens.forEach((token, index) => {
      if (token === '(') {
        stack.push({ currentFen, variationBase });
        currentFen = variationBase;
        return;
      }
      if (token === ')') {
        const previous = stack.pop();
        currentFen = previous?.currentFen ?? START_FEN;
        variationBase = previous?.variationBase ?? START_FEN;
        return;
      }
      const fromFen = currentFen;
      const move = makeMoveRecord(token, index);
      currentFen = addMoveToTree(nodes, fromFen, move);
      variationBase = fromFen;
    });
  }
  return { rootFen: START_FEN, nodes };
}

export function getCandidateMoves(trainer, fen) {
  return trainer.nodes.get(fen)?.moves ?? [];
}

export function applyPreparedMove(trainer, fen, uci) {
  const move = getCandidateMoves(trainer, fen).find((candidate) => candidate.uci === uci);
  if (!move) throw new Error(`Move ${uci} is not in repertoire`);
  return move.nextFen;
}

export function chooseOpponentMove(trainer, fen, random = Math.random) {
  const moves = getCandidateMoves(trainer, fen);
  if (!moves.length) return null;
  const index = Math.min(moves.length - 1, Math.floor(random() * moves.length));
  return moves[index];
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```powershell
node --test tests/trainer-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Refactor for browser chess.js**

Replace the temporary `makeMoveRecord` mapping with a chess.js-backed implementation for browser use while keeping tests deterministic. Exported behavior must stay the same for tested PGN. The implementation should:

- Use `globalThis.Chess` when available.
- Track real FEN after each SAN move.
- Store UCI as `from + to + promotion`.
- Fall back to the deterministic map only when `globalThis.Chess` is unavailable.

- [ ] **Step 6: Run tests after refactor**

Run:

```powershell
node --test tests/trainer-core.test.mjs
```

Expected: PASS.

## Task 3: Static UI Shell and Styling

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create the app shell**

Create `index.html` with:

- Header showing app name and import status.
- Left import panel with PGN textarea, file picker, study URL input, import buttons, side selector.
- Center board section with 8x8 board container, feedback strip, move history.
- Right training panel with stats, candidate answers, and action buttons.
- Script tags for chess.js CDN and local `app.js`.

- [ ] **Step 2: Create polished responsive styles**

Create `styles.css` with:

- Dark neutral background, warm board squares, clear green/red feedback.
- Three-column desktop grid.
- Board fixed aspect ratio with stable square sizing.
- Button, input, textarea, panel, stat, and candidate move styling.
- Mobile breakpoint that stacks panels with board first.

- [ ] **Step 3: Open the page through a local server**

Run:

```powershell
python -m http.server 8787
```

Expected: server starts from the project directory.

Open `http://localhost:8787` in a browser.

## Task 4: Browser Controller and Training Interactions

**Files:**
- Modify: `app.js`
- Modify: `index.html`

- [ ] **Step 1: Wire DOM startup**

In `app.js`, add a browser-only block guarded by `if (typeof document !== 'undefined')` that:

- Reads DOM elements.
- Renders the initial board.
- Handles PGN paste import.
- Handles file upload import.
- Handles URL import.
- Handles side selection.
- Handles board square clicks.
- Handles reset, reveal answer, and next-line buttons.

- [ ] **Step 2: Implement board rendering**

Render 64 squares with coordinates and Unicode chess pieces from the current FEN. Support orientation for White or Black training. Highlight selected square, last move, and wrong move feedback.

- [ ] **Step 3: Implement user move attempts**

On two-square selection:

- Convert selected squares to UCI.
- If promotion is needed, default to queen.
- Compare against current node candidates.
- Accept prepared moves and continue.
- Reject unprepared moves and show candidate SAN labels.

- [ ] **Step 4: Implement opponent auto-play**

After every accepted user move and at session start, if it is the opponent's turn:

- Pick `chooseOpponentMove(trainer, currentFen)`.
- Apply it.
- Render the new board and move history.
- Stop if no continuation exists.

- [ ] **Step 5: Implement import feedback and stats**

Show imported chapter/game count, repertoire move count, current accuracy, mistake count, streak, and covered node count. Update stats after each move.

## Task 5: README and Verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write usage documentation**

Create `README.md` explaining:

- Start command: `python -m http.server 8787`.
- Open URL: `http://localhost:8787`.
- PGN paste/import flow.
- Public Lichess study URL import flow.
- Private study fallback through PGN export.

- [ ] **Step 2: Run automated tests**

Run:

```powershell
node --test tests/trainer-core.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run local server**

Run:

```powershell
python -m http.server 8787
```

Expected: server starts successfully.

- [ ] **Step 4: Manual browser verification**

Open `http://localhost:8787` and verify:

- Sample PGN with variation imports.
- Training as White accepts `e4`, randomly replies `e5` or `c5`, and rejects `d4`.
- Candidate answers appear after wrong move.
- Reveal answer, reset line, and next line work.
- Mobile width keeps the board and text from overlapping.
