import { spawn, spawnSync } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

if (!existsSync('backend')) {
  console.error('[dev] backend/ 폴더가 없습니다. Rust backend 를 먼저 생성하세요.');
  process.exit(1);
}

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

buildWasm();

let timer;
const onChange = () => {
  clearTimeout(timer);
  timer = setTimeout(buildWasm, 300);
};
const watchers = [
  watch('backend/src', { recursive: true }, onChange),
  watch('backend/Cargo.toml', onChange),
];

const neu = spawn('neu run', { stdio: 'inherit', shell: true });
neu.on('exit', (code) => {
  watchers.forEach((w) => w.close());
  process.exit(code ?? 0);
});
