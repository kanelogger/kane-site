import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { imageSize } from 'image-size';

const root = resolve('dist');
const files = readdirSync(root, { recursive: true }).filter((file) => file.endsWith('.html'));
const decode = (text) => text.replace(/&#x([\da-f]+);|&#(\d+);|&(amp|quot|apos|lt|gt);/gi, (_, hex, dec, named) =>
  hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[named]);
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], decode(match[2])]));
const pages = new Map(files.map((file) => {
  const html = readFileSync(join(root, file), 'utf8');
  return [join(root, file), { html, ids: new Set([...html.matchAll(/\bid="([^"]*)"/g)].map((match) => decode(match[1]))) }];
}));
let links = 0;
let images = 0;
const canonicalUrls = new Set();
const articlePages = new Map();
for (const [file, { html }] of pages) {
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: expected exactly one h1`);
  assert.match(html, /<meta name="description" content="[^"]+"/);
  assert.match(html, /\bdata-theme-control(?:\s|=|>)/, `${file}: missing theme control`);
  assert(!/\/Users\/(?!yourname\/)/.test(html), `${file}: private source path leaked`);
  const meta = Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => {
    const attrs = attributes(tag);
    return [attrs.property ?? attrs.name, attrs.content];
  }));
  const title = decode(html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '');
  assert(title.length > 0, `${file}: missing title`);
  assert.equal(meta['og:title'], title);
  assert.equal(meta['og:description'], meta.description);
  assert.equal(meta['og:image'], 'https://kanelogger.com/og.png');
  assert.equal(meta['twitter:card'], 'summary_large_image');
  if (file === join(root, '404.html')) {
    assert.equal(meta.robots, 'noindex, follow');
    assert.match(html, /href="\/">返回首页/);
  } else {
    assert(!meta.robots?.includes('noindex'), `${file}: public page blocked`);
    const canonical = attributes(html.match(/<link rel="canonical"[^>]*>/)?.[0] ?? '').href;
    const route = '/' + file.slice(root.length + 1).replace(/index\.html$/, '').replace(/\/$/, '');
    assert.equal(canonical, 'https://kanelogger.com' + route, `${file}: wrong canonical`);
    assert.equal(meta['og:url'], canonical);
    assert(!canonicalUrls.has(canonical), `${file}: duplicate canonical`);
    canonicalUrls.add(canonical);
    if (route.startsWith('/writing/')) {
      assert.equal(meta['og:type'], 'article');
      assert(Number.isFinite(Date.parse(meta['article:published_time'])));
      articlePages.set(canonical, { title: title.replace(/ — KANE$/, ''), date: Date.parse(meta['article:published_time']) });
    }
  }
  for (const [tag] of html.matchAll(/<(?:a|img|link)\b[^>]*>/g)) {
    const attrs = attributes(tag);
    const href = attrs.href ?? attrs.src;
    if (!href) continue;
    if (tag.startsWith('<img')) {
      images++;
      assert(attrs.alt && Number(attrs.width) > 0 && Number(attrs.height) > 0, `${file}: image needs alt and dimensions`);
      assert(href.startsWith('/assets/'), `${file}: image must be hosted locally`);
    }
    const url = new URL(href, 'https://kanelogger.com/' + files.find((entry) => join(root, entry) === file));
    if (url.origin !== 'https://kanelogger.com') continue;
    let target = resolve(root, '.' + decodeURIComponent(url.pathname));
    assert(target.startsWith(root), `${file}: invalid local path ${href}`);
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    assert(existsSync(target), `${file}: missing ${href}`);
    if (url.hash && pages.has(target)) assert(pages.get(target).ids.has(decodeURIComponent(url.hash.slice(1))), `${file}: missing anchor ${href}`);
    links++;
  }
}
const locations = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1]));
const sitemapIndex = readFileSync(join(root, 'sitemap-index.xml'), 'utf8');
const sitemapUrls = locations(sitemapIndex).flatMap((url) => {
  assert.equal(new URL(url).origin, 'https://kanelogger.com');
  return locations(readFileSync(join(root, new URL(url).pathname), 'utf8'));
});
assert.equal(sitemapUrls.length, canonicalUrls.size);
assert.deepEqual(new Set(sitemapUrls), canonicalUrls, 'sitemap must list exactly the indexable pages');
const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
assert.match(robots, /User-agent: \*/);
assert.match(robots, /Allow: \//);
assert(!/^Disallow:\s*\S/m.test(robots));
assert.match(robots, /Sitemap: https:\/\/kanelogger.com\/sitemap-index.xml/);
const rss = readFileSync(join(root, 'rss.xml'), 'utf8');
const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
const xmlText = (item, tag) => decode((item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '').replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1'));
assert.equal(items.length, articlePages.size);
const rssLinks = new Set();
let previousDate = Infinity;
const writingIndex = pages.get(join(root, 'writing/index.html')).html;
let previousPosition = -1;
for (const item of items) {
  const link = xmlText(item, 'link');
  const expected = articlePages.get(link);
  assert(expected, `RSS: unknown article ${link}`);
  assert(!rssLinks.has(link), `RSS: duplicate article ${link}`);
  rssLinks.add(link);
  assert.equal(xmlText(item, 'title'), expected.title);
  const date = Date.parse(xmlText(item, 'pubDate'));
  assert.equal(date, expected.date);
  assert(date <= previousDate, 'RSS must be newest first');
  previousDate = date;
  const position = writingIndex.indexOf(`href="${new URL(link).pathname}"`);
  assert(position > previousPosition, 'RSS order must match Writing');
  previousPosition = position;
}
const og = imageSize(readFileSync(join(root, 'og.png')));
assert.deepEqual([og.type, og.width, og.height], ['png', 1200, 630]);
assert.match(readFileSync(join(root, 'favicon.svg'), 'utf8'), /<svg/);
// A new Markdown file must be linked from its index and get its own route.
const dashboard = pages.get(join(root, 'dashboard/index.html'));
assert(dashboard, 'The content dashboard must have a statically built route');
for (const [collection, route] of [['blog', 'writing'], ['projects', 'work']]) {
  const index = pages.get(join(root, route, 'index.html')).html;
  for (const file of readdirSync(`src/content/${collection}`).filter((name) => name.endsWith('.md'))) {
    const slug = file.slice(0, -3);
    assert(pages.has(join(root, route, slug, 'index.html')), `${file}: missing detail page`);
    assert(index.includes(`href="/${route}/${slug}"`), `${file}: missing from list`);
    assert(dashboard.html.includes(`href="/${route}/${slug}"`), `${file}: missing from dashboard`);
  }
}
console.log(`Verified ${pages.size} pages, ${links} local references, ${images} images, theme controls, and every Markdown route in its list and dashboard.`);
console.log(`Verified ${canonicalUrls.size} canonical/sitemap URLs, ${items.length} RSS entries, robots, OG image, favicon, and 404.`);
