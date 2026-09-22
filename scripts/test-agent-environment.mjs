import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { collectDoctor } from './agent-doctor.mjs';
import { inspectEnvironment } from './verify-agent-environment.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const json = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
const put = (root, file, text) => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kane-agent-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ['.gitignore', ...json(source, 'project.yml').required_files]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(source, file), join(root, file));
  }
  // Include public link targets and package scripts, but no private docs or Skills.
  for (const dir of ['src', 'scripts']) cpSync(join(source, dir), join(root, dir), { recursive: true });
  cpSync(join(source, 'astro.config.mjs'), join(root, 'astro.config.mjs'));
  assert.equal(spawnSync('git', ['init', '--quiet'], { cwd: root }).status, 0);
  return root;
}
function installed(root) {
  const pkg = json(root, 'package.json');
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    put(root, `node_modules/${name}/package.json`, JSON.stringify({ name, version: '1.0.0' }));
  }
}
const fakeRun = (command, args, options) => command === 'pnpm'
  ? { status: 0, stdout: json(options.cwd, 'package.json').packageManager.slice(5) }
  : spawnSync(command, args, options);
const doctor = (root, options = {}) => collectDoctor({ root, nodeVersion: readFileSync(join(root, '.node-version'), 'utf8').trim(), run: fakeRun, probe: async () => ({ ok: true }), ...options });

test('public checkout resolves its entrypoints without private files or Skills', (t) => {
  const root = fixture(t);
  assert.deepEqual(inspectEnvironment(root).issues, []);
  const result = spawnSync(process.execPath, [join(source, 'scripts/verify-agent-environment.mjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('broken public link and missing required entrypoint fail the real CLI', (t) => {
  const root = fixture(t);
  rmSync(join(root, 'docs/content-import.md'));
  const result = spawnSync(process.execPath, [join(source, 'scripts/verify-agent-environment.mjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required file: docs\/content-import.md/);
  assert.match(result.stderr, /broken local link/);
});

test('runtime drift, missing commands and weakened verification fail', (t) => {
  const root = fixture(t);
  const pkg = json(root, 'package.json');
  pkg.engines.node = '20.0.0';
  delete pkg.scripts['verify:deployment'];
  delete pkg.scripts['verify:content'];
  pkg.scripts.verify = 'pnpm build';
  put(root, 'package.json', JSON.stringify(pkg));
  const issues = inspectEnvironment(root).issues.join('\n');
  assert.match(issues, /engines.node must match/);
  assert.match(issues, /missing package script: verify:deployment/);
  assert.match(issues, /missing package script: verify:content/);
  assert.match(issues, /stop on failure/);
});

test('invalid manifest and private required files cannot report success', (t) => {
  const root = fixture(t);
  const manifest = json(root, 'project.yml');
  manifest.required_files.push('.agents/secret.md', '../outside.md');
  put(root, 'project.yml', JSON.stringify(manifest));
  assert.equal(inspectEnvironment(root).issues.filter((issue) => issue.includes('Invalid or private')).length, 2);
  put(root, 'project.yml', 'schema_version: malformed-json');
  assert.match(inspectEnvironment(root).issues.join(), /missing or invalid/);
});

test('handoff records require state, evidence sections and correct archive state', (t) => {
  const root = fixture(t);
  const record = readFileSync(join(root, 'templates/task.md'), 'utf8').replace('YYYY-MM-DD', '2026-09-18');
  put(root, 'tasks/example.md', record);
  assert.deepEqual(inspectEnvironment(root).issues, []);
  put(root, 'tasks/archive/example.md', record);
  assert.match(inspectEnvironment(root).issues.join(), /archived task must be complete/);
  put(root, 'tasks/archive/example.md', record.replace('Status: active', 'Status: complete'));
  put(root, 'tasks/example.md', '# Abandoned handoff\n');
  const issues = inspectEnvironment(root).issues.join();
  assert.match(issues, /missing valid Status/);
  assert.match(issues, /missing 验证 section/);
});

test('valid JSON with invalid contract shapes returns diagnostics rather than crashing', async (t) => {
  const root = fixture(t);
  for (const manifest of [null, [], { commands: { doctor: null } }]) {
    put(root, 'project.yml', JSON.stringify(manifest));
    assert.match(inspectEnvironment(root).issues.join(), /Invalid contract shape/);
    const report = await doctor(root);
    assert.equal(report.ok, false);
    assert.equal(report.checks.find(({ id }) => id === 'contract').status, 'unavailable');
  }
});

test('doctor reports missing dependencies and gives a recovery command', async (t) => {
  const root = fixture(t);
  const report = await doctor(root);
  assert.equal(report.ok, false);
  const check = report.checks.find(({ id }) => id === 'dependencies');
  assert.equal(check.status, 'unavailable');
  assert.equal(check.action, 'pnpm install --frozen-lockfile');
});

test('optional Skill absence is not a blocker; browser and production remain unknown', async (t) => {
  const root = fixture(t);
  installed(root);
  const report = await doctor(root);
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.equal(report.checks.find(({ id }) => id === 'content-import-skill').status, 'unavailable');
  for (const id of ['browser', 'production']) assert.equal(report.checks.find((check) => check.id === id).status, 'unknown');
});

test('denied loopback is blocked-by-policy and cannot pass required probes', async (t) => {
  const root = fixture(t);
  installed(root);
  const report = await doctor(root, { probe: async () => ({ code: 'EPERM' }) });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(({ id }) => id === 'loopback').status, 'blocked-by-policy');
});

test('runtime mismatch and ignored public entrypoint cannot report ready', async (t) => {
  const root = fixture(t);
  installed(root);
  put(root, '.gitignore', 'AGENTS.md\n');
  const report = await doctor(root, { nodeVersion: '20.0.0' });
  assert.equal(report.ok, false);
  for (const id of ['node', 'portable-entrypoints']) assert.equal(report.checks.find((check) => check.id === id).status, 'unavailable');
});

test('doctor CLI emits parseable failure JSON when pnpm and Git are unavailable', (t) => {
  const root = fixture(t);
  const result = spawnSync(process.execPath, [join(source, 'scripts/agent-doctor.mjs'), '--json'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: join(root, 'empty-path') }, timeout: 15000,
  });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(({ id }) => id === 'pnpm').status, 'unavailable');
});
