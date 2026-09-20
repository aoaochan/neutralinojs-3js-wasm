// scripts/init.mjs
// neu create 직후 initCommand로 실행되는 템플릿 초기화 스크립트
//   1) Rust backend 생성 + wasm-bindgen 설정
//   2) three.js를 www/vendor/three/ 에 로컬 저장
//   3) 전부 성공하면 초기화용 파일 정리

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 어디서 실행되든 프로젝트 루트 기준으로 동작
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

// 초기화가 끝나면 지울 것들
const CLEANUP = ['scripts', 'myapp'];

const LIB_RS = `use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
`;

function run(cmd, args) {
  // 셸을 거치지 않으므로 Windows에서도 따옴표 이스케이프 문제가 없음
  execFileSync(cmd, args, { stdio: 'inherit' });
}

// 1. Rust backend
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

// 2. three.js vendor
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

    // 상대경로 import는 재귀로 따라감 (three.core.js 등)
    for (const m of src.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      await grab(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
    }
  }

  for (const f of entries) await grab(f);
  await writeFile(dist + 'VERSION', `${version}\n`);
  console.log(`[init] three@${version} -> ${dist}`);
}

// main
const steps = [
  ['Rust backend', setupBackend],
  ['three.js vendor', vendorThree],
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
