import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve('dist');
const manifest = JSON.parse(readFileSync(resolve(root, '_astro/scene-manifest.json'), 'utf8'));
const dependencies = (chunk) => [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])];
const scene = Object.keys(manifest).find((key) => (manifest[key].src ?? key).endsWith('/sculpture-scene.ts'));
assert(scene, 'Client chunk manifest must include the dynamic sculpture-scene.ts entry');

// Include the bootstrap that imports the scene as well as every static and
// dynamic dependency. Follow manifest edges instead of parsing minified JS.
const ancestors = new Set([scene]);
let changed = true;
while (changed) {
  changed = false;
  for (const [key, chunk] of Object.entries(manifest)) {
    if (!ancestors.has(key) && dependencies(chunk).some((dependency) => ancestors.has(dependency))) {
      ancestors.add(key);
      changed = true;
    }
  }
}
const visited = new Set();
const files = new Set();
const visit = (key) => {
  if (visited.has(key)) return;
  const chunk = manifest[key];
  assert(chunk, `Client manifest references a missing chunk: ${key}`);
  visited.add(key);
  if (chunk.file.endsWith('.js')) files.add(chunk.file);
  dependencies(chunk).forEach(visit);
};
ancestors.forEach(visit);
const chunks = [...files].sort().map((file) => ({ file, gzipBytes: gzipSync(readFileSync(resolve(root, file))).length }));
const gzipBytes = chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0);
console.log(JSON.stringify({ scene, gzipBytes, limitBytes: 250 * 1024, chunks }, null, 2));
assert(gzipBytes <= 250 * 1024, `3D entry and dependencies use ${(gzipBytes / 1024).toFixed(1)} KiB gzip; limit is 250 KiB`);
for (const theme of ['light', 'dark']) {
  const file = `assets/brand/k-${theme}.webp`;
  const bytes = readFileSync(resolve(root, file)).length;
  assert(bytes <= 120 * 1024, `${file}: ${(bytes / 1024).toFixed(1)} KiB exceeds the 120 KiB poster limit`);
  console.log(`Verified ${file}: ${bytes} bytes.`);
}
