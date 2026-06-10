# ChessPrep Lab Design

## Goal

Build a polished browser-based opening trainer for personal Lichess study preparation. The user can import study content, practice prepared lines on an interactive board, and receive immediate feedback when a move is outside the prepared repertoire.

## Scope

The first version is a static single-page web app that runs locally in the browser. It supports:

- PGN paste import.
- `.pgn` file upload.
- Public Lichess study URL import by extracting the study id and fetching exported PGN.
- Study parsing into an opening tree that includes main lines and variations.
- Training as White or Black.
- Opponent replies chosen randomly from prepared branches.
- Wrong-move detection, correction prompts, answer reveal, retry, reset, and next-line controls.
- Progress statistics including accuracy, streak, mistakes, and covered positions.

Private Lichess studies are supported through PGN paste or upload. The app will not request or store Lichess account tokens.

## Architecture

The app is static and can be served by a lightweight local HTTP server:

- `index.html`: application shell and semantic layout.
- `styles.css`: responsive visual system and board styling.
- `app.js`: application state, PGN import, training flow, UI rendering, and event handling.

The implementation will use browser-side JavaScript and CDN-loaded chess libraries where practical:

- `chess.js` for legal move validation, FEN state, SAN conversion, and move execution.
- A small custom PGN tokenizer/parser for main lines and parentheses variations, or a library if available without a build step.
- Drag/click board interaction implemented directly in the page to keep the project dependency-light.

No backend is required. URL import uses `fetch` against Lichess public export endpoints and shows a fallback path if CORS, network access, or privacy settings prevent import.

## Data Model

Imported PGN becomes an opening tree.

Each tree node represents one board position and stores:

- FEN key for the position.
- Candidate prepared moves from that position.
- Parent and child relationships.
- Metadata such as chapter/study title when available.
- Simple performance data for the current browser session.

Moves are stored with UCI, SAN, origin square, target square, optional promotion, and child node reference. UCI is used for move comparison; SAN is used for user-facing labels.

## Training Flow

The user imports content, selects side, and starts a session.

During training:

1. The app loads a start position from the repertoire tree.
2. If it is the opponent's turn, the app randomly chooses one prepared move from the node and plays it.
3. If it is the user's turn, the app waits for a board move.
4. If the move matches a prepared candidate, it is accepted and training continues.
5. If the move is not prepared, the app rejects it, highlights the board, records a mistake, and shows the correct candidate moves.
6. The user can retry, reveal one answer, reset the line, or move to another random line.

Opponent randomization is weighted evenly across available prepared branches. This gives broad coverage and avoids always testing only the main line.

## Interface

The app is a focused training workbench:

- Left panel: import controls, study status, side selection, chapter/line summary.
- Center: large chess board with coordinates, last-move highlight, legal selection states, and feedback flashes.
- Right panel: current task, candidate moves after mistakes, session stats, and quick actions.
- Bottom area: compact move history and branch context.

The visual direction should feel refined and tool-like: restrained dark UI, warm board colors, high-contrast feedback, tight spacing, and no marketing-style landing page. The first viewport is the usable trainer.

Responsive behavior:

- Desktop: three-column workbench.
- Tablet/mobile: board-first stacked layout with collapsible import and stats sections.

## Error Handling

Import errors are explicit and actionable:

- Empty PGN: ask user to paste or upload valid content.
- Invalid PGN: show where parsing stopped when possible.
- URL not recognized: ask for a Lichess study URL.
- Public URL fetch failed: explain that private studies or CORS/network restrictions may require PGN paste/upload.
- Study has no playable moves: tell user the import succeeded but no repertoire lines were found.

Training errors preserve state and offer recovery. Wrong moves do not corrupt the line; they are rejected and the board remains on the current position.

## Verification

Manual verification will cover:

- Importing sample PGN with main line and variations.
- Parsing multiple chapters from one PGN.
- Training as White and Black.
- Random opponent branch choice from a multi-variation position.
- Wrong-move rejection and correct candidate display.
- Reset, answer reveal, and next-line controls.
- Desktop and mobile viewport layout.
- Public Lichess URL import fallback behavior.
