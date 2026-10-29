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
    ['missing alt', '<img src="/assets/brand/entrance-filaments.svg" width="1000" height="1000">', 'image needs alt and dimensions'],
    ['missing image', '<img src="/assets/agent-test-missing.webp" alt="fixture" width="1" height="1">', 'missing /assets/agent-test-missing.webp'],
  ]) {
    await writeFile(index, html.replace('</body>', `${injection}</body>`));
    result = run();
    assert.equal(result.status, 1, `${label} must fail; ${result.stderr}`);
    assert(result.stderr.includes(expected), result.stderr);
    console.log(`PASS: ${label} is rejected by the build verifier`);
  }
  await writeFile(index, html);
  await writeFile(index, html.replace('<dialog ', '<dialog open '));
  result = run();
  assert.equal(result.status, 1, `server-open entrance must fail; ${result.stderr}`);
  assert(result.stderr.includes('entrance must be closed without JavaScript'), result.stderr);
  console.log('PASS: server-open entrance is rejected to protect no-JavaScript access');
  await writeFile(index, html);
  const workshopPath = join(fixture, 'dist/workshop/index.html');
  const workshopHtml = await readFile(workshopPath, 'utf8');
  for (const [label, path, source, from, expected] of [
    ['workshop switch', index, html, 'href="/workshop"', 'Home must link to the workshop design'],
    ['original home switch', workshopPath, workshopHtml, 'class="design-switch" href="/"', 'Workshop must link back to the original home'],
  ]) {
    assert(source.includes(from), `${label}: fixture must contain the real link`);
    await writeFile(path, source.replace(from, from.replace(/href="[^"]+"/, 'href="/about"')));
    result = run();
    assert.equal(result.status, 1, `${label} must fail; ${result.stderr}`);
    assert(result.stderr.includes(expected), result.stderr);
    await writeFile(path, source);
    console.log(`PASS: missing ${label} is rejected`);
  }
  const articlePath = join(fixture, 'dist/writing/agent-hard-gates/index.html');
  const articleHtml = await readFile(articlePath, 'utf8');
  for (const [label, from, to, expected] of [
    ['article share fallback', /(<meta property="og:image" content=")[^"]+/, '$1https://kanelogger.com/og.png', 'Twitter and OG images must match'],
    ['wrong share dimensions', /(<meta property="og:image:height" content=")900/, '$1630', '900'],
    ['missing article cover', /<img[^>]+class="article-cover-image"[^>]*>/, '', 'article must display its cover exactly once'],
  ]) {
    assert.notEqual(articleHtml.replace(from, to), articleHtml, `${label}: mutation must change fixture`);
    await writeFile(articlePath, articleHtml.replace(from, to));
    result = run();
    assert.equal(result.status, 1, `${label} must fail; ${result.stderr}`);
    assert(result.stderr.includes(expected), result.stderr);
    console.log(`PASS: ${label} is rejected`);
  }
  await writeFile(articlePath, articleHtml.replace(/<script type="application\/ld\+json">[^<]+<\/script>/, ''));
  result = run();
  assert.equal(result.status, 1, `missing article data must fail; ${result.stderr}`);
  assert(result.stderr.includes('missing article structured data'), result.stderr);
  console.log('PASS: missing article structured data is rejected by the build verifier');
} finally {
  await rm(fixture, { recursive: true, force: true });
}
