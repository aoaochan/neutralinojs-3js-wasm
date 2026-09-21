import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const filenameNeutralinojsConfig = 'neutralino.config.json';

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

function buildWASM() {
  console.log('[build] Building WASM...');

  const wasm = spawnSync(
    'wasm-pack',
    ['build', 'backend', '--release', '--target', 'web', '--no-pack', '--no-typescript', '--out-dir', '../www/pkg'],
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
}

function buildNeutralinojs() {
  const original = readFileSync(filenameNeutralinojsConfig, 'utf8');
  const config = JSON.parse(original);

  if (config.modes?.window?.enableInspector) {
    delete config.modes.enableInspector;
    writeFileSync(filenameNeutralinojsConfig, `${JSON.stringify(config, null, 2)}\n`);
    console.log('[build] Removed `modes.enableInspector` from `neutralino.config.json` via neu build');
  }

  process.on('SIGINT', () => {});

  try {
    const neu = spawnSync(['neu', 'build', ...process.argv.slice(2)].join(' '), { stdio: 'inherit', shell: true });
    return neu.status;
  } finally {
    writeFileSync(filenameNeutralinojsConfig, original);
    console.log('[build] Restored `neutralino.config.json`');
  }
}

consoleOverriding();
buildWASM();
process.exit(buildNeutralinojs() ?? 1);