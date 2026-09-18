import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectEnvironment } from './verify-agent-environment.mjs';

export function probeLoopback() {
  return new Promise((resolveProbe) => {
    const server = createServer();
    server.once('error', (error) => resolveProbe({ code: error.code ?? 'UNKNOWN' }));
    server.listen(0, '127.0.0.1', () => server.close((error) => resolveProbe(error ? { code: error.code ?? 'UNKNOWN' } : { ok: true })));
  });
}

export async function collectDoctor({ root = process.cwd(), nodeVersion = process.versions.node, run = spawnSync, probe = probeLoopback } = {}) {
  const checks = [];
  const add = (id, status, required, evidence, action = '') => checks.push({ id, status, required, evidence, action });
  const { issues, manifest, pkg, nodeVersion: expectedNode } = inspectEnvironment(root);
  add('contract', issues.length ? 'unavailable' : 'healthy', true, issues.length ? issues : ['project.yml, public entrypoints and package scripts agree.'], 'node scripts/verify-agent-environment.mjs');
  add('node', nodeVersion === expectedNode ? 'healthy' : 'unavailable', true, [`running=${nodeVersion}; expected=${expectedNode ?? 'unknown'} (.node-version)`], 'Select the exact Node version in .node-version with your version manager.');
  const invoke = (command, args) => run(command, args, { cwd: root, encoding: 'utf8', timeout: 10000 });
  const pnpm = invoke('pnpm', ['--version']);
  const actualPnpm = pnpm.stdout?.trim();
  add('pnpm', pnpm.status === 0 && `pnpm@${actualPnpm}` === pkg?.packageManager ? 'healthy' : 'unavailable', true,
    [`running=${/^\d+\.\d+\.\d+$/.test(actualPnpm ?? '') ? actualPnpm : 'unavailable'}; expected=${pkg?.packageManager ?? 'unknown'} (package.json)`], 'Install/select the packageManager version from package.json, then rerun doctor.');

  const missing = [];
  for (const name of Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies })) {
    try {
      const dependency = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
      if (dependency.name !== name || !dependency.version) missing.push(name);
    } catch { missing.push(name); }
  }
  const installed = Boolean(pkg) && existsSync(join(root, 'node_modules')) && missing.length === 0;
  add('dependencies', installed ? 'healthy' : 'unavailable', true,
    installed ? ['Direct dependency manifests exist; this does not replace frozen install or pnpm verify.'] : [`Missing/incomplete direct dependencies: ${missing.join(', ') || 'node_modules'}`], 'pnpm install --frozen-lockfile');
  const git = invoke('git', ['rev-parse', '--is-inside-work-tree']);
  add('git', git.status === 0 && git.stdout?.trim() === 'true' ? 'healthy' : 'unavailable', true, ['git rev-parse --is-inside-work-tree'], 'Run from a Git checkout; inspect git status --short before editing.');
  const ignored = invoke('git', ['check-ignore', '--no-index', 'AGENTS.md', 'AI_ENVIRONMENT.md', 'project.yml']);
  add('portable-entrypoints', ignored.status === 1 ? 'healthy' : 'unavailable', true, ['git check-ignore --no-index: public entrypoints must not be ignored.'], 'Remove ignore rules for public entrypoints; keep .agents and private records ignored.');

  const port = await probe();
  add('loopback', port.ok ? 'healthy' : ['EPERM', 'EACCES'].includes(port.code) ? 'blocked-by-policy' : 'unavailable', true,
    [port.ok ? 'Bound 127.0.0.1:0 and closed the temporary listener.' : `127.0.0.1:0 failed: ${port.code}`], 'Run doctor and tests in an environment authorized to bind loopback; do not skip required checks.');
  const skill = manifest?.capabilities?.content_import?.optional_skill;
  add('content-import-skill', typeof skill === 'string' && existsSync(join(root, skill)) ? 'installed' : 'unavailable', false,
    ['Optional local Skill; file presence does not prove loaded capability.'], 'Use docs/content-import.md; no private Skill installation is required.');
  add('browser', 'unknown', false, ['Browser tools and UI acceptance depend on the current Agent session.'], 'For UI work, use an available browser and record actual desktop/mobile acceptance.');
  add('production', 'unknown', false, ['Not probed; local checks require no production credentials.'], 'Check deployment configuration and authorization only for a release task.');
  return { schemaVersion: 1, observedAt: new Date().toISOString(), platform: process.platform, architecture: process.arch, ok: checks.every((check) => !check.required || check.status === 'healthy'), checks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some((arg) => arg !== '--json')) {
    console.error('Usage: node scripts/agent-doctor.mjs [--json]');
    process.exitCode = 1;
  } else {
    const report = await collectDoctor();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Agent environment — ${report.observedAt} — ${report.platform}/${report.architecture}`);
      for (const check of report.checks) {
        console.log(`${check.required ? 'required' : 'optional'} ${check.id}: ${check.status}`);
        check.evidence.forEach((line) => console.log(`  ${line}`));
        if (check.status !== 'healthy') console.log(`  Next: ${check.action}`);
      }
      console.log(report.ok ? 'Required probes passed. Browser and production acceptance are separate.' : 'Environment is not ready: resolve required failures and rerun.');
    }
    process.exitCode = report.ok ? 0 : 1;
  }
}
