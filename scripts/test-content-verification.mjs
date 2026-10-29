import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { stringify } from 'yaml';
import sharp from 'sharp';
import { verifyContent } from './verify-content.mjs';

const put = (root, file, content = '') => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};


async function putCover(root, slug, width = 1200, height = 900, collection = 'blog') {
  const target = join(root, 'public/assets', collection, slug, 'cover.webp');
  mkdirSync(dirname(target), { recursive: true });
  const buffer = await sharp({ create: { width, height, channels: 3, background: '#244b3b' } }).webp().toBuffer();
  writeFileSync(target, buffer);
  return buffer;
}

const markdown = (data, body = '') => `---\n${stringify(data)}---\n\n${body}\n`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kane-content-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const collection of ['blog', 'projects']) mkdirSync(join(root, 'src/content', collection), { recursive: true });
  return root;
}

function article(slug, locale = 'zh-CN', extra = {}) {
  return { locale, translationKey: slug, slug, featured: false, order: 0, cover: `/assets/blog/${slug}/cover.webp`, coverAlt: 'A concept illustration', ...extra };
}

function project(slug, locale = 'zh-CN', order = 1, extra = {}) {
  return { locale, translationKey: slug, slug, order, cover: `/assets/projects/${slug}/cover.webp`, coverAlt: 'A project concept illustration', ...extra };
}

test('current repository content passes the content verifier', async () => {
  const result = await verifyContent();
  assert.deepEqual(result.issues, []);
  assert(result.files > 0);
});

test('valid content allows optional translations, repeated blog order, locale-scoped order, and shared assets', async (t) => {
  const root = fixture(t);
  await putCover(root, 'shared');
  await putCover(root, 'tool', 1200, 900, 'projects');
  put(root, 'src/content/blog/zh-CN/shared.md', markdown(article('shared', 'zh-CN', { featured: true, featuredOrder: 1, cover: '/assets/blog/shared/cover.webp' }), '![中文封面](/assets/blog/shared/cover.webp)'));
  put(root, 'src/content/blog/en/shared.md', markdown(article('shared', 'en', { featured: true, featuredOrder: 1, cover: '/assets/blog/shared/cover.webp' }), '![English cover](/assets/blog/shared/cover.webp)'));
  await putCover(root, 'source-only');
  put(root, 'src/content/blog/zh-CN/source-only.md', markdown(article('source-only', 'zh-CN', { cover: '/assets/blog/source-only/cover.webp' })));
  put(root, 'src/content/projects/zh-CN/tool.md', markdown(project('tool')));
  put(root, 'src/content/projects/en/tool.md', markdown(project('tool', 'en')));

  assert.deepEqual((await verifyContent(root)).issues, []);
});

test('reports path, identity, translation, ordering, and image failures together', async (t) => {
  const root = fixture(t);
  put(root, 'public/assets/blog/images/empty.webp');
  put(root, 'public/assets/projects/cross/cover.webp');
  put(root, 'src/content/blog/fr/Bad_slug.md', markdown(article('Bad_slug', 'en')));
  put(root, 'src/content/blog/zh-CN/filename.md', markdown(article('different')));
  put(root, 'src/content/blog/zh-CN/duplicate-a.md', markdown(article('duplicate', 'zh-CN', { translationKey: 'duplicate-key' })));
  put(root, 'src/content/blog/zh-CN/duplicate-b.md', markdown(article('duplicate', 'zh-CN', { translationKey: 'duplicate-key' })));
  put(root, 'src/content/blog/zh-CN/translated.md', markdown(article('translated', 'zh-CN', { translationKey: 'shared-key' })));
  put(root, 'src/content/blog/en/translated-en.md', markdown(article('translated-en', 'en', { translationKey: 'shared-key' })));
  put(root, 'src/content/blog/zh-CN/images.md', markdown(article('images'), [
    '![](/assets/blog/images/empty.webp)',
    '![remote](https://example.com/image.webp)',
    '![relative](image.webp)',
    '![cross](/assets/projects/cross/cover.webp)',
    '![missing](/assets/blog/images/missing.webp)',
  ].join('\n')));
  put(root, 'src/content/projects/zh-CN/one.md', markdown(project('one', 'zh-CN', 1, { cover: '/assets/projects/one/missing.webp' })));
  put(root, 'src/content/projects/zh-CN/two.md', markdown(project('two', 'zh-CN', 1, { cover: '/assets/projects/two/missing.webp' })));
  put(root, 'src/content/blog/zh-CN/featured-one.md', markdown(article('featured-one', 'zh-CN', { featured: true, featuredOrder: 1 })));
  put(root, 'src/content/blog/zh-CN/featured-two.md', markdown(article('featured-two', 'zh-CN', { featured: true, featuredOrder: 1 })));

  const issues = (await verifyContent(root)).issues.join('\n');
  for (const expected of [
    'content path must be',
    'does not match directory',
    'slug must use lowercase English kebab-case',
    'filename filename.md must match slug different',
    'duplicate blog locale/slug',
    'duplicate blog locale/translationKey',
    'translationKey shared-key must use one shared slug',
    'needs non-empty alt text',
    'must use a root-relative /assets/ path',
    'must stay under /assets/blog/images/',
    'does not exist',
    'duplicate project locale/order',
    'duplicate featured article locale/featuredOrder',
  ]) assert.match(issues, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('reports malformed frontmatter without aborting the scan', async (t) => {
  const root = fixture(t);
  put(root, 'src/content/blog/zh-CN/broken.md', '---\nslug: [broken\n---\n');
  put(root, 'src/content/blog/zh-CN/missing.md', '# no frontmatter');
  const issues = (await verifyContent(root)).issues.join('\n');
  assert.match(issues, /invalid YAML frontmatter/);
  assert.match(issues, /missing or malformed YAML frontmatter/);
});


test('article covers require descriptions, decodable WebP pixels and exact 4:3 dimensions', async (t) => {
  const root = fixture(t);
  const cases = [
    ['missing', { cover: undefined }, 'article cover is required'],
    ['description', { coverAlt: ' ' }, 'coverAlt must be non-empty'],
    ['corrupt', {}, 'article cover cannot be decoded'],
    ['truncated', {}, 'article cover cannot be decoded'],
    ['wide', {}, 'article cover must have a 4:3 aspect ratio'],
    ['small', {}, 'article cover must be 1200×900'],
    ['png', {}, 'article cover must be WebP'],
  ];
  for (const [slug, extra] of cases) {
    await putCover(root, slug, slug === 'small' ? 400 : 1200, slug === 'wide' ? 630 : slug === 'small' ? 300 : 900);
    put(root, `src/content/blog/zh-CN/${slug}.md`, markdown(article(slug, 'zh-CN', extra)));
  }
  put(root, 'public/assets/blog/corrupt/cover.webp', 'not an image');
  const valid = await putCover(root, 'truncated');
  put(root, 'public/assets/blog/truncated/cover.webp', valid.subarray(0, 40));
  put(root, 'public/assets/blog/png/cover.webp', await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#244b3b' } }).png().toBuffer());
  const issues = (await verifyContent(root)).issues;
  for (const [slug, , expected] of cases) assert(issues.some((issue) => issue.includes(`${slug}.md:`) && issue.includes(expected)), `${slug}: ${issues.join('\n')}`);
});

test('project covers require descriptions, decodable WebP pixels and exact 4:3 dimensions', async (t) => {
  const root = fixture(t);
  const cases = [
    ['missing', { cover: undefined }, 'project cover is required'],
    ['description', { coverAlt: ' ' }, 'coverAlt must be non-empty'],
    ['corrupt', {}, 'project cover cannot be decoded'],
    ['truncated', {}, 'project cover cannot be decoded'],
    ['wide', {}, 'project cover must have a 4:3 aspect ratio'],
    ['small', {}, 'project cover must be 1200×900'],
    ['png', {}, 'project cover must be WebP'],
  ];
  for (const [slug, extra] of cases) {
    await putCover(root, slug, slug === 'small' ? 400 : 1200, slug === 'wide' ? 630 : slug === 'small' ? 300 : 900, 'projects');
    put(root, `src/content/projects/zh-CN/${slug}.md`, markdown(project(slug, 'zh-CN', 1, extra)));
  }
  put(root, 'public/assets/projects/corrupt/cover.webp', 'not an image');
  const valid = await putCover(root, 'truncated', 1200, 900, 'projects');
  put(root, 'public/assets/projects/truncated/cover.webp', valid.subarray(0, 40));
  put(root, 'public/assets/projects/png/cover.webp', await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#244b3b' } }).png().toBuffer());
  const issues = (await verifyContent(root)).issues;
  for (const [slug, , expected] of cases) assert(issues.some((issue) => issue.includes(`${slug}.md:`) && issue.includes(expected)), `${slug}: ${issues.join('\n')}`);
});
