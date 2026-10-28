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
import {
  createAppNavigationTools,
  planAppSave,
  registerAppNavigationTools,
} from '../src/lib/app-navigation-tools.ts';

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

function toolHarness(apps = [entry(), entry({ id: 'figma', name: 'Figma', category: '设计', favorite: true })]) {
  const state = { query: '', category: '', sort: 'default' };
  const persisted = [];
  const confirmations = [];
  let views = 0;
  const host = {
    apps: () => apps,
    view: () => ({ ...state }),
    applyView(next) {
      views += 1;
      Object.assign(state, next);
      return apps.length;
    },
    async persist(app, notice) {
      persisted.push({ app, notice });
      const index = apps.findIndex((item) => item.id === app.id);
      if (index >= 0) apps[index] = app;
      else apps.push(app);
      return true;
    },
    requestConfirmation(request) {
      confirmations.push(request);
      return true;
    },
  };
  const tools = Object.fromEntries(createAppNavigationTools(host).map((tool) => [tool.name, tool]));
  return { apps, state, persisted, confirmations, tools, views: () => views };
}

test('ships the curated default atlas with explicit categories', () => {
  const payload = JSON.parse(readFileSync(new URL('../src/data/app-navigation-defaults.json', import.meta.url), 'utf8'));
  const apps = parseAppImport(payload, 1000);
  assert.equal(apps.length, 90);
  assert.deepEqual(payload.categories, ['开始工作', '兴趣与偶发', '开发交付', '研究输入', '模型评测', '创作表达', '办事查询', 'Anthropic']);
  assert.equal(new Set(apps.map((app) => app.category)).size, 8);
  assert.equal(apps.filter((app) => app.favorite).length, 7);
  assert.equal(apps.some((app) => !app.category), false);
});

test('exposes the app directory through WebMCP tools', async () => {
  const harness = toolHarness();
  assert.deepEqual(Object.keys(harness.tools), [
    'list_apps', 'show_apps', 'save_app', 'set_favorite', 'delete_app', 'export_apps', 'import_apps', 'clear_apps',
  ]);
  assert.equal(harness.tools.list_apps.annotations.readOnlyHint, true);
  assert.equal(harness.tools.export_apps.annotations.readOnlyHint, true);
  assert.equal(harness.tools.list_apps.annotations.untrustedContentHint, true);
  for (const name of ['delete_app', 'import_apps', 'clear_apps']) {
    assert.equal(harness.tools[name].annotations.consequentialHint, true);
  }

  const listed = await harness.tools.list_apps.execute({ favorite: true });
  assert.equal(listed.total, 2);
  assert.equal(listed.matched, 1);
  assert.equal(listed.apps[0].name, 'Figma');
  assert.equal(harness.views(), 0);

  harness.state.category = '协作';
  const shown = await harness.tools.show_apps.execute({ query: 'linear' });
  assert.deepEqual(shown, { query: 'linear', category: '', sort: 'default', visible: 2 });
  const blocked = await harness.tools.show_apps.execute({ query: 'linear', category: '设计' });
  assert.match(blocked.error, /search query or a category/);
  assert.equal(harness.state.query, 'linear');

  const created = await harness.tools.save_app.execute({ name: 'Example', url: 'example.com', category: '协作' });
  assert.equal(created.created, true);
  assert.equal(created.app.url, 'https://example.com/');
  assert.equal(harness.persisted.at(-1).notice, 'added');
  const renamed = await harness.tools.save_app.execute({ id: 'linear', name: 'Linear HQ' });
  assert.equal(renamed.created, false);
  assert.equal(renamed.app.url, 'https://linear.app/');
  assert.equal(renamed.app.name, 'Linear HQ');
  const rejected = await harness.tools.save_app.execute({ name: 'Bad', url: 'javascript:alert(1)', category: '协作' });
  assert.equal(rejected.error, 'url must be an http or https address.');

  const pinned = await harness.tools.set_favorite.execute({ name: 'Linear HQ', favorite: true });
  assert.equal(pinned.status, 'updated');
  assert.equal(pinned.app.favorite, true);
  const same = await harness.tools.set_favorite.execute({ name: 'Linear HQ', favorite: true });
  assert.equal(same.status, 'unchanged');
  const unpinned = await harness.tools.set_favorite.execute({ name: 'Linear HQ', favorite: false });
  assert.equal(unpinned.app.favorite, false);
  harness.apps.push(entry({ id: 'linear-2', name: 'Linear HQ' }));
  const duplicate = await harness.tools.set_favorite.execute({ name: 'Linear HQ', favorite: false });
  assert.match(duplicate.error, /Pass its id/);

  const removed = await harness.tools.delete_app.execute({ id: 'figma' });
  assert.equal(removed.status, 'confirmation-required');
  assert.equal(harness.confirmations.at(-1).action, 'delete');
  assert.equal(harness.persisted.some((item) => item.notice === 'deleted'), false);
  const cancelled = await harness.tools.clear_apps.execute({}, { signal: AbortSignal.abort() });
  assert.equal(cancelled.error, 'The tool call was cancelled.');

  const exported = await harness.tools.export_apps.execute();
  assert.equal(exported.version, 1);
  assert.equal(exported.apps.some((app) => app.name === 'Linear HQ'), true);
  const imported = await harness.tools.import_apps.execute({ version: 1, categories: ['协作'], apps: [] });
  assert.equal(imported.status, 'confirmation-required');
  assert.equal(imported.count, 0);
  const invalid = await harness.tools.import_apps.execute({ version: 2, categories: [], apps: [] });
  assert.match(invalid.error, /version 1/);
  const cleared = await harness.tools.clear_apps.execute();
  assert.equal(cleared.action, 'clear');
  assert.equal(harness.confirmations.at(-1).action, 'clear');
});

test('allows a category rename that does not increase the category count', () => {
  const only = entry({ id: 'only', category: '独有' });
  const others = Array.from({ length: 99 }, (_, index) => entry({
    id: `category-${index}`,
    name: `应用${index}`,
    category: `分类${index}`,
  }));
  const renamed = planAppSave([only, ...others], { id: 'only', category: '新分类' }, 50);
  assert.equal(renamed.app.category, '新分类');
  const added = planAppSave([only, ...others], { name: '新应用', url: 'https://example.com', category: '新分类' }, 50);
  assert.match(added.error, /100 categories/);
});

test('registers app tools on a model context and drops them when the signal aborts', async () => {
  const names = [];
  const controller = new AbortController();
  const { host } = toolHarness();
  await registerAppNavigationTools(host, controller.signal, {
    async registerTool(tool, options) {
      names.push(tool.name);
      options.signal.addEventListener('abort', () => {
        const index = names.indexOf(tool.name);
        if (index >= 0) names.splice(index, 1);
      });
    },
  });
  assert.equal(names.length, 8);
  controller.abort();
  assert.deepEqual(names, []);
  await registerAppNavigationTools(host, new AbortController().signal, null);
  await registerAppNavigationTools(host, new AbortController().signal);
});
