# Offline Prep and Maia-3 79M Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Maia-3 79M an explicit source-install option while preserving the 23M default, and document the complete offline opponent-preparation workflow.

**Architecture:** `server.mjs` will own model-name normalization and pass one normalized alias to every Maia launch path. Windows wrappers will mirror the same `MAIA3_MODEL` default, model caching remains explicit and offline runtime remains `--local-files-only`. A focused operations guide will describe public PGN acquisition, database build/update semantics, prep reports, Maia source installation, and troubleshooting.

**Tech Stack:** Node.js ES modules, Node test runner, PowerShell/cmd launch scripts, Markdown.

---

### Task 1: Define Maia model selection behavior with failing tests

**Files:**
- Modify: `tests/server.test.mjs`
- Modify: `tests/installer.test.mjs`

- [ ] **Step 1: Add model normalization tests**

Import `resolveMaiaModel` from `server.mjs` and add tests equivalent to:

```js
test('resolveMaiaModel defaults to 23M and normalizes supported aliases', () => {
  assert.equal(resolveMaiaModel({}), 'maia3-23m');
  assert.equal(resolveMaiaModel({ MAIA3_MODEL: '23m' }), 'maia3-23m');
  assert.equal(resolveMaiaModel({ MAIA3_MODEL: ' maia3-79m ' }), 'maia3-79m');
  assert.equal(resolveMaiaModel({ MAIA3_MODEL: '79m' }), 'maia3-79m');
});

test('resolveMaiaModel rejects unsupported model names', () => {
  assert.throws(
    () => resolveMaiaModel({ MAIA3_MODEL: '69m' }),
    /MAIA3_MODEL.*maia3-23m.*maia3-79m/
  );
});
```

- [ ] **Step 2: Add launch argument tests**

Extend `findMaiaExecutable` tests so explicit paths and project Python execution both assert `--model maia3-79m` when `MAIA3_MODEL=79m`, while the existing default assertions remain 23M.

- [ ] **Step 3: Add script contract tests**

In `tests/installer.test.mjs`, read `engines/maia3/maia3-uci.cmd` and the cache scripts. Assert that the UCI wrapper reads `MAIA3_MODEL`, defaults to `maia3-23m`, and forwards `%MAIA3_MODEL%`; assert that both 23M and 79M cache scripts pass the matching alias.

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```powershell
node --test tests\server.test.mjs tests\installer.test.mjs
```

Expected: FAIL because `resolveMaiaModel` is not exported and the 79M cache script/script-variable behavior does not exist.

### Task 2: Implement the minimal model selector and Windows scripts

**Files:**
- Modify: `server.mjs`
- Modify: `engines/maia3/maia3-uci.cmd`
- Create: `engines/maia3/cache-maia3-79m.cmd`

- [ ] **Step 1: Implement model normalization**

Add an exported function near the existing engine discovery helpers:

```js
const maiaModelAliases = new Map([
  ['23m', 'maia3-23m'],
  ['maia3-23m', 'maia3-23m'],
  ['79m', 'maia3-79m'],
  ['maia3-79m', 'maia3-79m']
]);

export function resolveMaiaModel(env = process.env) {
  const requested = String(env.MAIA3_MODEL || 'maia3-23m').trim().toLowerCase() || 'maia3-23m';
  const model = maiaModelAliases.get(requested);
  if (!model) {
    throw new Error(`Invalid MAIA3_MODEL "${requested}". Use maia3-23m or maia3-79m.`);
  }
  return model;
}
```

Change `defaultMaiaArgs`, `maiaPythonModuleArgs`, and all calls in `findMaiaExecutable` to receive `env` and use `resolveMaiaModel(env)`.

- [ ] **Step 2: Update the UCI wrapper**

Set a default without overriding an existing variable:

```bat
if not defined MAIA3_MODEL set "MAIA3_MODEL=maia3-23m"
"%ROOT%\.conda\python.exe" -m maia3.uci --model "%MAIA3_MODEL%" --cache-dir "%ROOT%hf-cache" --local-files-only --device cpu --no-use-amp %*
```

- [ ] **Step 3: Add the 79M cache script**

Mirror the existing 23M cache script but invoke:

```bat
"%ROOT%\.conda\python.exe" -m maia3.cache --model maia3-79m --cache-dir "%ROOT%hf-cache"
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
node --test tests\server.test.mjs tests\installer.test.mjs
```

Expected: PASS with zero failures.

### Task 3: Write the reproducible operations guide

**Files:**
- Create: `docs/offline-prep-and-maia3.md`

- [ ] **Step 1: Document offline database inputs and lifecycle**

Document prerequisites, ignored paths, legal/public-source boundaries, the three default source directories, and these exact commands:

```powershell
node tools\player-prep\public-source-downloader.mjs plan
node tools\player-prep\public-source-downloader.mjs download
node tools\player-prep\database-builder.mjs build
node tools\player-prep\database-builder.mjs append-missing
node tools\player-prep\database-builder.mjs dedupe
node tools\player-prep\database-builder.mjs status
```

State that `build` and the web build button reset the store, while `append-missing` preserves the existing store and detects imported sources by filename. State the default filters: year at least 2010 and both ratings strictly above 2000.

- [ ] **Step 2: Document prep-report usage**

Describe starting the server, opening Prep Mode, selecting own color and a concrete opening branch, generating a report, and interpreting samples, result rates, score, and preparation coverage.

- [ ] **Step 3: Document Maia source installation and 79M selection**

Use the verified source interface:

```powershell
git clone https://github.com/CSSLab/maia3.git downloads\maia3-src
engines\maia3\.conda\python.exe -m pip install -e downloads\maia3-src
engines\maia3\.conda\python.exe -m maia3.uci --list-models
engines\maia3\cache-maia3-79m.cmd
$env:MAIA3_MODEL='maia3-79m'
node server.mjs
```

Also document `MAIA3_PATH`, reverting to 23M, offline-cache behavior, the Stockfish filter dependency, 79M CPU/memory tradeoffs, and the separate one-model 23M/79M release installers.

- [ ] **Step 4: Add troubleshooting**

Cover invalid model values, older Maia source without the 79M registry, missing cache, missing Stockfish, interrupted downloads/builds, same-name source replacement, and safe database backups.

### Task 4: Connect and correct project documentation

**Files:**
- Modify: `README.md`
- Modify: `ChessPrep-Lab-使用文档.md`
- Modify: `engines/README.md`

- [ ] **Step 1: Update README overview**

Keep the existing bilingual presentation. Change fixed 23M descriptions to “23M by default, optional 79M for source installs,” add the shortest `MAIA3_MODEL` example, link the detailed guide, and label development-machine database counts as a dated snapshot rather than a universal result.

- [ ] **Step 2: Correct the user guide**

Remove the hard-coded `C:\Users\kevin\Documents\Codex\2026-05-30\lichess` path. Use “repository root,” add Prep Mode steps and link the operations guide, and describe model selection without claiming 79M is bundled.

- [ ] **Step 3: Expand the engine README**

Show both cache scripts, `MAIA3_MODEL`, `MAIA3_PATH`, shared cache layout, source-version requirement, and the 23M installer boundary.

- [ ] **Step 4: Run a consistency scan**

Run:

```powershell
rg -n "Maia-3 23M|Maia3-23M|maia3-23m|maia3-79m|MAIA3_MODEL|2026-05-30\\lichess" README.md ChessPrep-Lab-使用文档.md engines\README.md docs\offline-prep-and-maia3.md server.mjs engines\maia3 tests
```

Expected: every fixed 23M statement is either the documented default/installer boundary or an explicit 23M command; no old machine-specific launch path remains in user documentation.

### Task 5: Verify behavior and documentation safely

**Files:**
- Verify only: all modified files

- [ ] **Step 1: Run the complete relevant test suite**

Run:

```powershell
node --test tests\server.test.mjs tests\installer.test.mjs tests\player-prep-builder.test.mjs tests\public-source-downloader.test.mjs tests\trainer-core.test.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 2: Verify safe local commands**

Run:

```powershell
node tools\player-prep\database-builder.mjs status
```

Run the reference Maia environment's `python -m maia3.uci --list-models` and confirm both `maia3-23m` and `maia3-79m` are listed. Do not run `download`, `build`, or 79M caching during verification.

- [ ] **Step 3: Review the final diff**

Run `git diff --check`, `git diff --stat`, and inspect `git diff`. Confirm no model, database, downloaded source, generated payload, or machine-specific absolute path was added to Git; release EXEs remain external assets.

- [ ] **Step 4: Record the limitation accurately**

Report that 79M selection and source compatibility were verified, but actual 79M model loading was not run because the reference machine has only the 23M checkpoint cached.
