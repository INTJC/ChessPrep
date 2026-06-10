# ChessPrep Lab macOS Local Deployment

This package is for local macOS deployment. It contains the web app, the Node.js server, opening/endgame data, icons, and piece assets.

## 1. Install Node.js

If Node.js is not installed, install it with Homebrew:

```bash
brew install node
```

Check it:

```bash
node --version
```

## 2. Start ChessPrep Lab

Open Terminal, enter the extracted folder, then run:

```bash
chmod +x start-macos.sh
./start-macos.sh
```

The app will run at:

```text
http://localhost:8788
```

The server listens on `127.0.0.1` by default, so it is local-only.

## 3. Change Port If Needed

If port `8788` is occupied:

```bash
PORT=8790 ./start-macos.sh
```

## 4. Stockfish on macOS

Opening training and endgame training work without a chess engine. Human-Like sparring and strong-engine mode need a local UCI engine.

Recommended:

```bash
brew install stockfish
```

Then restart ChessPrep Lab. If Stockfish is installed somewhere else, set:

```bash
STOCKFISH_PATH="/path/to/stockfish" ./start-macos.sh
```

You can also place a macOS Stockfish binary at:

```text
engines/stockfish
```

## 5. Maia-3 Profiles

The `Human-Like 2200 / 2400 / 2600` labels are preserved, while the engine strength is calibrated 200 Elo higher internally with stricter Stockfish quality filtering. This zip does not include a macOS Maia environment. If Maia-3 is not installed, use `Stockfish Strong` or `Approx. 2700`.

If you install Maia-3 locally, set:

```bash
MAIA3_PATH="/path/to/maia3-uci" ./start-macos.sh
```

The app also checks these local paths:

```text
engines/maia3/.venv/bin/maia3-uci
engines/maia3/.conda/bin/maia3-uci
```

## 6. Public Lichess Study Import

Public Lichess Study import works through the local Node server. Private studies should be exported from Lichess as PGN, then pasted or uploaded.
