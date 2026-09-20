// scripts/build.mjs
// 사용: node scripts/build.mjs [neu build 옵션]
//   예) node scripts/build.mjs --release
// wasm 을 release 로 빌드해 www/pkg 에 넣은 뒤 neu build 를 실행한다

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 어디서 실행되든 프로젝트 루트 기준으로 동작
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

// neu 는 Windows 에서 neu.cmd 라서 shell 이 필요 (명령을 한 문자열로 전달)
const neu = spawnSync(['neu', 'build', ...process.argv.slice(2)].join(' '), {
  stdio: 'inherit',
  shell: true,
});
process.exit(neu.status ?? 1);
