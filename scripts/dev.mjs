// scripts/dev.mjs
// 사용: node scripts/dev.mjs
//   1) wasm을 빌드해 www/pkg 에 넣고
//   2) backend/ 소스가 바뀔 때마다 다시 빌드하면서
//   3) neu run 을 실행한다 (neu run 의 auto-reload 가 새 파일을 반영)

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 어디서 실행되든 프로젝트 루트 기준으로 동작
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

if (!existsSync('backend')) {
  console.error('[dev] backend/ 폴더가 없습니다. Rust backend 를 먼저 생성하세요.');
  process.exit(1);
}

// 개발용은 --dev (빠른 빌드). 릴리스 빌드는 config 의 buildCommand 가 담당
const WASM_ARGS = ['build', 'backend', '--dev', '--target', 'web', '--out-dir', '../www/pkg'];

function buildWasm() {
  console.log('[dev] wasm 빌드 중...');
  const r = spawnSync('wasm-pack', WASM_ARGS, { stdio: 'inherit' });

  if (r.error?.code === 'ENOENT') {
    console.warn('[dev] wasm-pack 을 찾을 수 없음. `cargo install wasm-pack` 후 다시 시도하세요.');
  } else if (r.status === 0) {
    console.log('[dev] wasm 빌드 완료');
  } else {
    console.warn('[dev] wasm 빌드 실패 - 소스를 고치면 자동으로 다시 시도합니다.');
  }
}

// 첫 화면에서 pkg 가 있도록 먼저 한 번 빌드
buildWasm();

// backend 변경 감지 (300ms 디바운스)
// 빌드 중에 발생한 변경은 빌드가 끝난 뒤 처리되어 한 번 더 빌드됨
let timer;
const onChange = () => {
  clearTimeout(timer);
  timer = setTimeout(buildWasm, 300);
};
const watchers = [
  watch('backend/src', { recursive: true }, onChange),
  watch('backend/Cargo.toml', onChange),
];

// shell: true - Windows 에서 neu 는 neu.cmd 라서 필요
const neu = spawn('neu', ['run'], { stdio: 'inherit', shell: true });
neu.on('exit', (code) => {
  watchers.forEach((w) => w.close());
  process.exit(code ?? 0);
});
