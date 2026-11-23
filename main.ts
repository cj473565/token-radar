// token-radar-01 entrypoint, rewritten for the radar-2 entry (Node 22, standard library only).
//
// What it does, in order:
//   1. finds the sealed snapshot (a file path, or a directory holding snapshot.json),
//   2. scores every pre-token protocol with the model in lib/model.ts and refuses to
//      hand in a board the gate would reject,
//   3. writes board.json and the dashboard's data.js into the output directory,
//   4. copies dashboard/ and screenshots/ next to them (three screenshots minimum),
//   5. writes dossier.json LAST, because the scorer rebuilds it from the finished
//      output directory and compares bytes, so nothing may change after it.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { buildDossier } from './vendor/makefun-board.ts';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = dirname(fileURLToPath(import.meta.url));

/** Read `--name value` or `--name=value` from argv; fall back when the flag is absent. */
function flagValue(name: string, fallback: string): string {
  const argv = process.argv;
  const direct = argv.indexOf('--' + name);
  if (direct !== -1 && argv[direct + 1] !== undefined) return argv[direct + 1] as string;
  const prefix = '--' + name + '=';
  const inline = argv.find((entry) => entry.startsWith(prefix));
  return inline === undefined ? fallback : inline.substring(prefix.length);
}

function fail(message: string, code: number): never {
  process.stderr.write('token radar: ' + message + '\n');
  process.exit(code);
}

const inputPath = flagValue('input', '/input');
const snapshotFile = inputPath.endsWith('.json') ? inputPath : join(inputPath, 'snapshot.json');
if (!existsSync(snapshotFile)) {
  fail('no snapshot at ' + snapshotFile + ': pass --input <snapshot.json|directory> or mount the sealed /input', 2);
}
const outDir = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(snapshotFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const problem = boardIssue(board, snapshot);
if (problem !== null) {
  fail('the model wrote a board the gate refuses: ' + problem, 1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), JSON.stringify({ rows: board }) + '\n');
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

/** Copy a folder's plain files (dotfiles skipped) into the output; returns the names copied. */
function copyFolder(folder: string, target: string): string[] {
  const names: string[] = [];
  if (!existsSync(folder)) return names;
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(folder)) {
    if (name.charAt(0) === '.') continue;
    const source = join(folder, name);
    if (statSync(source).isFile()) {
      copyFileSync(source, join(target, name));
      names.push(name);
    }
  }
  return names;
}

copyFolder(join(repoDir, 'dashboard'), join(outDir, 'dashboard'));
const shotNames = copyFolder(join(repoDir, 'screenshots'), join(outDir, 'screenshots'));
if (shotNames.length < 3) {
  fail('screenshots/ holds ' + shotNames.length + ': hand in 3, the board, a detail view and a filtered view', 1);
}
const shotNameOk = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
for (const name of shotNames) {
  if (!shotNameOk.test(name)) {
    fail('screenshots/' + name + ': a name is letters, digits and . _ -, 1 to 128 characters', 1);
  }
}

const dossierOptions = {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 },
};
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, dossierOptions));

process.stdout.write(
  'token radar: ' + snapshot.protocols.length + ' protocols, ' + snapshot.watchlist.length +
    ' on the watchlist, ' + board.length + ' rows scored (' + radar.early_size + ' early, ' +
    radar.live_size + ' live set aside)\n',
);
process.stdout.write(
  'token radar: wrote board.json, data.js, dashboard/ (3 files), screenshots/ (' + shotNames.length +
    ' images) and dossier.json under ' + outDir + '\n',
);
