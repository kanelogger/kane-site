import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sceneManifest from './scene-manifest.mjs';

const verifier = fileURLToPath(new URL('./verify-scene-budget.mjs', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'kane-scene-budget-'));
const dist = join(fixture, 'dist');
try {
  for (const dir of ['_astro', 'assets/brand']) await mkdir(join(dist, dir), { recursive: true });
  const chunks = [
    { fileName: '_astro/bootstrap.js', imports: ['_astro/shared.js'], dynamicImports: ['_astro/scene.js'] },
    { fileName: '_astro/scene.js', facadeModuleId: '/private/example/project/src/scripts/sculpture-scene.ts', imports: ['_astro/shared.js'], dynamicImports: ['_astro/indirect.js'] },
    { fileName: '_astro/indirect.js', imports: ['_astro/shared.js'], dynamicImports: [] },
    { fileName: '_astro/shared.js', imports: [], dynamicImports: [] },
    { fileName: '_astro/unrelated.js', imports: [], dynamicImports: [] },
  ];
  const plugin = sceneManifest();
  assert(plugin.applyToEnvironment({ name: 'client' }));
  assert(!plugin.applyToEnvironment({ name: 'prerender' }));
  assert(!plugin.applyToEnvironment({ name: 'ssr' }));
  let manifest;
  plugin.generateBundle.handler.call({ emitFile: (asset) => { manifest = asset; } }, {},
    Object.fromEntries(chunks.map((chunk) => [chunk.fileName, { type: 'chunk', ...chunk }])));
  assert.equal(manifest.fileName, '_astro/scene-manifest.json');
  assert(!manifest.source.includes('/private/example'), 'Build manifests must not expose local machine paths');
  await writeFile(join(dist, manifest.fileName), manifest.source);
  for (const chunk of chunks) await writeFile(join(dist, chunk.fileName), 'export const example = 1;');
  for (const theme of ['light', 'dark']) await writeFile(join(dist, `assets/brand/k-${theme}.webp`), 'fixture');
  const run = () => spawnSync(process.execPath, [verifier], { cwd: fixture, encoding: 'utf8' });

  let result = run();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.slice(0, result.stdout.indexOf('\nVerified')));
  assert.deepEqual(report.chunks.map(({ file }) => file), [
    '_astro/bootstrap.js', '_astro/indirect.js', '_astro/scene.js', '_astro/shared.js',
  ], 'Count the importing bootstrap and indirect dynamic dependencies, deduplicate shared chunks, and exclude unrelated scripts');
  console.log('PASS: client-only manifest, private path removal, full scene graph, and deduplication');

  await writeFile(join(dist, '_astro/indirect.js'), randomBytes(260 * 1024));
  result = run();
  assert.notEqual(result.status, 0, 'A large indirect dynamic dependency must exceed the scene budget');
  assert(result.stderr.includes('limit is 250 KiB'), result.stderr);
  console.log('PASS: oversized indirect dynamic chunks are rejected');

  await writeFile(join(dist, '_astro/indirect.js'), 'export const fixed = 1;');
  await writeFile(join(dist, 'assets/brand/k-dark.webp'), Buffer.alloc(120 * 1024 + 1));
  result = run();
  assert.notEqual(result.status, 0, 'Each poster must fit the independent asset budget');
  assert(result.stderr.includes('poster limit'), result.stderr);
  console.log('PASS: oversized individual posters are rejected');
} finally {
  await rm(fixture, { recursive: true, force: true });
}
