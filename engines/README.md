# Local Engines

This directory contains local chess engines used by ChessPrep Lab. Engine binaries, Python environments, and model caches are local payloads and are not committed.

Expected source-run layout:

```text
engines/
  stockfish.exe
  maia3/
    maia3-uci.cmd
    cache-maia3-23m.cmd
    cache-maia3-79m.cmd
    .conda/
    hf-cache/
```

`stockfish.exe` is the Windows UCI engine used for strong play and for quality-filtering Maia candidates. On other platforms, set `STOCKFISH_PATH` or place a `stockfish` executable under `engines/`.

## Maia-3 Models

The server routes `human-2200`, `human-2400`, and `human-2600` profiles to Maia-3, then applies the existing Stockfish quality filters. `human-2700` remains a Stockfish profile.

Maia-3 23M is the source default. Source installs can opt into 79M:

```powershell
engines\maia3\cache-maia3-79m.cmd
$env:MAIA3_MODEL='maia3-79m'
node server.mjs
```

Accepted `MAIA3_MODEL` values are `23m`, `maia3-23m`, `79m`, and `maia3-79m`. An unset value defaults to `maia3-23m`; invalid values fail instead of silently falling back.

Both cache scripts download through `https://hf-mirror.com` into the shared `hf-cache`. Runtime launches use `--local-files-only`, so the selected model must be cached before sparring begins.

The installed Maia source must list both models:

```powershell
engines\maia3\.conda\python.exe -m maia3.uci --list-models
```

If Maia is installed elsewhere, set `MAIA3_PATH` to a generic `maia3-uci` entry point that accepts the project's model and cache arguments. Do not use a preset executable such as `maia3-79m` as `MAIA3_PATH`, because the server passes `--model` explicitly.

The release builder accepts `-MaiaModel 23m` or `-MaiaModel 79m`. It writes `default-model.txt`, keeps only the selected checkpoint, and produces `ChessPrep-Lab-Setup.exe` or `ChessPrep-Lab-Maia3-79M-Setup.exe`. The validator rejects a missing selected model, a mismatched default, or an extra model cache.

See [the offline prep and Maia-3 guide](../docs/offline-prep-and-maia3.md) for source installation, database building, UCI verification, and troubleshooting.
