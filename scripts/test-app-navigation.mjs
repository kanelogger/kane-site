import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AppDataError,
  appInitials,
  createAppExport,
  normalizeAppUrl,
  parseAppImport,
  sortApps,
} from '../src/lib/app-navigation-data.ts';

const entry = (overrides = {}) => ({
  id: 'linear',
  name: 'Linear',
  url: 'https://linear.app/',
  category: '协作',
  sortOrder: 1,
  description: 'Issue 与项目管理',
  shortcode: 'LI',
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

test('normalizes safe web URLs and rejects non-web schemes', () => {
  assert.equal(normalizeAppUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeAppUrl('http://example.com/path'), 'http://example.com/path');
  assert.throws(() => normalizeAppUrl('javascript:alert(1)'), (error) => error instanceof AppDataError && error.code === 'invalid-url');
});

test('exports an explicit category list and favorites first', () => {
  const payload = createAppExport([
    entry(),
    entry({ id: 'figma', name: 'Figma', category: '设计', favorite: true }),
  ], new Date('2026-09-22T00:00:00.000Z'));
  assert.deepEqual(payload.categories, ['设计', '协作']);
  assert.equal(payload.apps[0].name, 'Figma');
  assert.equal(payload.exportedAt, '2026-09-22T00:00:00.000Z');
});

test('imports apps only when every category is declared', () => {
  const apps = parseAppImport({
    version: 1,
    categories: ['协作'],
    apps: [{ name: 'Linear', url: 'linear.app', category: '协作', favorite: true }],
  }, 100);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].url, 'https://linear.app/');
  assert.equal(apps[0].category, '协作');
  assert.equal(apps[0].favorite, true);
});

test('rejects missing and undeclared import categories', () => {
  assert.throws(
    () => parseAppImport({ version: 1, apps: [] }),
    (error) => error instanceof AppDataError && error.code === 'categories-required',
  );
  assert.throws(
    () => parseAppImport({ version: 1, categories: ['协作'], apps: [{ name: 'Figma', url: 'figma.com', category: '设计' }] }),
    (error) => error instanceof AppDataError && error.code === 'unknown-category' && error.index === 0,
  );
});

test('sorts favorites first and then uses explicit directory order', () => {
  const apps = sortApps([entry({ name: 'Notion', sortOrder: 2 }), entry({ id: 'github', name: 'GitHub', favorite: true, sortOrder: 3 }), entry({ id: 'figma', name: 'Figma', sortOrder: 1 })]);
  assert.equal(apps[0].name, 'GitHub');
  assert.equal(apps[1].name, 'Figma');
  assert.equal(appInitials('Readwise Reader'), 'RR');
  assert.equal(appInitials('Notion'), 'NO');
});

test('ships the curated default atlas with explicit categories', () => {
  const payload = JSON.parse(readFileSync(new URL('../src/data/app-navigation-defaults.json', import.meta.url), 'utf8'));
  const apps = parseAppImport(payload, 1000);
  assert.equal(apps.length, 75);
  assert.deepEqual(payload.categories, ['开始工作', '兴趣与偶发', '开发交付', '研究输入', '创作表达', '办事查询']);
  assert.equal(new Set(apps.map((app) => app.category)).size, 6);
  assert.equal(apps.filter((app) => app.favorite).length, 7);
  assert.equal(apps.some((app) => !app.category), false);
});
