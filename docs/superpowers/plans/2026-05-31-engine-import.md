# Engine Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import Stockfish and Maia-3 into the local project and route engine profiles to the correct UCI runtime.

**Architecture:** Keep engine binaries and model runtime under `engines/`. `server.mjs` exposes pure discovery/routing helpers and launches either Stockfish or the Maia-3 wrapper through the same UCI orchestration path.

**Tech Stack:** Node `child_process.spawn`, PowerShell download/setup scripts, official Stockfish Windows release, Maia-3 Python package and Hugging Face model cache.

---

## Tasks

- [ ] Add tests for Maia-3 discovery and profile-to-engine routing.
- [ ] Implement server routing helpers and use them in `/engine-move`.
- [ ] Create `engines/README.md` documenting local engine files.
- [ ] Download official Stockfish Windows build and place/copy the executable at `engines/stockfish.exe`.
- [ ] Create `engines/maia3` local Python environment, install Maia-3, and cache Maia3-23M.
- [ ] Add wrapper scripts for Maia-3 UCI startup if the installed command needs stable project-local entry points.
- [ ] Run full Node tests.
- [ ] Smoke test Stockfish endpoint; smoke test Maia-3 endpoint if the model install succeeds.
