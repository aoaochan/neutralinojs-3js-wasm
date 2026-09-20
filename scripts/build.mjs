import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

console.log('[build] Building WASM...');
const wasm = spawnSync(
  'wasm-pack',
  ['build', 'backend', '--release', '--target', 'web', '--out-dir', '../www/pkg'],
  { stdio: 'inherit' },
);

if (wasm.error?.code === 'ENOENT') {
  console.error('[build] wasm-pack not found. Please run `cargo install wasm-pack` and try again.');
  process.exit(1);
}
if (wasm.status !== 0) {
  console.error('[build] Wasm build failed');
  process.exit(wasm.status ?? 1);
}

const neu = spawnSync(['neu', 'build', ...process.argv.slice(2)].join(' '), {
  stdio: 'inherit',
  shell: true,
});
process.exit(neu.status ?? 1);
