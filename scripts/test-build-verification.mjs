import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const verifier = fileURLToPath(new URL('./verify-build.mjs', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'kane-build-verification-'));
try {
  await cp('dist', join(fixture, 'dist'), { recursive: true });
  await mkdir(join(fixture, 'src'));
  await cp('src/content', join(fixture, 'src/content'), { recursive: true });
  const index = join(fixture, 'dist/index.html');
  const html = await readFile(index, 'utf8');
  assert(html.includes('</body>'), 'Expected a complete built index.html');
  const run = () => spawnSync(process.execPath, [verifier], { cwd: fixture, encoding: 'utf8', timeout: 30000 });
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  console.log('PASS: isolated copy of current build passes verification');

  for (const [label, injection, expected] of [
    ['broken link', '<a href="/agent-test-missing-route">fixture</a>', 'missing /agent-test-missing-route'],
    ['missing image', '<img src="/assets/agent-test-missing.webp" alt="fixture" width="1" height="1">', 'missing /assets/agent-test-missing.webp'],
  ]) {
    await writeFile(index, html.replace('</body>', `${injection}</body>`));
    result = run();
    assert.equal(result.status, 1, `${label} must fail; ${result.stderr}`);
    assert(result.stderr.includes(expected), result.stderr);
    console.log(`PASS: ${label} is rejected by the build verifier`);
  }
} finally {
  await rm(fixture, { recursive: true, force: true });
}
