import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { stringify } from 'yaml';
import { verifyContent } from './verify-content.mjs';

const put = (root, file, content = '') => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};

const markdown = (data, body = '') => `---\n${stringify(data)}---\n\n${body}\n`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kane-content-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const collection of ['blog', 'projects']) mkdirSync(join(root, 'src/content', collection), { recursive: true });
  return root;
}

function article(slug, locale = 'zh-CN', extra = {}) {
  return { locale, translationKey: slug, slug, featured: false, order: 0, ...extra };
}

function project(slug, locale = 'zh-CN', order = 1, extra = {}) {
  return { locale, translationKey: slug, slug, order, cover: `/assets/projects/${slug}/cover.webp`, ...extra };
}

test('current repository content passes the content verifier', () => {
  const result = verifyContent();
  assert.deepEqual(result.issues, []);
  assert(result.files > 0);
});

test('valid content allows optional translations, repeated blog order, locale-scoped order, and shared assets', (t) => {
  const root = fixture(t);
  put(root, 'public/assets/blog/shared/cover.webp');
  put(root, 'public/assets/projects/tool/cover.webp');
  put(root, 'src/content/blog/zh-CN/shared.md', markdown(article('shared', 'zh-CN', { featured: true, featuredOrder: 1, cover: '/assets/blog/shared/cover.webp' }), '![中文封面](/assets/blog/shared/cover.webp)'));
  put(root, 'src/content/blog/en/shared.md', markdown(article('shared', 'en', { featured: true, featuredOrder: 1, cover: '/assets/blog/shared/cover.webp' }), '![English cover](/assets/blog/shared/cover.webp)'));
  put(root, 'src/content/blog/zh-CN/source-only.md', markdown(article('source-only')));
  put(root, 'src/content/projects/zh-CN/tool.md', markdown(project('tool')));
  put(root, 'src/content/projects/en/tool.md', markdown(project('tool', 'en')));

  assert.deepEqual(verifyContent(root).issues, []);
});

test('reports path, identity, translation, ordering, and image failures together', (t) => {
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

  const issues = verifyContent(root).issues.join('\n');
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

test('reports malformed frontmatter without aborting the scan', (t) => {
  const root = fixture(t);
  put(root, 'src/content/blog/zh-CN/broken.md', '---\nslug: [broken\n---\n');
  put(root, 'src/content/blog/zh-CN/missing.md', '# no frontmatter');
  const issues = verifyContent(root).issues.join('\n');
  assert.match(issues, /invalid YAML frontmatter/);
  assert.match(issues, /missing or malformed YAML frontmatter/);
});
