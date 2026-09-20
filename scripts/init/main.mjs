import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const CLEANUP_FOLDER = 'scripts/init';

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

async function getFileString(path) {
  const fullPath = path.resolve(__dirname, filePath);
  return await readFile(fullPath, 'utf8');
}

async function setupBackend() {
  if (existsSync('backend')) {
    console.log('[init] The `backend/` project generation skipped because already exists');
    return;
  }

  run('cargo', ['new', 'backend', '--lib', '--vcs', 'none']);
  run('cargo', ['add', 'wasm-bindgen', '--manifest-path', 'backend/Cargo.toml']);

  const libRs = await getFileString('./lib.rs');
  const gitIgnore = await getFileString('./gitignore');

  const manifest = 'backend/Cargo.toml';
  if (!readFileSync(manifest, 'utf8').includes('[lib]')) appendFileSync(manifest, '\n[lib]\ncrate-type = ["cdylib"]\n');
  writeFileSync('backend/src/lib.rs', libRs);
  writeFileSync('backend/.gitignore', gitIgnore);
  console.log('[init] The `backend/` project successfully generated');
}

async function vendorThree() {
  const meta = await fetch('https://registry.npmjs.org/three/latest');
  if (!meta.ok) throw new Error(`npm registry: HTTP ${meta.status}`);
  const { version } = await meta.json();

  const base = `https://cdn.jsdelivr.net/npm/three@${version}/`;
  const dist = 'www/vendor/three/';
  const entries = ['LICENSE', 'build/three.module.js'];
  const seen = new Set();

  async function grab(file) {
    if (seen.has(file)) return;
    seen.add(file);

    const res = await fetch(base + file);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${file}`);
    const src = await res.text();

    await mkdir(path.dirname(dist + file), { recursive: true });
    await writeFile(dist + file, src);

    for (const m of src.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) await grab(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
  }

  for (const f of entries) await grab(f);
  await writeFile(dist + 'VERSION', `${version}\n`);
  console.log(`[init] \`three@${version}\` -> \`${dist}\``);
}

function stripFrontendLibrary() {
  const file = 'neutralino.config.json';
  const config = JSON.parse(readFileSync(file, 'utf8'));
  if (config.cli?.frontendLibrary) {
    delete config.cli.frontendLibrary;
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
    console.log('[init] Removed `cli.frontendLibrary` from `neutralino.config.json`');
  }
}

// main
const steps = [
  ['Rust backend', setupBackend],
  ['three.js vendor', vendorThree],
  ['config cleanup', stripFrontendLibrary],
];

let failed = 0;
for (const [name, fn] of steps) {
  try {
    await fn();
  } catch (err) {
    failed++;
    console.warn(`[init] Failed to \`${name}\`: ${err.message}`);
  }
}

if (failed === 0) {
  try {
    rmSync(CLEANUP_FOLDER, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[init] Failed to cleanup: ${err.message}`);
  }
} else {
  console.warn('[init] The `scripts/` directory has been retained because a step failed. After resolving the issue, please run `node scripts/init.mjs` again.');
}
