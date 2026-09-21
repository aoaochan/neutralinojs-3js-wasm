import { spawn, spawnSync } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

if (!existsSync('backend')) {
  console.error('[dev] `The backend/` folder is missing. Please create the Rust backend first.');
  process.exit(1);
}

const WASM_ARGS = ['build', 'backend', '--dev', '--target', 'web', '--out-dir', '../www/pkg'];

function consoleOverriding() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const RESET = "\x1b[0m";
  const GREEN = "\x1b[32m";
  const RED = "\x1b[31m";
  const YELLOW = "\x1b[33m";

  console.log = (...args) => {
      originalLog(GREEN + '', ...args, RESET);
  };
  console.error = (...args) => {
      originalError(RED + '', ...args, RESET);
  };
  console.warn = (...args) => {
      originalWarn(YELLOW + '', ...args, RESET);
  };
}

function buildWasm() {
  console.log('[dev] Building WASM...');
  const r = spawnSync('wasm-pack', WASM_ARGS, { stdio: 'inherit' });

  if (r.error?.code === 'ENOENT') {
    console.warn('[dev] wasm-pack not found. Please run `cargo install wasm-pack` and try again.');
  } else if (r.status === 0) {
    console.log('[dev] Wasm build complete.');
  } else {
    console.warn('[dev] Wasm build failed – it will automatically retry if you modify the source.');
  }
}

consoleOverriding();
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
