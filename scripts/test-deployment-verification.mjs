import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep failure injection isolated from dist while other agents build the site.
const verifier = fileURLToPath(new URL('./verify-deployment.mjs', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'kane-deployment-verification-'));
const dist = join(fixture, 'dist');
const encodePath = (file) => '/' + file.split('/').map(encodeURIComponent).join('/');
const dynamicChunk = '_astro/sculpture.dynamic.js';
const dependency = '_astro/nested/geometry.js';
const unusualAsset = 'assets/场景 纹理/材质 # % ? +.bin';
const html = '<title>KANE fixture</title><link rel="canonical" href="https://kanelogger.com/">'
  + '<meta property="og:image" content="https://kanelogger.com/og.png">'
  + '<script type="module" src="/_astro/entry.js"></script>'
  + `<link href="${encodePath(unusualAsset)}" rel="preload">`;
const errorPage = '<meta name="robots" content="noindex, follow"><h1>页面未找到。</h1><a href="/">返回首页</a>';
const files = {
  'index.html': html,
  '404.html': errorPage,
  '_astro/entry.js': 'export const load = () => import("./sculpture.dynamic.js");',
  [dynamicChunk]: 'import { geometry } from "./nested/geometry.js"; export default geometry;',
  [dependency]: 'export const geometry = "verified geometry";',
  [unusualAsset]: 'encoded path fixture',
  'assets/fonts/only-in-css.woff2': 'font fixture',
  'rss.xml': '<rss/>',
  'robots.txt': 'User-agent: *\nAllow: /',
  'sitemap-index.xml': '<sitemapindex/>',
  'sitemap-0.xml': '<urlset/>',
  'og.png': 'image fixture',
  'favicon.svg': '<svg/>',
};
let absent = '';
const modified = new Map();
let noindex = false;
let missingStatus = 404;
const requests = new Map();
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://fixture.local').pathname;
  requests.set(pathname, (requests.get(pathname) ?? 0) + 1);
  const file = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  if (file === 'release-check-missing' || file === absent) {
    response.writeHead(file === absent ? 404 : missingStatus);
    response.end(errorPage);
    return;
  }
  try {
    assert(resolve(dist, file).startsWith(dist + '/'));
    const body = modified.get(file) ?? await readFile(join(dist, file));
    response.writeHead(200, noindex && file === 'index.html' ? { 'x-robots-tag': 'noindex' } : {});
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end(errorPage);
  }
});

try {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(dirname(join(dist, file)), { recursive: true });
    await writeFile(join(dist, file), content);
  }
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const run = async () => {
    requests.clear();
    const child = spawn(process.execPath, [verifier, base], { cwd: fixture, timeout: 45000 });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    const [code] = await once(child, 'close');
    return { code, stdout, stderr };
  };

  absent = dynamicChunk;
  let result = await run();
  assert.notEqual(result.code, 0, 'A dynamic chunk absent from HTML must fail deployment verification');
  assert(result.stderr.includes(`${base}/${dynamicChunk}: HTTP 404`), result.stderr);
  console.log('PASS: an unreferenced dynamic chunk returning 404 reports its URL');

  absent = '';
  modified.set(dependency, 'export const geometry = "stale geometry";');
  result = await run();
  assert.notEqual(result.code, 0, 'A changed indirect dependency must fail deployment verification');
  assert(result.stderr.includes(`${base}/${dependency}: differs from verified build`), result.stderr);
  console.log('PASS: changed indirect dependency reports its URL');

  modified.clear();
  modified.set('index.html', html.replace('rel="canonical"', 'rel="obsolete"'));
  result = await run();
  assert.notEqual(result.code, 0, 'Canonical validation must remain active');
  assert(result.stderr.includes('canonical missing'), result.stderr);
  console.log('PASS: canonical checks remain active');

  modified.clear();
  noindex = true;
  result = await run();
  assert.notEqual(result.code, 0, 'Deployment HTTP headers must allow indexing');
  assert(result.stderr.includes('blocked by HTTP header'), result.stderr);
  console.log('PASS: deployment noindex headers are rejected');

  noindex = false;
  missingStatus = 200;
  result = await run();
  assert.notEqual(result.code, 0, 'A missing route returning 200 must fail');
  assert(result.stderr.includes('Missing route must return HTTP 404'), result.stderr);
  console.log('PASS: custom missing routes must return 404');

  missingStatus = 404;
  result = await run();
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.resources, Object.keys(files).length - 1, 'Every resource except the direct 404 route is compared');
  assert.equal(new Set(report.results.map(({ path }) => path)).size, report.resources, 'Resource URLs must be deduplicated');
  assert.equal(requests.get(encodePath(unusualAsset)), 1, 'Encode every path segment exactly once, even when also referenced in HTML');
  assert.equal(requests.get('/assets/fonts/only-in-css.woff2'), 1, 'Assets without HTML references must be checked');
  console.log('PASS: complete deployment, nested assets, encoded paths, and deduplication');
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(fixture, { recursive: true, force: true });
}
