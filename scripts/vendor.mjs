import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

(async () => {
  const res = await fetch('https://registry.npmjs.org/three/latest');
  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

  const data = await response.json();
  const latestVersion = data.version;

  const base = `https://cdn.jsdelivr.net/npm/three@${latestVersion}/`
  const dist = 'www/vendor/three/';
  const entires = [
    'LICENSE',
    'build/three.module.js',
    'examples/jsm/controls/OrbitControls.js',
  ];
  const seen = new Set();

  async function grab(file) {
    if (seen.has(file)) return;
    seen.add(file);

    const res = await fetch(base + file);
    if (!res.ok) throw new Error(`${res.status} ${file}`);
    const src = await res.text();

    const dest = dist + file;
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, src);

    for (const m of src.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      await grab(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
    }
  }

  for (const f of entires) await grab(f);
})();
