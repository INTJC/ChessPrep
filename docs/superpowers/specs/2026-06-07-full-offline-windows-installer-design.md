# Full Offline Windows Installer Design

## Goal

Build a professional Windows installer for ChessPrep Lab that can be double-clicked on a blank Windows machine and install the complete application offline, including bundled Node.js, Stockfish, and Maia-3 23M.

## Decisions

- Installer format: native Windows `.exe` built with Inno Setup.
- Install mode: per-user, no administrator rights required.
- Default install path: `%LOCALAPPDATA%\ChessPrep Lab`.
- Payload mode: fully offline; the installer does not download Node.js, Python, Stockfish, Maia-3, pip packages, or model weights during install.
- Visual direction: branded, polished installer UI with a clear progress bar and current-step status.
- Package size: large packages are acceptable if the installed application works on a blank machine.

## User Experience

The user receives a single `ChessPrep Lab Setup.exe`. On launch, the installer shows ChessPrep Lab branding, explains that it will install the local training workbench and bundled engines, then copies the full payload with progress feedback.

The installer creates:

- A desktop shortcut for the current user.
- A Start Menu shortcut for the current user.
- A Windows uninstall entry for the current user.

The finish screen offers to launch ChessPrep Lab immediately. Launching opens the local trainer in the default browser after starting the bundled Node.js server on an available localhost port.

## Payload

The installer payload contains `installer/package/app` with these required assets:

- Core frontend and server files: `index.html`, `app.js`, `styles.css`, `i18n.js`, `server.mjs`, training data, and related assets.
- Runtime: `runtime/node/node.exe`.
- Stockfish: `engines/stockfish.exe`.
- Maia-3 wrapper: `engines/maia3/maia3-uci.cmd`.
- Maia-3 Python runtime: `engines/maia3/.conda/python.exe` and package dependencies.
- Maia-3 model cache: `engines/maia3/hf-cache/models--UofTCSSLab--Maia3-23M/.../maia3-23m.pt`.

The current installer package only includes app files, Node.js, and Stockfish. Implementation must sync the complete `engines/maia3` directory into `installer/package/app/engines/maia3`.

## Architecture

The installer build has three layers:

1. Payload preparation copies the current application files and complete engine directories into `installer/package/app`.
2. Inno Setup compiles `installer/package/app` into a per-user installer executable.
3. The installed launcher starts `runtime/node/node.exe server.mjs`, waits until the local port is listening, then opens the browser.

`server.mjs` remains responsible for engine discovery and UCI process launching. The installer only ensures the files are present in predictable relative paths.

## Error Handling

Build-time validation fails if any required payload file is missing. This prevents producing an installer that looks complete but cannot run Stockfish or Maia-3.

Install-time behavior should surface copy/install failures through the installer UI. The installer must not try to repair a missing Maia environment by downloading from the network.

Runtime launch errors continue to use the server and launcher error paths:

- Missing Stockfish produces the existing clear Stockfish error.
- Missing or broken Maia-3 produces the existing clear Maia-3 error.
- Occupied port selection uses the existing available-port logic.

## Testing

Update `tests/installer.test.mjs` so it verifies the new full offline installer expectations:

- The installer script uses bundled Node.js and does not require winget.
- The package includes Stockfish.
- The package includes Maia-3 wrapper, Python runtime, and Maia3-23M model cache.
- Installer package frontend/server files stay in sync with the project root.
- The old "Stockfish-only" expectation is removed.

Add build validation that can be run before compiling the installer. The validation checks exact required file paths and produces actionable errors.

Run Node tests after implementation:

```powershell
node --test tests\installer.test.mjs tests\server.test.mjs tests\trainer-core.test.mjs
```

For manual verification, build the installer, install it into a clean per-user directory, launch the shortcut, and confirm the browser opens the trainer. Then verify Stockfish and Maia profiles can be requested from the engine endpoint.

## Non-Goals

- No administrator install to `C:\Program Files`.
- No online bootstrap download mode.
- No MSI enterprise deployment package in this version.
- No code signing work in this version.
- No Electron-based installer shell.
