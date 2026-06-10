# Engine Import Design

## Goal

Bundle local engine support into the project so the existing engine training UI can run Stockfish directly and can route 2200/2400/2600 profiles to Maia-3 when its Python UCI runtime is installed.

## Scope

- Stockfish is imported as a Windows UCI executable under `engines/stockfish.exe`.
- Maia-3 is imported as a local Python environment under `engines/maia3`.
- The Node server discovers both engines without requiring global PATH changes.
- UI profile routing uses Stockfish for `stockfish-strong` and `human-2700`, Maia-3 for `human-2200`, `human-2400`, and `human-2600`.
- If Maia-3 is missing or fails, the server returns a clear Chinese error instead of silently falling back.

## Architecture

`server.mjs` remains the only process launcher. It chooses an engine command from the requested profile: Stockfish executable for Stockfish profiles, Maia-3 wrapper script for Maia profiles. Both engines are spoken to through UCI and return the same JSON payload shape to the browser.

The download/import assets live inside `engines/`. Generated engine binaries, model weights, and virtual environments are intentionally not test fixtures; tests verify discovery and command selection through pure functions.

## Validation

- Unit tests cover engine command discovery and profile routing.
- Existing trainer tests must remain green.
- Smoke test checks server homepage and engine endpoint behavior.
