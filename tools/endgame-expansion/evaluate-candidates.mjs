import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {
    contexts: null,
    output: null,
    stockfish: process.env.STOCKFISH_PATH || join(process.cwd(), 'engines', 'stockfish.exe'),
    limit: 20,
    multipv: 3,
    depth: 12,
    movetime: 500
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--contexts') args.contexts = argv[++index];
    else if (arg === '--output') args.output = argv[++index];
    else if (arg === '--stockfish') args.stockfish = argv[++index];
    else if (arg === '--limit') args.limit = Number(argv[++index]) || args.limit;
    else if (arg === '--multipv') args.multipv = Number(argv[++index]) || args.multipv;
    else if (arg === '--depth') args.depth = Number(argv[++index]) || args.depth;
    else if (arg === '--movetime') args.movetime = Number(argv[++index]) || args.movetime;
  }
  return args;
}

function scoreFromMate(mate) {
  if (!Number.isFinite(mate)) return null;
  return mate > 0 ? 100000 - mate : -100000 - mate;
}

export function parseStockfishAnalysis(output) {
  const latestBySlot = new Map();
  for (const parsed of String(output || '')
    .split(/\r?\n/)
    .map((line) => {
      const pvText = line.match(/\bpv\s+(.+)$/)?.[1] || '';
      const pv = pvText.split(/\s+/).filter((token) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token));
      if (!pv.length) return null;
      const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
      const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
      if (!cpMatch && !mateMatch) return null;
      const mate = mateMatch ? Number(mateMatch[1]) : null;
      return {
        multipv: Number(line.match(/\bmultipv\s+(\d+)/)?.[1] || 1),
        depth: Number(line.match(/\bdepth\s+(\d+)/)?.[1] || 0),
        scoreCp: cpMatch ? Number(cpMatch[1]) : scoreFromMate(mate),
        mate,
        move: pv[0],
        pv
      };
    })
    .filter(Boolean)) {
    const existing = latestBySlot.get(parsed.multipv);
    if (!existing || parsed.depth >= existing.depth) {
      latestBySlot.set(parsed.multipv, parsed);
    }
  }
  return [...latestBySlot.values()]
    .sort((a, b) => b.scoreCp - a.scoreCp || a.multipv - b.multipv);
}

function evaluateFen(stockfishPath, fen, options) {
  return new Promise((resolveEval, rejectEval) => {
    const engine = spawn(stockfishPath, [], { windowsHide: true });
    let output = '';
    let settled = false;
    const timeout = setTimeout(() => finish(new Error(`Stockfish timeout for ${fen}`)), Math.max(5000, options.movetime * 8));

    function finish(error, result = null) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        engine.stdin.write('quit\n');
      } catch {}
      if (error) rejectEval(error);
      else resolveEval(result);
    }

    engine.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('uciok') && !output.includes('readyok')) {
        engine.stdin.write(`setoption name MultiPV value ${options.multipv}\n`);
        engine.stdin.write('isready\n');
      }
      if (output.includes('readyok') && !output.includes('bestmove')) {
        engine.stdin.write(`position fen ${fen}\n`);
        engine.stdin.write(`go depth ${options.depth} movetime ${options.movetime}\n`);
      }
      if (/\nbestmove\s+/.test(output)) {
        finish(null, {
          lines: parseStockfishAnalysis(output),
          output
        });
      }
    });
    engine.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    engine.on('error', finish);
    engine.on('exit', (code) => {
      if (!settled && code !== 0) finish(new Error(`Stockfish exited with code ${code}`));
    });
    engine.stdin.write('uci\n');
  });
}

export async function evaluateContexts(contextData, options = {}) {
  const stockfishPath = options.stockfish || join(process.cwd(), 'engines', 'stockfish.exe');
  if (!existsSync(stockfishPath)) throw new Error(`Stockfish not found: ${stockfishPath}`);
  const limit = Number(options.limit) || 20;
  const results = [];
  const errors = [];
  for (const context of (contextData.contexts || []).slice(0, limit)) {
    try {
      const evaluation = await evaluateFen(stockfishPath, context.candidateFen, {
        multipv: Number(options.multipv) || 3,
        depth: Number(options.depth) || 12,
        movetime: Number(options.movetime) || 500
      });
      results.push({
        id: context.id,
        sourceGameId: context.sourceGameId,
        fen: context.candidateFen,
        suggestedFirstMove: context.suggestedFirstMove,
        focusMove: context.focusMove,
        lines: evaluation.lines,
        suggestedMoveRank: evaluation.lines.findIndex((line) => line.move === context.suggestedFirstMove) + 1 || null
      });
    } catch (error) {
      errors.push(`${context.id}: ${error.message}`);
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    stockfishPath,
    settings: {
      limit,
      multipv: Number(options.multipv) || 3,
      depth: Number(options.depth) || 12,
      movetime: Number(options.movetime) || 500
    },
    evaluations: results,
    errors
  };
}

export async function main() {
  const args = parseArgs(process.argv);
  if (!args.contexts || !args.output) {
    console.error('Usage: node tools/endgame-expansion/evaluate-candidates.mjs --contexts contexts.json --output evaluations.json');
    process.exit(1);
  }
  const contextData = JSON.parse(readFileSync(args.contexts, 'utf8'));
  const result = await evaluateContexts(contextData, args);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, JSON.stringify(result, null, 2));
  console.log(`Evaluated ${result.evaluations.length} contexts.`);
  if (result.errors.length) console.log(`Evaluation errors: ${result.errors.length}`);
  console.log(`Wrote ${args.output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
