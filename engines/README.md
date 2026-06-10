# Local Engines

This directory is for local chess engines used by the trainer.

Expected layout:

```text
engines/
  stockfish.exe
  maia3/
    maia3-uci.cmd
    cache-maia3-23m.cmd
    .venv/
    hf-cache/
```

`stockfish.exe` is the official Windows UCI engine.

`maia3-uci.cmd` should launch the Maia-3 UCI command from the local Python environment. The server routes `human-2200`, `human-2400`, and `human-2600` profiles to Maia-3 and sets the UCI `Elo` option.

`cache-maia3-23m.cmd` downloads the Maia3-23M model through `https://hf-mirror.com` into `hf-cache`.
