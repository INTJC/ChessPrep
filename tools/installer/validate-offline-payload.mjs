import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredRelativeFiles = [
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
  'engines\\maia3\\.conda\\python.exe'
];

const maiaModels = {
  '23m': {
    alias: 'maia3-23m',
    root: 'engines\\maia3\\hf-cache\\models--UofTCSSLab--Maia3-23M',
    file: 'maia3-23m.pt'
  },
  '79m': {
    alias: 'maia3-79m',
    root: 'engines\\maia3\\hf-cache\\models--UofTCSSLab--Maia3-79M',
    file: 'maia3-79m.pt'
  }
};
const maiaSitePackages = 'engines\\maia3\\.conda\\Lib\\site-packages';
const forbiddenMaiaPathPattern = /(downloads[\\/]+maia3-src|C:[\\/]+Users[\\/]+kevin|2026-05-30[\\/]+lichess)/i;

function toParts(relativePath) {
  return relativePath.split(/[\\/]+/).filter(Boolean);
}

function findFile(startDir, fileName) {
  if (!existsSync(startDir)) return null;
  const stack = [startDir];
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

function findFiles(startDir, predicate) {
  if (!existsSync(startDir)) return [];
  const matches = [];
  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (predicate(entry.name, fullPath)) {
        matches.push(fullPath);
      }
    }
  }
  return matches;
}

function readTextIfPresent(filePath) {
  if (!existsSync(filePath)) return '';
  return readFileSync(filePath, 'utf8');
}

function validateMaiaPythonPackage(root) {
  const problems = [];
  const sitePackages = join(root, ...toParts(maiaSitePackages));
  const maiaPackage = join(sitePackages, 'maia3');
  const maiaUci = join(maiaPackage, 'uci.py');

  if (!existsSync(maiaPackage) || !existsSync(maiaUci)) {
    problems.push(`Maia Python package is not installed as a normal bundled package: ${maiaPackage}`);
  }

  const editableFiles = findFiles(sitePackages, (name) => (
    /^__editable__.*maia3/i.test(name) ||
    /^__editable___maia3/i.test(name)
  ));
  for (const editableFile of editableFiles) {
    problems.push(`Editable Maia install marker must not be packaged: ${editableFile}`);
  }

  const maiaMetadataFiles = findFiles(sitePackages, (name, fullPath) => (
    /^__editable__.*maia3/i.test(name) ||
    /^__editable___maia3/i.test(name) ||
    name === 'direct_url.json' ||
    fullPath.includes('maia3-0.1.0.dist-info')
  ));
  for (const metadataFile of maiaMetadataFiles) {
    const content = readTextIfPresent(metadataFile);
    if (forbiddenMaiaPathPattern.test(content)) {
      problems.push(`Build-machine path leaked into Maia payload: ${metadataFile}`);
    }
  }

  return problems;
}

export function validateOfflinePayload(appRoot, { maiaModel = '23m' } = {}) {
  const root = resolve(appRoot);
  const selectedModel = maiaModels[String(maiaModel).toLowerCase()];
  if (!selectedModel) throw new Error(`Unsupported installer Maia model: ${maiaModel}`);
  const requiredFiles = requiredRelativeFiles.map((relativePath) => join(root, ...toParts(relativePath)));
  const missing = requiredFiles.filter((filePath) => !existsSync(filePath));
  const problems = [];
  const modelRoot = join(root, ...toParts(selectedModel.root));
  const modelPath = findFile(modelRoot, selectedModel.file);
  if (!modelPath) {
    missing.push(join(modelRoot, '**', selectedModel.file));
  }
  const defaultModelPath = join(root, 'engines', 'maia3', 'default-model.txt');
  const configuredModel = readTextIfPresent(defaultModelPath).trim().toLowerCase();
  if (configuredModel && configuredModel !== selectedModel.alias) {
    problems.push(`Bundled Maia default ${configuredModel} does not match selected model ${selectedModel.alias}.`);
  }
  for (const [key, model] of Object.entries(maiaModels)) {
    if (key === String(maiaModel).toLowerCase()) continue;
    const unexpectedRoot = join(root, ...toParts(model.root));
    if (findFile(unexpectedRoot, model.file)) {
      problems.push(`Unexpected Maia model in ${selectedModel.alias} payload: ${unexpectedRoot}`);
    }
  }
  problems.push(...validateMaiaPythonPackage(root));

  return {
    ok: missing.length === 0 && problems.length === 0,
    root,
    requiredFiles,
    modelPath,
    missing,
    problems
  };
}

function main() {
  const fallbackRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'installer', 'package', 'app');
  const appRoot = process.argv[2] ? resolve(process.argv[2]) : fallbackRoot;
  const modelFlag = process.argv.indexOf('--maia-model');
  const maiaModel = modelFlag >= 0 ? process.argv[modelFlag + 1] : '23m';
  const result = validateOfflinePayload(appRoot, { maiaModel });

  if (!result.ok) {
    console.error('Offline installer payload is incomplete.');
    for (const missing of result.missing) {
      console.error(`Missing: ${missing}`);
    }
    for (const problem of result.problems) {
      console.error(`Problem: ${problem}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Offline installer payload OK: ${result.root}`);
  console.log(`Maia3-${maiaModel.toUpperCase()} model: ${result.modelPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
