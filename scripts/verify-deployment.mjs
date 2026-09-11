import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Compare a preview or production deployment with the locally verified build.
const base = process.argv[2];
assert(base, 'Usage: node scripts/verify-deployment.mjs https://kanelogger.com');
const files = readdirSync('dist', { recursive: true });
const resources = new Map();
const titles = new Map();
for (const file of files.filter((file) => file.endsWith('.html') && file !== '404.html')) {
  const route = '/' + file.replace(/index\.html$/, '').replace(/\/$/, '');
  const html = readFileSync(join('dist', file), 'utf8');
  resources.set(route, file);
  titles.set(route, html.match(/<title>([^<]+)<\/title>/)[1]);
  for (const [, path] of html.matchAll(/(?:src|href)="(\/(?:assets|_astro)\/[^"#]+)"/g)) {
    resources.set(path, decodeURIComponent(path.slice(1)));
  }
}
for (const file of ['rss.xml', 'robots.txt', 'sitemap-index.xml', 'sitemap-0.xml', 'og.png', 'favicon.svg']) resources.set('/' + file, file);
const hash = (data) => createHash('sha256').update(data).digest('hex');
const results = [];
const entries = [...resources];
async function worker() {
  for (;;) {
    const next = entries.shift();
    if (!next) return;
    const [path, file] = next;
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (titles.has(path)) {
      const html = body.toString();
      assert.equal(html.match(/<title>([^<]+)<\/title>/)?.[1], titles.get(path), `${path}: stale page title`);
      assert(html.includes(`rel="canonical" href="https://kanelogger.com${path}"`), `${path}: canonical missing`);
      assert(html.includes('https://kanelogger.com/og.png'), `${path}: share image missing`);
      assert(!/noindex/i.test(response.headers.get('x-robots-tag') ?? ''), `${path}: blocked by HTTP header`);
    }
    assert.equal(hash(body), hash(readFileSync(join('dist', file))), `${path}: differs from verified build`);
    results.push({ path, status: response.status, bytes: body.length });
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const missing = await fetch(new URL('/release-check-missing', base));
assert.equal(missing.status, 404, 'Missing route must return HTTP 404');
const errorPage = await missing.text();
assert(errorPage.includes('页面未找到。') && errorPage.includes('href="/">返回首页'), 'Custom 404/home link missing');
assert(errorPage.includes('noindex, follow'), '404 must not be indexed');
console.log(JSON.stringify({ base, pages: titles.size, resources: results.length, missingStatus: 404, results: results.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2));
