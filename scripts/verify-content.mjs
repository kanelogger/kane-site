import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const collections = ['blog', 'projects'];
const locales = new Set(['zh-CN', 'en']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const inside = (root, file) => {
  const path = relative(root, file);
  return !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`);
};

const stripNonProse = (text) => text
  .replace(/```[^]*?```/g, '')
  .replace(/~~~[^]*?~~~/g, '')
  .replace(/<!--[^]*?-->/g, '')
  .replace(/`[^`\n]*`/g, '');

function frontmatter(file, source, issues) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    issues.push(`${file}: missing or malformed YAML frontmatter`);
    return null;
  }
  try {
    const data = parse(match[1]);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('frontmatter must be a mapping');
    return { data, body: source.slice(match[0].length) };
  } catch (error) {
    issues.push(`${file}: invalid YAML frontmatter: ${error.message}`);
    return null;
  }
}

function markdownImages(body) {
  const images = [];
  const prose = stripNonProse(body);
  const pattern = /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*["'])?\s*\)/g;
  for (const match of prose.matchAll(pattern)) images.push({ alt: match[1].trim(), path: match[2] ?? match[3] });
  return images;
}

function checkAsset({ root, file, collection, slug, path, alt, label, issues }) {
  if (typeof path !== 'string' || !path.trim()) {
    issues.push(`${file}: ${label} must be a non-empty asset path`);
    return;
  }
  if (alt !== undefined && !alt) issues.push(`${file}: Markdown image ${path} needs non-empty alt text`);
  if (!path.startsWith('/assets/')) {
    issues.push(`${file}: ${label} must use a root-relative /assets/ path: ${path}`);
    return;
  }
  if (/[?#]/.test(path)) {
    issues.push(`${file}: ${label} must not contain a query or fragment: ${path}`);
    return;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    issues.push(`${file}: ${label} contains invalid URL encoding: ${path}`);
    return;
  }
  const expected = `/assets/${collection}/${slug}/`;
  if (!decoded.startsWith(expected)) {
    issues.push(`${file}: ${label} must stay under ${expected}: ${path}`);
    return;
  }
  const publicRoot = resolve(root, 'public');
  const target = resolve(publicRoot, `.${decoded}`);
  if (!inside(publicRoot, target) || !existsSync(target) || !statSync(target).isFile()) {
    issues.push(`${file}: ${label} does not exist: ${path}`);
  }
}

function duplicateIssues(entries, key, label, issues) {
  const seen = new Map();
  for (const entry of entries) {
    const value = key(entry);
    if (value === null || value === undefined) continue;
    const previous = seen.get(value);
    if (previous) issues.push(`${entry.file}: duplicate ${label} ${value}; already used by ${previous}`);
    else seen.set(value, entry.file);
  }
}

export function verifyContent(directory = process.cwd()) {
  const root = resolve(directory);
  const issues = [];
  const entries = [];

  for (const collection of collections) {
    const base = join(root, 'src', 'content', collection);
    if (!existsSync(base)) {
      issues.push(`src/content/${collection}: content directory is missing`);
      continue;
    }
    const files = readdirSync(base, { recursive: true })
      .map(String)
      .filter((file) => file.endsWith('.md'))
      .sort();
    for (const name of files) {
      const absolute = join(base, name);
      const file = relative(root, absolute).split(sep).join('/');
      const parts = name.split(sep);
      const pathLocale = parts[0];
      const filename = parts.at(-1).slice(0, -3);
      if (parts.length !== 2 || !locales.has(pathLocale)) {
        issues.push(`${file}: content path must be src/content/${collection}/<zh-CN|en>/<slug>.md`);
      }

      const parsed = frontmatter(file, readFileSync(absolute, 'utf8'), issues);
      if (!parsed) continue;
      const { data, body } = parsed;
      const slug = data.slug;
      const locale = data.locale;
      const translationKey = data.translationKey;
      if (!locales.has(locale)) issues.push(`${file}: locale must be zh-CN or en`);
      if (locale !== pathLocale) issues.push(`${file}: frontmatter locale ${String(locale)} does not match directory ${pathLocale}`);
      if (typeof slug !== 'string' || !slugPattern.test(slug)) {
        issues.push(`${file}: slug must use lowercase English kebab-case`);
      }
      if (typeof slug === 'string' && filename !== slug) {
        issues.push(`${file}: filename ${filename}.md must match slug ${slug}`);
      }
      if (typeof translationKey !== 'string' || !translationKey.trim()) {
        issues.push(`${file}: translationKey must be a non-empty string`);
      }

      const entry = { collection, file, locale, slug, translationKey, data };
      entries.push(entry);
      if (data.cover !== undefined) {
        checkAsset({ root, file, collection, slug, path: data.cover, label: 'cover', issues });
      }
      for (const image of markdownImages(body)) {
        checkAsset({ root, file, collection, slug, ...image, label: 'Markdown image', issues });
      }
    }
  }

  for (const collection of collections) {
    const scoped = entries.filter((entry) => entry.collection === collection);
    duplicateIssues(scoped, (entry) => locales.has(entry.locale) && typeof entry.slug === 'string' ? `${entry.locale}/${entry.slug}` : null, `${collection} locale/slug`, issues);
    duplicateIssues(scoped, (entry) => locales.has(entry.locale) && typeof entry.translationKey === 'string' && entry.translationKey.trim() ? `${entry.locale}/${entry.translationKey}` : null, `${collection} locale/translationKey`, issues);

    const translations = new Map();
    for (const entry of scoped) {
      if (typeof entry.translationKey !== 'string' || !entry.translationKey.trim() || typeof entry.slug !== 'string') continue;
      const slugs = translations.get(entry.translationKey) ?? new Map();
      slugs.set(entry.slug, [...(slugs.get(entry.slug) ?? []), entry.file]);
      translations.set(entry.translationKey, slugs);
    }
    for (const [key, slugs] of translations) {
      if (slugs.size > 1) {
        issues.push(`${[...slugs.values()].flat().sort().join(', ')}: translationKey ${key} must use one shared slug; found ${[...slugs.keys()].sort().join(', ')}`);
      }
    }
  }

  const projects = entries.filter((entry) => entry.collection === 'projects' && locales.has(entry.locale));
  for (const entry of projects) {
    if (!Number.isInteger(entry.data.order) || entry.data.order <= 0) {
      issues.push(`${entry.file}: project order must be a positive integer`);
    }
  }
  duplicateIssues(projects, (entry) => Number.isInteger(entry.data.order) && entry.data.order > 0 ? `${entry.locale}/${entry.data.order}` : null, 'project locale/order', issues);

  const featured = entries.filter((entry) => entry.collection === 'blog' && locales.has(entry.locale) && entry.data.featured === true);
  for (const entry of featured) {
    if (!Number.isInteger(entry.data.featuredOrder) || entry.data.featuredOrder <= 0) {
      issues.push(`${entry.file}: featured article featuredOrder must be a positive integer`);
    }
  }
  duplicateIssues(featured, (entry) => Number.isInteger(entry.data.featuredOrder) && entry.data.featuredOrder > 0 ? `${entry.locale}/${entry.data.featuredOrder}` : null, 'featured article locale/featuredOrder', issues);

  return { files: entries.length, issues: issues.sort() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyContent();
  if (result.issues.length) {
    result.issues.forEach((issue) => console.error(`FAIL: ${issue}`));
    process.exitCode = 1;
  } else {
    console.log(`Verified ${result.files} content files: paths, slugs, translations, ordering, and local images.`);
  }
}
