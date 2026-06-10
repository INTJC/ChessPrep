# Board Drag Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Lichess-like click feedback and pointer drag-to-move to the shared chessboard.

**Architecture:** Keep the existing mode-specific move validators as the source of truth. Add small board-input helpers in `app.js` so click and drag both resolve to the same `from` and `to` move attempt. Add CSS for selected squares, legal destination dots, capture rings, drag ghost, and hidden drag source.

**Tech Stack:** Browser JavaScript modules, Pointer Events, CSS, Node `node:test`.

---

### Task 1: Pure Board Input Helpers

**Files:**
- Modify: `app.js`
- Test: `tests/trainer-core.test.mjs`

- [ ] **Step 1: Write failing tests**

Add imports:

```js
  boardInputReducer,
  getLegalDestinationSquares,
```

Add tests:

```js
test('getLegalDestinationSquares returns legal targets for selected pieces', () => {
  assert.deepEqual(getLegalDestinationSquares('8/8/8/8/8/8/4P3/4K3 w - - 0 1', 'e2'), ['e3', 'e4']);
  assert.deepEqual(getLegalDestinationSquares('8/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4'), ['d5', 'e5']);
});

test('boardInputReducer switches selected pieces and attempts destinations', () => {
  const canSelect = (square) => ['e2', 'g1'].includes(square);

  assert.deepEqual(boardInputReducer(null, 'e2', canSelect), { selected: 'e2', attempt: null });
  assert.deepEqual(boardInputReducer('e2', 'g1', canSelect), { selected: 'g1', attempt: null });
  assert.deepEqual(boardInputReducer('e2', 'e2', canSelect), { selected: null, attempt: null });
  assert.deepEqual(boardInputReducer('e2', 'e4', canSelect), { selected: null, attempt: { from: 'e2', to: 'e4' } });
});
```

- [ ] **Step 2: Verify red**

Run: `node --test .\tests\trainer-core.test.mjs`

Expected: fail because `boardInputReducer` and `getLegalDestinationSquares` are not exported.

- [ ] **Step 3: Implement helpers**

Add exported functions in `app.js` near `boardSquareColor`:

```js
export function getLegalDestinationSquares(fen, fromSquare) {
  const chessState = parseFen(fen);
  const from = squareToIndex(fromSquare);
  return generateLegalMoves(chessState)
    .filter((move) => move.from === from)
    .map((move) => indexToSquare(move.to))
    .sort();
}

export function boardInputReducer(selected, square, canSelectSquare) {
  if (!selected) {
    return canSelectSquare(square)
      ? { selected: square, attempt: null }
      : { selected: null, attempt: null };
  }

  if (selected === square) {
    return { selected: null, attempt: null };
  }

  if (canSelectSquare(square)) {
    return { selected: square, attempt: null };
  }

  return { selected: null, attempt: { from: selected, to: square } };
}
```

- [ ] **Step 4: Verify green**

Run: `node --test .\tests\trainer-core.test.mjs`

Expected: all trainer-core tests pass.

### Task 2: Shared Click Attempt Path

**Files:**
- Modify: `app.js`
- Test: `tests/installer.test.mjs`

- [ ] **Step 1: Write failing static test**

Add to `tests/installer.test.mjs`:

```js
test('board input uses shared from-to attempts and Lichess-like click switching', () => {
  const app = readProjectFile('app.js');

  assert.match(app, /function attemptMoveFromSquares\(from,\s*to\)/);
  assert.match(app, /boardInputReducer\(state\.selected,\s*square,\s*canSelectBoardSquare\)/);
  assert.match(app, /getLegalDestinationSquares\(state\.currentFen,\s*state\.selected\)/);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test .\tests\installer.test.mjs`

Expected: fail because shared attempt path is missing.

- [ ] **Step 3: Refactor click handling**

Add `canSelectBoardSquare(square)` in browser code. It should return true only when the square has a piece of the side currently allowed to move:

- opening repertoire mode: `state.trainer` exists, engine inactive, and `sameSideToMove(state.currentFen, state.side)`.
- endgame lesson mode: current side to move from `state.currentFen`.
- engine sparring mode: engine active, not thinking, and piece color equals `state.side`.

Add `attemptMoveFromSquares(from, to)` and route it to opening, endgame, or engine mode. Keep the old mode-specific validation bodies by changing `attemptSquare` to:

```js
function attemptSquare(square) {
  const next = boardInputReducer(state.selected, square, canSelectBoardSquare);
  state.selected = next.selected;
  if (next.attempt) {
    attemptMoveFromSquares(next.attempt.from, next.attempt.to);
    return;
  }
  render();
}
```

- [ ] **Step 4: Verify green**

Run: `node --test .\tests\installer.test.mjs .\tests\trainer-core.test.mjs`

Expected: tests pass.

### Task 3: Pointer Drag Input and Visuals

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/installer.test.mjs`

- [ ] **Step 1: Write failing static test**

Add to `tests/installer.test.mjs`:

```js
test('board supports pointer drag move input with drag visuals', () => {
  const app = readProjectFile('app.js');
  const css = readProjectFile('styles.css');

  assert.match(app, /pointerdown/);
  assert.match(app, /pointermove/);
  assert.match(app, /pointerup/);
  assert.match(app, /function beginBoardDrag/);
  assert.match(app, /function finishBoardDrag/);
  assert.match(css, /\.piece-drag-ghost/);
  assert.match(css, /\.square\.drag-source/);
  assert.match(css, /\.square\.legal-target/);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test .\tests\installer.test.mjs`

Expected: fail because drag handlers and CSS are missing.

- [ ] **Step 3: Implement drag state**

Add `state.drag` with `active`, `from`, `piece`, `pointerId`, `startX`, `startY`, `x`, `y`, and `dragging`.

Add `beginBoardDrag(event, square, piece)`, `updateBoardDrag(event)`, `finishBoardDrag(event)`, `cancelBoardDrag()`, and `squareFromPoint(x, y)` in browser code.

In `renderBoard`, add pointer event listeners to occupied squares and render a floating `.piece-drag-ghost` when `state.drag.dragging` is true.

- [ ] **Step 4: Add CSS**

Add styles:

```css
.board {
  touch-action: none;
}

.square.legal-target::after {
  content: "";
  position: absolute;
  width: 32%;
  height: 32%;
  border-radius: 999px;
  background: rgba(23, 33, 29, 0.28);
}

.square.legal-target.occupied::after {
  inset: 7%;
  width: auto;
  height: auto;
  border: 5px solid rgba(23, 33, 29, 0.28);
  background: transparent;
}

.square.drag-source .piece {
  opacity: 0;
}

.piece-drag-ghost {
  position: fixed;
  z-index: 30;
  width: var(--drag-piece-size, 64px);
  height: var(--drag-piece-size, 64px);
  pointer-events: none;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 14px 18px rgba(0, 0, 0, 0.28));
}
```

- [ ] **Step 5: Verify green**

Run: `node --test .\tests\installer.test.mjs`

Expected: installer tests pass.

### Task 4: Sync and Full Verification

**Files:**
- Modify: `installer/package/app/app.js`
- Modify: `installer/package/app/styles.css`

- [ ] **Step 1: Sync frontend files**

Run:

```powershell
Copy-Item -LiteralPath app.js -Destination installer\package\app\app.js -Force
Copy-Item -LiteralPath styles.css -Destination installer\package\app\styles.css -Force
```

- [ ] **Step 2: Run full tests**

Run:

```powershell
node --test .\tests\endgames.test.mjs .\tests\trainer-core.test.mjs .\tests\installer.test.mjs .\tests\server.test.mjs
```

Expected: all tests pass.

- [ ] **Step 3: Smoke check local page assets**

Run:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:8788/app.js).Content.Contains('pointerdown')
(Invoke-WebRequest -UseBasicParsing http://localhost:8788/styles.css).Content.Contains('piece-drag-ghost')
```

Expected: both return `True`.
