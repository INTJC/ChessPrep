# Board Drag Interaction Design

## Goal

Upgrade the chessboard input so it supports Lichess-like click-to-move and pointer drag-to-move across opening training, endgame training, and engine sparring.

## Scope

- Keep the existing move validation paths for opening, endgame, and engine modes.
- Add a single board input layer that converts both click and drag actions into a `from` square and a `to` square.
- Improve click feedback: selecting a playable piece highlights the source square and shows legal destination dots before the move is attempted.
- Support mouse and touch through pointer events.
- Cancel cleanly when a drag ends outside the board or on an invalid target.
- Sync the installer package after frontend changes.

## Interaction

Click-to-move:

- First click on a playable own-side piece selects it.
- Clicking another playable own-side piece switches selection to that piece.
- Clicking the selected square cancels selection.
- Clicking a destination square attempts the move through the existing training validator.
- While selected, legal destination squares are shown with Lichess-like dots or capture rings.

Drag-to-move:

- Pointer down on a playable own-side piece starts a potential drag and selects that piece.
- Once movement passes a small threshold, the piece follows the pointer in a floating layer and the source piece is hidden.
- Pointer up over a board square attempts that move through the same validator used by click-to-move.
- Pointer up outside the board cancels without changing the position.
- Dragging is disabled while the engine is thinking or when the current mode is not accepting user input.

## Architecture

`app.js` gets small pure helpers for board input state:

- determine whether a square has a playable piece in the current mode.
- compute legal destinations from the current FEN for visual hints.
- resolve a pointer event into a board square.
- convert a `from`/`to` pair into the same attempt flow used by clicks.

The existing mode-specific validators remain the source of truth. The new input layer should not duplicate opening repertoire checks, endgame step checks, or free engine legal-move checks.

`styles.css` gets visual classes for selected pieces, destination hints, drag source hiding, and the floating dragged piece.

## Testing

- Unit tests cover legal destination hint generation for a selected piece.
- Unit tests cover click behavior switching selection when another playable own-side piece is clicked.
- Static installer tests confirm pointer-event drag handlers and drag CSS are present and synced.
- Existing endgame, trainer core, installer, and server tests must stay green.
