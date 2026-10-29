import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { imageSize } from 'image-size';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

const root = resolve('dist');
const files = readdirSync(root, { recursive: true }).filter((file) => file.endsWith('.html'));
const decode = (text) => text.replace(/&#x([\da-f]+);|&#(\d+);|&(amp|quot|apos|lt|gt);/gi, (_, hex, dec, named) =>
  hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[named]);
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], decode(match[2])]));
function verifyCover(file, html, meta, data, kind) {
  const expectedCover = new URL(data.cover, 'https://kanelogger.com').href;
  assert.equal(meta['og:image'], expectedCover, `${file}: ${kind} share image must use its cover`);
  assert.equal(meta['og:image:type'], 'image/webp');
  assert.equal(meta['og:image:width'], '1200');
  assert.equal(meta['og:image:height'], '900');
  assert.equal(meta['og:image:alt'], data.coverAlt);
  assert.equal(meta['twitter:image:alt'], data.coverAlt);
  const coverTags = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => attributes(tag)).filter((attrs) => attrs.src === data.cover);
  assert.equal(coverTags.length, 1, `${file}: ${kind} must display its cover exactly once`);
  assert.equal(coverTags[0].alt, data.coverAlt);
  assert.equal(coverTags[0].width, '1200');
  assert.equal(coverTags[0].height, '900');
  assert.equal(coverTags[0].loading, 'eager');
  const coverBytes = readFileSync(join(root, data.cover));
  const size = imageSize(coverBytes);
  assert.deepEqual([size.type, size.width, size.height], ['webp', 1200, 900]);
  const fingerprint = createHash('sha256').update(coverBytes).digest('hex').slice(0, 10);
  assert(data.cover.endsWith(`/cover-${fingerprint}.webp`), `${file}: cover filename must match its content fingerprint`);
  return expectedCover;
}

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
  assert.equal(meta['twitter:image'], meta['og:image'], `${file}: Twitter and OG images must match`);
  assert.equal(meta['twitter:card'], 'summary_large_image');
  const relativeFile = file.slice(root.length + 1);
  const route = relativeFile === '404.html' ? '/404' : '/' + relativeFile.replace(/index\.html$/, '').replace(/\/$/, '');
  const is404 = route === '/404' || route === '/en/404';
  if (/^\/(?:en\/)?writing\/[^/]+$/.test(route)) {
    const jsonLd = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
    assert(jsonLd, `${file}: missing article structured data`);
    const posting = JSON.parse(jsonLd);
    assert.equal(posting['@context'], 'https://schema.org');
    assert.equal(posting['@type'], 'BlogPosting');
    assert.equal(posting.mainEntityOfPage, 'https://kanelogger.com' + route);
    assert.equal(posting.headline, title.replace(/ — KANE$/, ''));
    assert.equal(posting.description, meta.description);
    assert.equal(posting.inLanguage, route.startsWith('/en/') ? 'en' : 'zh-CN');
    assert.equal(posting.datePublished, meta['article:published_time']);
    assert.equal(posting.author?.name, meta.author);
    const locale = route.startsWith('/en/') ? 'en' : 'zh-CN';
    const slug = route.split('/').at(-1);
    const source = readFileSync(join('src/content/blog', locale, `${slug}.md`), 'utf8');
    const data = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
    const expectedCover = verifyCover(file, html, meta, data, 'article');
    assert.equal(posting.image, expectedCover, `${file}: structured image must use the article cover`);
  } else if (/^\/(?:en\/)?work\/[^/]+$/.test(route)) {
    const locale = route.startsWith('/en/') ? 'en' : 'zh-CN';
    const slug = route.split('/').at(-1);
    const source = readFileSync(join('src/content/projects', locale, `${slug}.md`), 'utf8');
    const data = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
    verifyCover(file, html, meta, data, 'project');
    assert.equal(meta['og:type'], 'website');
  } else {
    assert.equal(meta['og:image'], 'https://kanelogger.com/og.png');
  }
  if (is404) {
    assert.equal(meta.robots, 'noindex, follow');
    assert.match(html, route.startsWith('/en') ? /href="\/en">Back home/ : /href="\/">返回首页/);
  } else if (meta.robots?.includes('noindex')) {
    assert(route.startsWith('/en/'), `${file}: only English summary pages may be noindex`);
  } else {
    const canonical = attributes(html.match(/<link rel="canonical"[^>]*>/)?.[0] ?? '').href;
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
      assert((attrs.alt || (attrs.alt === '' && attrs.role === 'presentation')) && Number(attrs.width) > 0 && Number(attrs.height) > 0, `${file}: image needs alt and dimensions`);
      assert(href.startsWith('/assets/'), `${file}: image must be hosted locally`);
    }
    const url = new URL(href, 'https://kanelogger.com/' + files.find((entry) => join(root, entry) === file));
    if (url.origin !== 'https://kanelogger.com') continue;
    let target = resolve(root, '.' + decodeURIComponent(url.pathname));
    assert(target.startsWith(root), `${file}: invalid local path ${href}`);
    if (url.pathname === '/404') target = join(root, '404.html');
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
// The prologue must never cover content in the server-rendered/no-JS page.
for (const route of ['index.html', 'en/index.html']) {
  const html = pages.get(join(root, route)).html;
  const dialog = html.match(/<dialog\b[^>]*data-entrance[^>]*>/)?.[0];
  assert(dialog, `${route}: missing entrance dialog`);
  assert(!/\sopen(?:[\s=>])/.test(dialog), `${route}: entrance must be closed without JavaScript`);
  assert.match(html, /<button\b[^>]*data-entrance-replay[^>]*\bhidden(?:[\s=>])/, `${route}: replay must be hidden without JavaScript`);
  assert.match(html, /id="hero-title"[^>]*tabindex="-1"/, `${route}: missing entrance focus destination`);
}
const entrancePoster = readFileSync(join(root, 'assets/brand/entrance-filaments.svg'));
assert(gzipSync(entrancePoster).length <= 40 * 1024, 'Entrance poster exceeds its 40 KiB gzip budget');
console.log('Verified entrance no-JavaScript defaults, focus destination and static poster budget.');
// Both designs must ship with real links, including in the no-JavaScript build.
const originalHome = pages.get(join(root, 'index.html')).html;
const workshopHome = pages.get(join(root, 'workshop/index.html'));
assert(workshopHome, 'Workshop home route must be built');
assert.match(originalHome, /<a\b[^>]*href="\/workshop"[^>]*data-astro-reload[^>]*>切换工作台设计/, 'Home must link to the workshop design');
assert.match(workshopHome.html, /<a\b[^>]*class="design-switch"[^>]*href="\/"[^>]*data-astro-reload[^>]*>切换原版首页/, 'Workshop must link back to the original home');
console.log('Verified both home designs and their no-JavaScript switch links.');
const englishArticlePages = new Map([...pages].filter(([file]) => file.includes('/en/writing/')).map(([file, { html }]) => {
  const route = '/' + file.slice(root.length + 1).replace(/index\.html$/, '').replace(/\/$/, '');
  const meta = Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => { const attrs = attributes(tag); return [attrs.property ?? attrs.name, attrs.content]; }));
  return [new URL(route, 'https://kanelogger.com').href, { title: decode(html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '').replace(/ — KANE$/, ''), date: Date.parse(meta['article:published_time']) }];
}));
const englishRssPath = join(root, 'en/rss.xml');
assert(existsSync(englishRssPath), 'English RSS must be generated');
const englishRss = readFileSync(englishRssPath, 'utf8');
assert.match(englishRss, /<language>en<\/language>/);
const englishItems = [...englishRss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
for (const item of englishItems) {
  const link = xmlText(item, 'link');
  const expected = englishArticlePages.get(link);
  assert(expected, `English RSS: unknown article ${link}`);
  assert.equal(xmlText(item, 'title'), expected.title);
  assert.equal(Date.parse(xmlText(item, 'pubDate')), expected.date);
}
const og = imageSize(readFileSync(join(root, 'og.png')));
assert.deepEqual([og.type, og.width, og.height], ['png', 1200, 630]);
assert.match(readFileSync(join(root, 'favicon.svg'), 'utf8'), /<svg/);
// A new Markdown file must be linked from its index and get its own route.
const dashboard = pages.get(join(root, 'dashboard/index.html'));
assert(dashboard, 'The content dashboard must have a statically built route');
for (const route of ['apps/index.html', 'en/apps/index.html']) {
  const appPage = pages.get(join(root, route));
  assert(appPage, `${route}: app directory route must be built`);
  assert.match(appPage.html, /\bdata-app-navigation(?:\s|=|>)/, `${route}: missing app directory root`);
  assert.match(appPage.html, /<noscript>/, `${route}: missing no-JavaScript explanation`);
  assert.match(appPage.html, /\bdata-theme-control(?:\s|=|>)/, `${route}: missing theme control`);
}
for (const [collection, route] of [['blog', 'writing'], ['projects', 'work']]) {
  for (const file of readdirSync(`src/content/${collection}`, { recursive: true }).filter((name) => String(name).endsWith('.md'))) {
    const parts = String(file).split('/');
    const locale = parts[0];
    const slug = parts.at(-1).slice(0, -3);
    const source = readFileSync(join('src/content', collection, String(file)), 'utf8');
    const status = source.match(/^translationStatus:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim();
    const publishedPrefix = locale === 'en' && status === 'reviewed' ? '/en' : '';
    const prefix = locale === 'en' ? '/en' : '';
    const page = pages.get(join(root, publishedPrefix.slice(1), route, slug, 'index.html')) ?? pages.get(join(root, route, slug, 'index.html'));
    assert(page, `${file}: missing detail page`);
    const indexFile = join(root, prefix.slice(1), route, 'index.html');
    const dashboardFile = locale === 'en' ? join(root, 'en/dashboard/index.html') : join(root, 'dashboard/index.html');
    const index = pages.get(indexFile)?.html;
    const board = pages.get(dashboardFile)?.html;
    assert(index && board, `${file}: missing locale index/dashboard`);
    assert(index.includes(`href="${publishedPrefix}/${route}/${slug}"`), `${file}: missing from list`);
    assert(board.includes(`href="${publishedPrefix}/${route}/${slug}"`), `${file}: missing from dashboard`);
    {
      const data = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
      for (const [name, html] of [['list', index], ['dashboard', board]]) {
        const cover = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => attributes(tag)).find((attrs) => attrs.src === data.cover);
        assert(cover, `${file}: cover missing from ${name}`);
        assert.equal(cover.alt, data.coverAlt);
        assert.equal(cover.loading, 'lazy');
      }
    }
  }
}
console.log(`Verified ${pages.size} pages, ${links} local references, ${images} images, theme controls, and every Markdown route in its list and dashboard.`);
console.log(`Verified ${canonicalUrls.size} canonical/sitemap URLs, ${items.length} RSS entries, robots, OG image, favicon, and 404.`);
