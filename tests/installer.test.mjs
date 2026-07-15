import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function readProjectFile(...parts) {
  return readFileSync(join(root, ...parts), 'utf8');
}

function projectFileExists(...parts) {
  return existsSync(join(root, ...parts));
}

function hasInstallerPackageApp() {
  return projectFileExists('installer', 'package', 'app', 'index.html');
}

function hasFullOfflineInstallerPayload() {
  return (
    projectFileExists('installer', 'package', 'app', 'runtime', 'node', 'node.exe') &&
    projectFileExists('installer', 'package', 'app', 'engines', 'stockfish.exe') &&
    projectFileExists('installer', 'package', 'app', 'engines', 'maia3', 'maia3-uci.cmd') &&
    projectFileExists('installer', 'package', 'app', 'engines', 'maia3', '.conda', 'python.exe') &&
    Boolean(findProjectFile('installer/package/app/engines/maia3/hf-cache/models--UofTCSSLab--Maia3-23M', 'maia3-23m.pt'))
  );
}

function findProjectFile(relativeDir, fileName) {
  const start = join(root, ...relativeDir.split('/'));
  if (!existsSync(start)) return null;
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.name === fileName) {
        return fullPath;
      }
    }
  }
  return null;
}

function writeFixtureFile(rootDir, relativePath, content = '') {
  const filePath = join(rootDir, ...relativePath.split(/[\\/]+/));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

test('repository and application expose AGPL licensing and third-party notices', () => {
  const license = readProjectFile('LICENSE');
  const notices = readProjectFile('THIRD_PARTY_NOTICES.md');
  const html = readProjectFile('index.html');

  assert.match(license, /GNU AFFERO GENERAL PUBLIC LICENSE/);
  assert.match(license, /Version 3, 19 November 2007/);
  assert.match(notices, /Maia-3/i);
  assert.match(notices, /GNU Affero General Public License/i);
  assert.match(notices, /Stockfish/i);
  assert.match(notices, /GNU General Public License/i);
  assert.match(notices, /UofTCSSLab\/Maia3-79M/);
  assert.match(html, /href="LICENSE"/);
  assert.match(html, /href="THIRD_PARTY_NOTICES\.md"/);
  assert.match(html, /github\.com\/zhukaizhen\/ChessPrep/);
});

test('start script prefers bundled Node runtime before system Node', () => {
  const script = readProjectFile('start-trainer.ps1');

  assert.match(script, /\$BundledNode\s*=\s*Join-Path \$ProjectRoot 'runtime\\node\\node\.exe'/);
  assert.match(script, /if \(Test-Path \$BundledNode\)/);
  assert.match(script, /Start-Process -FilePath \$NodePath/);
});

test('local start scripts choose an available port when 8788 is occupied', () => {
  const windowsScript = readProjectFile('start-trainer.ps1');
  const macScript = readProjectFile('start-macos.sh');

  assert.match(windowsScript, /function Stop-StaleChessPrepServers/);
  assert.match(windowsScript, /Win32_Process/);
  assert.match(windowsScript, /node\.exe/);
  assert.match(windowsScript, /server\.mjs/);
  assert.match(windowsScript, /\$StaleServerPorts = \$BasePort\.\.\(\$BasePort \+ 19\)/);
  assert.match(windowsScript, /Get-NetTCPConnection -LocalPort \$StaleServerPorts/);
  assert.match(windowsScript, /Select-Object -ExpandProperty OwningProcess -Unique/);
  assert.match(windowsScript, /function Get-AvailablePort/);
  assert.match(windowsScript, /\$BasePort = if \(\$env:PORT\) \{ \[int\]\$env:PORT \} else \{ 8788 \}/);
  assert.match(windowsScript, /Get-NetTCPConnection -LocalPort \$candidate/);
  assert.match(windowsScript, /\$env:PORT = \[string\]\$Port/);
  assert.match(windowsScript, /CHESSPREP_NO_BROWSER/);

  assert.match(macScript, /find_available_port\(\)/);
  assert.match(macScript, /BASE_PORT="\$\{PORT:-8788\}"/);
  assert.match(macScript, /lsof -nP -iTCP:"\$\{candidate\}"/);
  assert.match(macScript, /PORT="\$\(find_available_port "\$\{BASE_PORT\}"\)"/);
});

test('installer is full offline and does not require external runtime installers', () => {
  const script = readProjectFile('installer', 'Install-LichessTrainer.ps1');
  const inno = readProjectFile('installer', 'inno', 'ChessPrepLab.iss');
  const build = readProjectFile('installer', 'Build-FullOfflineInstaller.ps1');

  assert.match(script, /\$BundledNode\s*=\s*Join-Path \$InstallRoot 'runtime\\node\\node\.exe'/);
  assert.match(script, /\$AppIcon\s*=\s*Join-Path \$InstallRoot 'assets\\icons\\chessprep-lab\.ico'/);
  assert.match(script, /\$PackageApp = Join-Path \$PackageRoot 'package\\app'/);
  assert.match(script, /Join-Path \$env:LOCALAPPDATA 'ChessPrep Lab'/);
  assert.match(script, /Test-Path \$PackageApp/);
  assert.match(script, /if \(-not \(Test-Path \$BundledNode\)\)/);
  assert.match(script, /engines\\maia3\\maia3-uci\.cmd/);
  assert.match(script, /engines\\maia3\\.conda\\python\.exe/);
  assert.match(script, /Maia3-23M/);
  assert.match(script, /robocopy/i);
  assert.match(script, /if \(\$LASTEXITCODE -ge 8\)/);
  assert.match(script, /ChessPrep Lab\.lnk/);
  assert.match(script, /\$shortcut\.IconLocation = "\$AppIcon,0"/);
  assert.match(script, /Start ChessPrep Lab/);
  assert.match(script, /ChessPrep Lab installed successfully\./);
  assert.doesNotMatch(script, /winget/i);
  assert.doesNotMatch(script, /OpenJS\.NodeJS\.LTS/i);
  assert.match(inno, /PrivilegesRequired=lowest/);
  assert.match(inno, /DefaultDirName=\{localappdata\}\\ChessPrep Lab/);
  assert.match(inno, /Source: "\.\.\\package\\app\\\*"/);
  assert.match(build, /validate-offline-payload\.mjs/);
  assert.match(build, /ISCC\.exe/);
  assert.match(build, /\$env:LOCALAPPDATA[\s\S]*Inno Setup 6\\ISCC\.exe/);
  assert.match(inno, /DisableReadyPage=yes/);
});

test('installer fallback documentation describes full offline Maia install', () => {
  const readme = readProjectFile('installer', 'README-INSTALL.txt');

  assert.match(readme, /Full Offline Windows Installer/);
  assert.match(readme, /%LOCALAPPDATA%\\ChessPrep Lab/);
  assert.match(readme, /ChessPrep-Lab-Setup\.exe \(Maia-3 23M\)/);
  assert.match(readme, /ChessPrep-Lab-Maia3-79M-Setup\.exe/);
  assert.match(readme, /79M installer defaults to 79M/);
  assert.doesNotMatch(readme, /Maia-3 is not included/i);
  assert.doesNotMatch(readme, /LichessOpeningTrainer/);
});

test('release installer build uses a separate hardened payload without development folders', () => {
  const build = readProjectFile('installer', 'Build-ReleaseInstaller.ps1');
  const inno = readProjectFile('installer', 'inno', 'ChessPrepLabRelease.iss');

  assert.match(build, /package-release\\app/);
  assert.match(build, /dist\\installer-release/);
  assert.match(build, /Compress-JavaScript/);
  assert.match(build, /Compress-Css/);
  assert.match(build, /Compress-Html/);
  assert.match(build, /\[System\.Text\.Encoding\]::UTF8/);
  assert.match(build, /\[System\.IO\.File\]::ReadAllText/);
  assert.match(build, /\[System\.IO\.File\]::WriteAllText/);
  assert.match(build, /Remove-DevelopmentArtifacts/);
  assert.match(build, /param\([\s\S]*ValidateSet\('23m', '79m'\)[\s\S]*\$MaiaModel/);
  assert.match(build, /Set-MaiaReleaseModel/);
  assert.match(build, /default-model\.txt/);
  assert.match(build, /ChessPrep-Lab-Maia3-79M-Setup/);
  assert.match(build, /data\\endgame-expansion/);
  assert.match(build, /assets\\icons\\icon-preview\.html/);
  assert.match(build, /opening-priors\.json/);
  assert.match(build, /engine-calibration/);
  assert.match(build, /validate-offline-payload\.mjs/);
  assert.match(build, /ChessPrepLabRelease\.iss/);
  assert.match(build, /\$FallbackPayloadRoot = Join-Path \$InstallerRoot 'package\\app'/);
  assert.match(build, /Copy-ReleaseItem/);
  assert.match(build, /'LICENSE'/);
  assert.match(build, /'THIRD_PARTY_NOTICES\.md'/);
  assert.match(build, /Is-LegalDocument/);
  assert.doesNotMatch(build, /downloads\\maia3-src/);

  assert.match(inno, /OutputDir=\.\.\\\.\.\\dist\\installer-release/);
  assert.match(inno, /OutputBaseFilename=\{#OutputBaseFilename\}/);
  assert.match(inno, /Source: "\.\.\\package-release\\app\\\*"/);
  assert.match(inno, /PrivilegesRequired=lowest/);
  assert.match(inno, /DisableReadyPage=yes/);
  assert.match(inno, /LicenseFile=\.\.\\package-release\\app\\LICENSE/);
});

test('installer package includes full offline engine payload', {
  skip: hasFullOfflineInstallerPayload() ? false : 'Full offline installer payload is generated locally and is not committed.'
}, () => {
  assert.ok(projectFileExists('installer', 'package', 'app', 'runtime', 'node', 'node.exe'));
  assert.ok(projectFileExists('installer', 'package', 'app', 'engines', 'stockfish.exe'));
  assert.ok(projectFileExists('installer', 'package', 'app', 'engines', 'maia3', 'maia3-uci.cmd'));
  assert.ok(projectFileExists('installer', 'package', 'app', 'engines', 'maia3', '.conda', 'python.exe'));
  assert.ok(findProjectFile('installer/package/app/engines/maia3/hf-cache/models--UofTCSSLab--Maia3-23M', 'maia3-23m.pt'));
});

test('offline payload validator reports complete package requirements', {
  skip: hasFullOfflineInstallerPayload() ? false : 'Full offline installer payload is generated locally and is not committed.'
}, async () => {
  const { validateOfflinePayload } = await import('../tools/installer/validate-offline-payload.mjs');
  const result = validateOfflinePayload(join(root, 'installer', 'package', 'app'));

  assert.equal(result.ok, true);
  assert.equal(result.missing.length, 0);
  assert.equal(result.problems.length, 0);
  assert.match(result.modelPath, /maia3-23m\.pt$/);
  assert.ok(result.requiredFiles.some((file) => file.endsWith('engines\\maia3\\.conda\\python.exe')));
});

test('offline payload validator rejects editable Maia installs tied to the build machine', async () => {
  const { validateOfflinePayload } = await import('../tools/installer/validate-offline-payload.mjs');
  const appRoot = mkdtempSync(join(tmpdir(), 'chessprep-payload-'));
  try {
    for (const relativePath of [
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'index.html',
      'app.js',
      'styles.css',
      'i18n.js',
      'server.mjs',
      'start-trainer.ps1',
      'runtime\\node\\node.exe',
      'engines\\stockfish.exe',
      'engines\\maia3\\maia3-uci.cmd',
      'engines\\maia3\\default-model.txt',
      'engines\\maia3\\.conda\\python.exe',
      'engines\\maia3\\.conda\\Lib\\site-packages\\maia3\\__init__.py',
      'engines\\maia3\\.conda\\Lib\\site-packages\\maia3\\uci.py',
      'engines\\maia3\\hf-cache\\models--UofTCSSLab--Maia3-23M\\snapshots\\test\\maia3-23m.pt'
    ]) {
      writeFixtureFile(appRoot, relativePath, relativePath.endsWith('default-model.txt') ? 'maia3-23m\n' : '');
    }

    writeFixtureFile(
      appRoot,
      'engines\\maia3\\.conda\\Lib\\site-packages\\__editable__.maia3-0.1.0.pth',
      'import __editable___maia3_0_1_0_finder; __editable___maia3_0_1_0_finder.install()'
    );
    writeFixtureFile(
      appRoot,
      'engines\\maia3\\.conda\\Lib\\site-packages\\__editable___maia3_0_1_0_finder.py',
      "MAPPING = {'maia3': 'C:\\\\Users\\\\kevin\\\\Documents\\\\Codex\\\\2026-05-30\\\\lichess\\\\downloads\\\\maia3-src\\\\maia3'}"
    );
    writeFixtureFile(
      appRoot,
      'engines\\maia3\\.conda\\Lib\\site-packages\\maia3-0.1.0.dist-info\\direct_url.json',
      '{"dir_info":{"editable":true},"url":"file:///C:/Users/kevin/Documents/Codex/2026-05-30/lichess/downloads/maia3-src"}'
    );

    const result = validateOfflinePayload(appRoot);

    assert.equal(result.ok, false);
    assert.equal(result.missing.length, 0);
    assert.ok(result.problems.some((problem) => /editable Maia/i.test(problem)));
    assert.ok(result.problems.some((problem) => /build-machine path/i.test(problem)));
  } finally {
    rmSync(appRoot, { recursive: true, force: true });
  }
});

test('offline payload validator accepts a 79M-only payload when selected', async () => {
  const { validateOfflinePayload } = await import('../tools/installer/validate-offline-payload.mjs');
  const appRoot = mkdtempSync(join(tmpdir(), 'chessprep-payload-'));
  try {
    for (const relativePath of [
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'index.html',
      'app.js',
      'styles.css',
      'i18n.js',
      'server.mjs',
      'start-trainer.ps1',
      'runtime\\node\\node.exe',
      'engines\\stockfish.exe',
      'engines\\maia3\\maia3-uci.cmd',
      'engines\\maia3\\default-model.txt',
      'engines\\maia3\\.conda\\python.exe',
      'engines\\maia3\\.conda\\Lib\\site-packages\\maia3\\__init__.py',
      'engines\\maia3\\.conda\\Lib\\site-packages\\maia3\\uci.py',
      'engines\\maia3\\hf-cache\\models--UofTCSSLab--Maia3-23M\\snapshots\\test\\maia3-23m.pt',
      'engines\\maia3\\hf-cache\\models--UofTCSSLab--Maia3-79M\\snapshots\\test\\maia3-79m.pt'
    ]) {
      writeFixtureFile(appRoot, relativePath, relativePath.endsWith('default-model.txt') ? 'maia3-79m\n' : '');
    }

    rmSync(join(appRoot, 'engines', 'maia3', 'hf-cache', 'models--UofTCSSLab--Maia3-23M'), { recursive: true, force: true });

    const result = validateOfflinePayload(appRoot, { maiaModel: '79m' });

    assert.equal(result.ok, true);
    assert.equal(result.missing.length, 0);
    assert.equal(result.problems.length, 0);
    assert.match(result.modelPath, /maia3-79m\.pt$/);
  } finally {
    rmSync(appRoot, { recursive: true, force: true });
  }
});

test('Maia wrapper uses relocatable bundled Python module execution', () => {
  const wrapper = readProjectFile('engines', 'maia3', 'maia3-uci.cmd');

  assert.match(wrapper, /"%ROOT%\\.conda\\python\.exe" -m maia3\.uci/);
  assert.doesNotMatch(wrapper, /Scripts\\maia3-uci\.exe/i);
});

test('Maia wrapper honors MAIA3_MODEL while preserving the 23M default', () => {
  const wrapper = readProjectFile('engines', 'maia3', 'maia3-uci.cmd');

  assert.match(wrapper, /default-model\.txt/i);
  assert.match(wrapper, /if not defined MAIA3_MODEL set "MAIA3_MODEL=maia3-23m"/i);
  assert.match(wrapper, /--model "%MAIA3_MODEL%"/i);
  assert.doesNotMatch(wrapper, /--model maia3-23m/i);
  assert.equal(readProjectFile('engines', 'maia3', 'default-model.txt').trim(), 'maia3-23m');
});

test('Maia cache scripts expose explicit 23M and 79M downloads', () => {
  assert.equal(projectFileExists('engines', 'maia3', 'cache-maia3-79m.cmd'), true);

  const cache23m = readProjectFile('engines', 'maia3', 'cache-maia3-23m.cmd');
  const cache79m = readProjectFile('engines', 'maia3', 'cache-maia3-79m.cmd');
  assert.match(cache23m, /--model maia3-23m/i);
  assert.match(cache79m, /--model maia3-79m/i);
});

test('HTML exposes opening and endgame training panes', () => {
  const html = readProjectFile('index.html');

  assert.match(html, /<title>ChessPrep Lab<\/title>/);
  assert.match(html, /rel="icon"[\s\S]*href="assets\/icons\/chessprep-lab\.ico"/);
  assert.match(html, /class="brand-mark"[\s\S]*src="assets\/icons\/chessprep-lab-mark\.png"/);
  assert.match(html, /<h1>ChessPrep Lab<\/h1>/);
  assert.match(html, /<p class="eyebrow">ChessPrep Lab<\/p>/);
  assert.match(html, /data-mode-switch="opening"/);
  assert.match(html, /data-mode-switch="endgame"/);
  assert.match(html, /data-mode-switch="prep"/);
  assert.match(html, /data-opening-left/);
  assert.match(html, /data-opening-right/);
  assert.match(html, /data-endgame-left/);
  assert.match(html, /data-endgame-right/);
  assert.match(html, /data-prep-left/);
  assert.match(html, /data-prep-right/);
  assert.match(html, /data-prep-database-status/);
  assert.match(html, /data-build-prep-database/);
  assert.match(html, /data-prep-common-replies/);
  assert.doesNotMatch(html, /data-offline-pgn-input/);
  assert.match(html, /data-run-prep-report/);
  assert.match(html, /data-endgame-categories/);
  assert.match(html, /data-endgame-target/);
  assert.match(html, /data-endgame-answer/);
});

test('frontend prep mode reads and builds the prebuilt offline database before reports', () => {
  const app = readProjectFile('app.js');
  const i18n = readProjectFile('i18n.js');
  const prepReport = readProjectFile('tools', 'player-prep', 'prep-report.mjs');

  assert.match(app, /fetch\('\/prep-database-status'/);
  assert.match(app, /fetch\('\/prep-database-build'/);
  assert.match(app, /fetch\('\/prep-report'/);
  assert.match(app, /focusFen:\s*focus\?\.fen\s*\|\|\s*state\.currentFen/);
  assert.match(app, /:\s*state\.moveHistory\.length/);
  assert.match(app, /focusLineFromPrepScope\(focus\)\s*:\s*formatMoveHistoryPgn\(state\.moveHistory\)/);
  assert.match(app, /function attemptPrepMove\(/);
  assert.match(app, /state\.mode === 'prep'[\s\S]*attemptPrepMove\(from, to, promotion\)/);
  assert.match(app, /function updatePrepBranchPrompt\(/);
  assert.match(app, /function undoPrepStep\(/);
  assert.match(app, /state\.mode === 'prep'[\s\S]*undoPrepStep\(\)/);
  assert.match(app, /rewindMoveHistoryOnePly/);
  assert.match(app, /state\.prep\.status = message/);
  assert.match(app, /payload\.openingTree/);
  assert.match(app, /state\.prep\.explorerReport/);
  assert.match(app, /refs\.prepCommonReplies/);
  assert.match(app, /getPrepExplorerRows/);
  assert.match(app, /prepExplorerFenKey/);
  assert.match(app, /renderPrepCommonReplies/);
  assert.match(app, /selectPrepOpponentReply/);
  assert.match(app, /data-prep-reply-index/);
  assert.match(app, /rankCurrentPreparedMoves/);
  assert.doesNotMatch(app, /fetch\('\/offline-pgn-import'/);
  assert.match(app, /dataPrepReport/);
  assert.match(app, /positionLine/);
  assert.match(app, /displayMove/);
  assert.match(app, /explanation/);
  assert.match(i18n, /mode\.prep/);
  assert.match(i18n, /prep\.buildDatabase/);
  assert.match(i18n, /prep\.runReport/);
  assert.match(i18n, /对手开局树/);
  assert.match(prepReport, /function makeOpponentExplorer/);
  assert.match(prepReport, /explorer:\s*makeOpponentExplorer\(opponentTree\)/);
});

test('top feedback is dynamic and not statically reset to the opening import prompt', () => {
  const html = readProjectFile('index.html');
  const app = readProjectFile('app.js');
  const feedback = html.match(/<div class="feedback"[^>]*data-feedback[^>]*>/)?.[0] || '';

  assert.ok(feedback, 'top feedback element is present');
  assert.doesNotMatch(feedback, /data-i18n="opening\.initialFeedback"/);
  assert.match(app, /if \(mode === 'endgame'\) return endgameMessage \?\? '';/);
});

test('HTML exposes a Chinese-default language switch with i18n markers', () => {
  const html = readProjectFile('index.html');

  assert.match(html, /<html lang="zh-CN"/);
  assert.match(html, /data-language-switch/);
  assert.match(html, /data-language-option="zh"/);
  assert.match(html, /data-language-option="en"/);
  assert.match(html, /data-i18n="mode\.opening"/);
  assert.match(html, /data-i18n-placeholder="opening\.pgnPlaceholder"/);
  assert.match(html, /data-i18n="engine\.sparring"/);
});

test('endgame teaching copy renders in the right-side task panel', () => {
  const html = readProjectFile('index.html');
  const endgameLeft = html.match(/<div class="endgame-panel hidden" data-endgame-left>[\s\S]*?<\/div>\s*<\/aside>/)?.[0] || '';
  const endgameRight = html.match(/<div class="endgame-panel hidden" data-endgame-right>[\s\S]*?<\/div>\s*<\/aside>/)?.[0] || '';

  assert.doesNotMatch(endgameLeft, /data-endgame-teaching/);
  assert.match(endgameRight, /data-endgame-teaching/);
});

test('endgame lesson list uses an internal scroll track', () => {
  const css = readProjectFile('styles.css');

  assert.match(css, /\.endgame-lesson-list[\s\S]*max-height:/);
  assert.match(css, /\.endgame-lesson-list[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /\.endgame-lesson-list[\s\S]*scrollbar-gutter:\s*stable/);
});

test('CSS uses the polished GM workbench visual theme', () => {
  const css = readProjectFile('styles.css');

  assert.match(css, /--accent-gold:/);
  assert.match(css, /--panel-glass:/);
  assert.match(css, /body::before/);
  assert.match(css, /\.topbar[\s\S]*backdrop-filter:/);
  assert.match(css, /\.primary-button[\s\S]*box-shadow:/);
});

test('desktop workbench aligns side panels with the board column', () => {
  const css = readProjectFile('styles.css');

  assert.match(css, /\.app-shell[\s\S]*width:\s*calc\(100% - 28px\)/);
  assert.doesNotMatch(css, /\.app-shell[\s\S]*width:\s*min\(1500px/);
  assert.match(css, /--workbench-height:\s*calc\(100dvh - var\(--chrome-height\)\)/);
  assert.doesNotMatch(css, /--workbench-height:\s*clamp\([^;]*760px/);
  assert.match(css, /\.workbench[\s\S]*align-items:\s*stretch/);
  assert.match(css, /\.panel,\s*[\s\S]*\.board-zone[\s\S]*height:\s*var\(--workbench-height\)/);
  assert.match(css, /\.panel[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /\.board-zone[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.board-zone[\s\S]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.board-slot[\s\S]*container-type:\s*size/);
  assert.match(css, /\.board-frame[\s\S]*width:\s*min\(100cqw,\s*100cqh\)/);
});

test('English locale has layout safeguards for longer text', () => {
  const css = readProjectFile('styles.css');

  assert.match(css, /body\.locale-en/);
  assert.match(css, /body\.locale-en[\s\S]*\.mode-switch/);
  assert.match(css, /body\.locale-en[\s\S]*\.action-grid/);
  assert.match(css, /body\.locale-en[\s\S]*\.endgame-lesson/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test('top mode switch keeps all training modes on one row', () => {
  const css = readProjectFile('styles.css');

  assert.match(css, /\.mode-switch\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.mode-button\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /body\.locale-en \.mode-button\s*\{[\s\S]*white-space:\s*nowrap/);
});

test('opening trainer exposes explicit opponent branch choice controls', () => {
  const html = readProjectFile('index.html');
  const app = readProjectFile('app.js');

  assert.match(html, /data-answers/);
  assert.match(app, /function getOpponentBranchDecision/);
  assert.match(app, /选择对手分支/);
  assert.match(app, /data-opponent-uci/);
});

test('opening trainer pauses on completed lines until the user continues', () => {
  const app = readProjectFile('app.js');

  assert.match(app, /openingLinePaused/);
  assert.match(app, /function continueOpeningTraining/);
  assert.match(app, /getOpeningLineCompletionAction/);
  assert.match(app, /停在最终局面/);
  assert.match(app, /继续下一条/);
});

test('board input uses shared from-to attempts and Lichess-like click switching', () => {
  const app = readProjectFile('app.js');

  assert.match(app, /function attemptMoveFromSquares\(from,\s*to,\s*promotion\s*=\s*null/);
  assert.match(app, /boardInputReducer\(state\.selected,\s*square,\s*canSelectBoardSquare\)/);
  assert.match(app, /getLegalDestinationSquares\(state\.currentFen,\s*state\.selected\)/);
});

test('board supports pointer drag move input with drag visuals', () => {
  const app = readProjectFile('app.js');
  const css = readProjectFile('styles.css');

  assert.match(app, /pointerdown/);
  assert.match(app, /pointermove/);
  assert.match(app, /pointerup/);
  assert.match(app, /function beginBoardDrag/);
  assert.match(app, /function finishBoardDrag/);
  assert.match(css, /\.piece-drag-ghost/);
  assert.match(css, /\.square\.drag-source/);
  assert.match(css, /\.square\.legal-target/);
});

test('board drag pointer movement avoids full UI rerenders', () => {
  const app = readProjectFile('app.js');
  const css = readProjectFile('styles.css');
  const updateBoardDrag = app.match(/function updateBoardDrag\(event\) \{[\s\S]*?\n  \}/)?.[0] || '';

  assert.notEqual(updateBoardDrag, '');
  assert.doesNotMatch(updateBoardDrag, /\brender\(\);/);
  assert.match(app, /requestAnimationFrame\(moveDragGhost\)/);
  assert.match(app, /function moveDragGhost/);
  assert.match(app, /style\.transform\s*=/);
  assert.match(css, /\.piece-drag-ghost[\s\S]*will-change:\s*transform/);
});

test('invited sharing mode includes Cloudflare Access compatible assets', () => {
  const app = readProjectFile('app.js');
  const shareScript = readProjectFile('start-share-trainer.ps1');
  const tunnelConfig = readProjectFile('cloudflare-tunnel.example.yml');

  assert.match(app, /credentials:\s*'same-origin'/);
  assert.match(shareScript, /cloudflared/);
  assert.match(shareScript, /tunnel run/);
  assert.match(shareScript, /\$env:HOST\s*=\s*'127\.0\.0\.1'/);
  assert.match(tunnelConfig, /service:\s*http:\/\/localhost:8788/);
});

test('domestic invited sharing mode uses cpolar with local-only trainer and basic auth', () => {
  const shareScript = readProjectFile('start-cpolar-trainer.ps1');

  assert.match(shareScript, /cpolar/);
  assert.match(shareScript, /tools\\cpolar\\cpolar\.exe/);
  assert.match(shareScript, /Test-Path \$BundledCpolar/);
  assert.match(shareScript, /\$env:HOST\s*=\s*'127\.0\.0\.1'/);
  assert.match(shareScript, /authtoken/);
  assert.match(shareScript, /-httpauth=/);
  assert.match(shareScript, /& \$Cpolar http[\s\S]*\$Port/);
});

test('endgame training pane exposes engine sparring controls', () => {
  const html = readProjectFile('index.html');

  assert.match(html, /data-endgame-right[\s\S]*data-engine-start/);
  assert.match(html, /data-endgame-right[\s\S]*data-engine-profiles/);
});

test('installer package includes the current endgame course files', {
  skip: hasInstallerPackageApp() ? false : 'Installer package payload is generated locally and is not committed.'
}, () => {
  const packageHtml = readProjectFile('installer', 'package', 'app', 'index.html');
  const packageApp = readProjectFile('installer', 'package', 'app', 'app.js');
  const packageEndgames = readProjectFile('installer', 'package', 'app', 'endgames.js');

  assert.match(packageHtml, /data-endgame-teaching/);
  assert.match(packageApp, /from '\.\/endgames\.js'/);
  assert.match(packageEndgames, /mce-borgo-drasko-dont-auto-trade/);
});

test('installer package stays in sync with core frontend files', {
  skip: hasInstallerPackageApp() ? false : 'Installer package payload is generated locally and is not committed.'
}, () => {
  for (const file of ['index.html', 'app.js', 'i18n.js', 'engine-profiles.mjs', 'endgames.js', 'endgame-expansion-lessons.js', 'styles.css', 'server.mjs', 'start-trainer.ps1', 'start-share-trainer.ps1', 'start-cpolar-trainer.ps1', 'cloudflare-tunnel.example.yml']) {
    assert.equal(readProjectFile('installer', 'package', 'app', file), readProjectFile(file), `${file} is stale`);
  }
  for (const file of ['compact-games.mjs', 'offline-store.mjs', 'prep-report.mjs', 'database-builder.mjs', 'opening-tree.mjs']) {
    assert.equal(
      readProjectFile('installer', 'package', 'app', 'tools', 'player-prep', file),
      readProjectFile('tools', 'player-prep', file),
      `${file} is stale`
    );
  }
  assert.equal(
    readProjectFile('installer', 'package', 'app', 'data', 'player-prep', 'chinese-player-pinyin.json'),
    readProjectFile('data', 'player-prep', 'chinese-player-pinyin.json'),
    'chinese-player-pinyin.json is stale'
  );
});
