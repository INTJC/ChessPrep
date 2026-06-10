# Full Offline Windows Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a per-user, no-admin, full offline Windows installer package for ChessPrep Lab with bundled Node.js, Stockfish, and Maia-3 23M.

**Architecture:** Keep `server.mjs` as the engine launcher and make the installer responsible for copying a complete, validated payload into a predictable per-user install directory. Use a Node validation script for build-time payload checks, a PowerShell build script for payload sync and optional Inno compilation, and an Inno Setup `.iss` script for the native installer executable.

**Tech Stack:** Node.js test runner, PowerShell, Inno Setup, existing ChessPrep Lab static app/server files.

---

### Task 1: Update Installer Tests For Full Offline Maia

**Files:**
- Modify: `tests/installer.test.mjs`
- Create: `tools/installer/validate-offline-payload.mjs`

- [ ] **Step 1: Write failing tests**

Replace the old installer test that asserts Stockfish-only behavior with tests that require full offline payload assets and Inno Setup configuration:

```js
test('installer is full offline and does not require external runtime installers', () => {
  const script = readProjectFile('installer', 'Install-LichessTrainer.ps1');
  const inno = readProjectFile('installer', 'inno', 'ChessPrepLab.iss');
  const build = readProjectFile('installer', 'Build-FullOfflineInstaller.ps1');

  assert.match(script, /\$BundledNode\s*=\s*Join-Path \$InstallRoot 'runtime\\node\\node\.exe'/);
  assert.match(script, /\$PackageApp = Join-Path \$PackageRoot 'package\\app'/);
  assert.match(script, /engines\\maia3\\maia3-uci\.cmd/);
  assert.match(script, /engines\\maia3\\.conda\\python\.exe/);
  assert.match(script, /Maia3-23M/);
  assert.doesNotMatch(script, /winget/i);
  assert.doesNotMatch(script, /OpenJS\.NodeJS\.LTS/i);
  assert.match(inno, /PrivilegesRequired=lowest/);
  assert.match(inno, /DefaultDirName=\{localappdata\}\\ChessPrep Lab/);
  assert.match(inno, /Source: "\.\.\\package\\app\\\*"/);
  assert.match(build, /validate-offline-payload\.mjs/);
  assert.match(build, /ISCC\.exe/);
});
```

Add a payload existence test using filesystem checks:

```js
test('installer package includes full offline engine payload', () => {
  assert.ok(projectFileExists('installer', 'package', 'app', 'runtime', 'node', 'node.exe'));
  assert.ok(projectFileExists('installer', 'package', 'app', 'engines', 'stockfish.exe'));
  assert.ok(projectFileExists('installer', 'package', 'app', 'engines', 'maia3', 'maia3-uci.cmd'));
  assert.ok(projectFileExists('installer', 'package', 'app', 'engines', 'maia3', '.conda', 'python.exe'));
  assert.ok(findProjectFile('installer/package/app/engines/maia3/hf-cache/models--UofTCSSLab--Maia3-23M', 'maia3-23m.pt'));
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests\installer.test.mjs
```

Expected: FAIL because Inno scripts and Maia payload are missing from `installer/package/app`.

- [ ] **Step 3: Implement validation script**

Create `tools/installer/validate-offline-payload.mjs` with exported `validateOfflinePayload(root)` and CLI behavior. It checks exact required files plus recursive discovery of `maia3-23m.pt`.

- [ ] **Step 4: Sync Maia payload**

Copy `engines\maia3` into `installer\package\app\engines\maia3` without deleting unrelated user files.

- [ ] **Step 5: Verify tests pass for this task**

Run:

```powershell
node --test tests\installer.test.mjs
```

Expected: PASS for installer tests.

### Task 2: Add Native Inno Setup Installer

**Files:**
- Create: `installer/inno/ChessPrepLab.iss`
- Create: `installer/Build-FullOfflineInstaller.ps1`
- Modify: `installer/Install-LichessTrainer.ps1`
- Modify: `installer/package/Install-LichessTrainer.ps1`

- [ ] **Step 1: Write failing Inno expectations**

Covered by Task 1 tests: they fail until `ChessPrepLab.iss` and build script exist with the required no-admin and payload settings.

- [ ] **Step 2: Create Inno script**

Add a per-user Inno Setup script with:

```ini
PrivilegesRequired=lowest
DefaultDirName={localappdata}\ChessPrep Lab
OutputBaseFilename=ChessPrep-Lab-Setup
SetupIconFile=..\package\app\assets\icons\chessprep-lab.ico
WizardStyle=modern
```

Use `[Files]` to recursively install `..\package\app\*` into `{app}` and use `[Icons]` for desktop and Start Menu shortcuts that launch `start-trainer.ps1`.

- [ ] **Step 3: Create build script**

Add `installer/Build-FullOfflineInstaller.ps1` to run payload validation, find `ISCC.exe`, compile the Inno script, and print the generated installer path.

- [ ] **Step 4: Update legacy PowerShell installer checks**

Update `Install-LichessTrainer.ps1` and the package copy so the old script also validates Maia files and remains useful as a fallback.

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test tests\installer.test.mjs
```

Expected: PASS.

### Task 3: Full Verification And Build Attempt

**Files:**
- No new source files unless verification exposes a bug.

- [ ] **Step 1: Run core tests**

Run:

```powershell
node --test tests\installer.test.mjs tests\server.test.mjs tests\trainer-core.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run payload validation**

Run:

```powershell
node tools\installer\validate-offline-payload.mjs installer\package\app
```

Expected: PASS with a concise confirmation.

- [ ] **Step 3: Attempt installer build**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File installer\Build-FullOfflineInstaller.ps1
```

Expected: If Inno Setup is installed, produce `dist\installer\ChessPrep-Lab-Setup.exe`. If Inno Setup is missing, script exits with a clear installation instruction and all source work remains complete.

- [ ] **Step 4: Report evidence**

Summarize changed files, test output, payload size, and whether the final `.exe` was built or blocked by missing Inno Setup.
