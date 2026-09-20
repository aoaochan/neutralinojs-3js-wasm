import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const CLEANUP = ['scripts/init.mjs', 'myapp'];
const LIB_RS = `use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
`;

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

function setupBackend() {
  if (existsSync('backend')) {
    console.log('[init] backend/ 가 이미 있어서 건너뜀');
    return;
  }

  run('cargo', ['new', 'backend', '--lib', '--vcs', 'none']);
  run('cargo', ['add', 'wasm-bindgen', '--manifest-path', 'backend/Cargo.toml']);

  const manifest = 'backend/Cargo.toml';
  if (!readFileSync(manifest, 'utf8').includes('[lib]')) {
    appendFileSync(manifest, '\n[lib]\ncrate-type = ["cdylib"]\n');
  }
  writeFileSync('backend/src/lib.rs', LIB_RS);
  console.log('[init] backend/ 생성 완료');
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

    for (const m of src.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      await grab(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
    }
  }

  for (const f of entries) await grab(f);
  await writeFile(dist + 'VERSION', `${version}\n`);
  console.log(`[init] three@${version} -> ${dist}`);
}

function stripFrontendLibrary() {
  const file = 'neutralino.config.json';
  const config = JSON.parse(readFileSync(file, 'utf8'));
  if (config.cli?.frontendLibrary) {
    delete config.cli.frontendLibrary;
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
    console.log('[init] neutralino.config.json 에서 cli.frontendLibrary 제거');
  }
}

// main
const steps = [
  ['Rust backend', setupBackend],
  ['three.js vendor', vendorThree],
  ['config 정리', stripFrontendLibrary],
];

let failed = 0;
for (const [name, fn] of steps) {
  try {
    await fn();
  } catch (err) {
    failed++;
    console.warn(`[init] ${name} 실패: ${err.message}`);
  }
}

if (failed === 0) {
  try {
    for (const p of CLEANUP) rmSync(p, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[init] 정리 실패: ${err.message}`);
  }
} else {
  console.warn('[init] 실패한 단계가 있어 scripts/ 를 남겨둠. 원인 해결 후 `node scripts/init.mjs` 로 다시 실행하세요.');
}
