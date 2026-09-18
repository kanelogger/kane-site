import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (root, file) => readFileSync(join(root, file), 'utf8');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const inside = (root, file) => {
  const path = relative(root, file);
  return !isAbsolute(path) && path !== '..' && !path.startsWith('../');
};
const privatePath = (file) => /(^|\/)(?:\.agents|\.agent-local|private-[^/]*|DESIGN\.md)(\/|$)/.test(file);

export function inspectEnvironment(directory = process.cwd()) {
  const root = realpathSync(directory);
  const issues = [];
  let manifest, pkg, nodeVersion;
  try {
    manifest = JSON.parse(read(root, 'project.yml'));
    pkg = JSON.parse(read(root, 'package.json'));
    nodeVersion = read(root, '.node-version').trim();
  } catch {
    return { issues: ['Read project.yml (JSON subset of YAML), package.json and .node-version; one is missing or invalid.'] };
  }
  if (!object(manifest) || !object(pkg) || !object(manifest.commands) || !object(pkg.scripts)
    || !Object.values(manifest.commands).every(object) || !Object.values(pkg.scripts).every((value) => typeof value === 'string')) {
    return { issues: ['Invalid contract shape: project.yml commands must be objects and package.json scripts must be strings.'] };
  }
  const require = (ok, message) => { if (!ok) issues.push(message); };
  require(manifest.schema_version === 1, 'Unsupported project.yml schema_version.');
  require(/^\d+\.\d+\.\d+$/.test(nodeVersion), '.node-version must pin an exact Node version.');
  require(pkg.engines?.node === nodeVersion, 'package.json engines.node must match .node-version.');
  require(/^pnpm@\d+\.\d+\.\d+$/.test(pkg.packageManager ?? ''), 'packageManager must pin an exact pnpm version.');
  require(manifest.runtime?.node_file === '.node-version' && manifest.runtime?.package_manager_file === 'package.json', 'Runtime references must use .node-version and package.json.');

  const files = Array.isArray(manifest.required_files) ? manifest.required_files : [];
  for (const file of ['AGENTS.md', 'AI_ENVIRONMENT.md', '.github/workflows/verify.yml', 'tasks/README.md', 'templates/task.md', 'docs/content-import.md']) {
    require(files.includes(file), `required_files must include ${file}.`);
  }
  const publicFiles = [];
  for (const file of files) {
    if (typeof file !== 'string' || isAbsolute(file) || !inside(root, resolve(root, file)) || privatePath(file)) {
      issues.push(`Invalid or private required_files entry: ${String(file)}`);
      continue;
    }
    const target = join(root, file);
    if (!existsSync(target) || !statSync(target).isFile()) issues.push(`Missing required file: ${file}`);
    else if (!inside(root, realpathSync(target))) issues.push(`Required file leaves checkout: ${file}`);
    else publicFiles.push(file);
  }
  const commands = manifest.commands ?? {};
  require(JSON.stringify(commands.install?.argv) === JSON.stringify(['pnpm', 'install', '--frozen-lockfile']), 'Install must use pnpm install --frozen-lockfile.');
  for (const [id, script] of Object.entries({ doctor: 'agent:doctor', develop: 'dev', preview: 'preview', verify: 'verify', environment_check: 'verify:agent', deployment_check: 'verify:deployment' })) {
    require(commands[id]?.script === script, `Command ${id} must reference package script ${script}.`);
  }
  for (const [id, command] of Object.entries(commands)) {
    if (command.script) require(typeof pkg.scripts?.[command.script] === 'string', `Command ${id} references missing package script: ${command.script}`);
    require(['none', 'registry', 'loopback', 'target-url'].includes(command.network), `Command ${id} must declare its network requirement.`);
    require(Array.isArray(command.effects), `Command ${id} must declare its effects.`);
  }
  const steps = ['check', 'build', 'verify:build', 'verify:scene', 'test:deployment', 'test:scene', 'test:build', 'test:agent', 'verify:agent'];
  require(pkg.scripts?.verify === steps.map((step) => `pnpm ${step}`).join(' && '), 'verify must run the documented checks in order and stop on failure.');
  for (const step of steps) require(typeof pkg.scripts?.[step] === 'string', `Missing verification script: ${step}`);
  for (const command of Object.values(pkg.scripts ?? {})) {
    for (const [, file] of command.matchAll(/\bnode (?:--test )?(scripts\/[\w/-]+\.mjs)\b/g)) {
      require(existsSync(join(root, file)), `Package script references missing file: ${file}`);
    }
  }
  require(manifest.capabilities?.content_import?.fallback === 'docs/content-import.md', 'Content import must have the public docs/content-import.md fallback.');
  require(manifest.capabilities?.content_import?.optional_skill === '.agents/skills/kane-site-content-import/SKILL.md', 'Optional content-import Skill must reference the project-local Skill.');
  require(manifest.workflow?.tasks === 'tasks/README.md' && manifest.workflow?.template === 'templates/task.md' && manifest.workflow?.local_evidence === '.agent-local/', 'Workflow must reference the portable task entry, template and private evidence directory.');

  const tasks = [];
  const visitTasks = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('private-')) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visitTasks(path);
      else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') tasks.push(relative(root, path));
    }
  };
  visitTasks(join(root, 'tasks'));
  for (const file of tasks) {
    const text = read(root, file);
    require(/^Status: (active|blocked|complete)$/m.test(text), `${file}: missing valid Status.`);
    require(/^Updated: \d{4}-\d{2}-\d{2}$/m.test(text), `${file}: missing Updated date.`);
    for (const heading of ['目标与验收', '当前事实与状态', '决定与依据', '验证', '下一步与交接']) {
      require(text.includes(`## ${heading}`), `${file}: missing ${heading} section.`);
    }
    if (file.startsWith('tasks/archive/')) require(/^Status: complete$/m.test(text), `${file}: archived task must be complete.`);
    else require(!/^Status: complete$/m.test(text), `${file}: completed task must be moved to tasks/archive/.`);
  }
  for (const file of new Set([...publicFiles, ...tasks, 'CHANGELOG.md'].filter((file) => file.endsWith('.md') && existsSync(join(root, file))))) {
    const text = read(root, file);
    require(!/\/(?:Users|home)\/[^\s/]+\//.test(text), `${file}: contains a personal absolute path.`);
    // Fenced examples and HTML comments are not navigation links.
    const prose = text.replace(/```[^]*?```/g, '').replace(/<!--[^]*?-->/g, '');
    for (const [, href] of prose.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|mailto:|#)/.test(href)) continue;
      const target = resolve(root, dirname(file), href.split('#')[0]);
      require(inside(root, target) && existsSync(target), `${file}: broken local link ${href}`);
      require(!privatePath(relative(root, target)), `${file}: public navigation depends on private file ${href}`);
    }
  }
  return { issues, manifest, pkg, nodeVersion };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { issues } = inspectEnvironment();
  if (issues.length) {
    issues.forEach((issue) => console.error(`FAIL: ${issue}`));
    process.exitCode = 1;
  } else console.log('Verified Agent entrypoints, runtime contract, command references, public links and task handoffs.');
}
