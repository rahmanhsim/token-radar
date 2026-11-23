// Token Radar Entrypoint (Node 22, standard library only).
//
// Reads a sealed universe snapshot from /input/snapshot.json (or --input <file|dir>),
// scores every pre-token protocol with the model in lib/model.ts, writes the ranked
// board to /output/board.json, copies dashboard/ and screenshots/ to /output, and
// generates /output/dossier.json via vendor/makefun-board.ts.
//
// Outside the container, MAKEFUN_OUTPUT_DIR or --output stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Scorer caps for text and screenshots */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Parse named argument from process.argv or return fallback */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

/** Recursively compute total bytes of all regular files in a directory */
function calculateDirBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += calculateDirBytes(fullPath);
    } else if (entry.isFile()) {
      total += statSync(fullPath).size;
    }
  }
  return total;
}

/** Copy regular files from directory into destination, skipping dotfiles */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

function formatDuration(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

// -----------------------------------------------------------------------------
// CLI Argument Resolution
// -----------------------------------------------------------------------------
const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// -----------------------------------------------------------------------------
// Phase 1: Snapshot Parse
// -----------------------------------------------------------------------------
const tParseStart = performance.now();
const rawInput = readFileSync(inputFile, 'utf8');
const snapshot = parseSnapshot(rawInput);
const tParseElapsed = performance.now() - tParseStart;
process.stderr.write(
  `[phase 1/4] snapshot parse: read and parsed ${snapshot.protocols.length} protocols (${snapshot.watchlist.length} on watchlist) in ${formatDuration(tParseElapsed)}\n`,
);

// -----------------------------------------------------------------------------
// Phase 2: Model Scoring
// -----------------------------------------------------------------------------
const tScoreStart = performance.now();
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}
const watchlistCovered = board.filter((r) => r.is_watchlist).length;
const tScoreElapsed = performance.now() - tScoreStart;
process.stderr.write(
  `[phase 2/4] model scoring: scored ${board.length} rows (${watchlistCovered}/${snapshot.watchlist.length} watchlist covered, ${radar.early_size} early, ${radar.live_size} live) in ${formatDuration(tScoreElapsed)}\n`,
);

// -----------------------------------------------------------------------------
// Phase 3: Dashboard Copy
// -----------------------------------------------------------------------------
const tCopyStart = performance.now();
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

const dashFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}
const tCopyElapsed = performance.now() - tCopyStart;
process.stderr.write(
  `[phase 3/4] dashboard copy: copied ${dashFiles.length} dashboard files and ${shots.length} screenshots in ${formatDuration(tCopyElapsed)}\n`,
);

// -----------------------------------------------------------------------------
// Phase 4: Dossier Build
// -----------------------------------------------------------------------------
const tDossierStart = performance.now();
const dossier = buildDossier(out, {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: SCREENSHOT_CAPS,
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
});
writeFileSync(join(out, 'dossier.json'), dossier);
const tDossierElapsed = performance.now() - tDossierStart;
process.stderr.write(
  `[phase 4/4] dossier build: compiled dossier.json (${Buffer.byteLength(dossier, 'utf8')} bytes) in ${formatDuration(tDossierElapsed)}\n`,
);

// -----------------------------------------------------------------------------
// Exit Summary
// -----------------------------------------------------------------------------
const totalOutputBytes = calculateDirBytes(out);
process.stdout.write(
  `token radar exit summary: ${board.length} rows, ${watchlistCovered}/${snapshot.watchlist.length} watchlist covered, ${totalOutputBytes.toLocaleString()} output bytes (${totalOutputBytes} bytes total)\n` +
    `token radar wrote: ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
