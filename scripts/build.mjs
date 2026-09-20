import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

console.log('[build] wasm 빌드 중...');
const wasm = spawnSync(
  'wasm-pack',
  ['build', 'backend', '--release', '--target', 'web', '--out-dir', '../www/pkg'],
  { stdio: 'inherit' },
);

if (wasm.error?.code === 'ENOENT') {
  console.error('[build] wasm-pack 을 찾을 수 없음. `cargo install wasm-pack` 후 다시 시도하세요.');
  process.exit(1);
}
if (wasm.status !== 0) {
  console.error('[build] wasm 빌드 실패');
  process.exit(wasm.status ?? 1);
}

const neu = spawnSync(['neu', 'build', ...process.argv.slice(2)].join(' '), {
  stdio: 'inherit',
  shell: true,
});
process.exit(neu.status ?? 1);
