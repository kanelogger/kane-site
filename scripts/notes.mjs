import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { satteri } from '@astrojs/markdown-satteri';
import { imageSize } from 'image-size';

// A second-level date heading starts an entry. Fenced examples remain prose.
export function parseNotes(source) {
  const entries = [];
  const seen = new Set();
  let current;
  let fence;
  for (const line of source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      if (!current) throw new Error('notes.md: content must start with ## YYYY-MM-DD HH:mm');
      current.lines.push(line);
      continue;
    }
    if (!fence && /^##\s/.test(line)) {
      const match = line.match(/^## (\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?\s*$/);
      if (!match) throw new Error(`notes.md: invalid entry heading: ${line}`);
      const label = `${match[1]} ${match[2] ?? '00:00'}`;
      const datetime = `${match[1]}T${match[2] ?? '00:00'}:00+08:00`;
      const date = new Date(datetime);
      if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16) !== label.replace(' ', 'T')) {
        throw new Error(`notes.md: invalid date: ${label}`);
      }
      if (seen.has(label)) throw new Error(`notes.md: duplicate date: ${label}; use a different minute`);
      seen.add(label);
      current = { label: match[2] ? label : match[1], datetime, id: `note-${label.replace(/[^0-9]/g, '')}`, lines: [] };
      entries.push(current);
    } else {
      if (!fence && /^#\s/.test(line)) throw new Error('notes.md: use ### or deeper for headings inside an entry');
      if (current) current.lines.push(line);
      else if (line.trim()) throw new Error('notes.md: content must start with ## YYYY-MM-DD HH:mm');
    }
  }
  return entries.map(({ lines, ...entry }) => {
    const body = lines.join('\n').trim();
    if (!body) throw new Error(`notes.md: empty entry: ${entry.label}`);
    return { ...entry, body };
  }).sort((a, b) => b.datetime.localeCompare(a.datetime));
}

export async function renderNotes(source, root = process.cwd()) {
  const publicRoot = realpathSync(resolve(root, 'public'));
  return Promise.all(parseNotes(source).map(async (entry) => {
    let heading = 0;
    const renderer = await satteri({
      hastPlugins: [{
        name: 'notes-local-media',
        element: {
          filter: ['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'table'],
          visit(node, context) {
            if (node.tagName === 'img') {
              const src = node.properties?.src;
              if (typeof src !== 'string' || !src.startsWith('/assets/notes/') || /[?#]/.test(src)) throw new Error('notes.md: images must use /assets/notes/ paths');
              if (!String(node.properties?.alt ?? '').trim()) throw new Error('notes.md: images need alt text');
              const path = realpathSync(resolve(publicRoot, `.${decodeURIComponent(src)}`));
              if (!path.startsWith(resolve(publicRoot, 'assets/notes') + sep)) throw new Error('notes.md: image escapes /assets/notes/');
              const { width, height } = imageSize(readFileSync(path));
              context.setProperty(node, 'width', width);
              context.setProperty(node, 'height', height);
              context.setProperty(node, 'loading', 'lazy');
              context.setProperty(node, 'decoding', 'async');
            } else if (/^h[1-6]$/.test(node.tagName)) {
              if (node.tagName === 'h1' || node.tagName === 'h2') throw new Error('notes.md: use ### or deeper for headings inside an entry');
              context.setProperty(node, 'id', `${entry.id}-heading-${++heading}`);
            } else {
              context.setProperty(node, 'tabIndex', 0);
              context.setProperty(node, 'aria-label', 'Scrollable content / 内容，可横向滚动');
            }
          },
        },
      }],
    }).createRenderer({ syntaxHighlight: false });
    const { code } = await renderer.render(entry.body);
    if (!code.replace(/<!--[\s\S]*?-->/g, '').trim()) throw new Error(`notes.md: entry has no visible content: ${entry.label}`);
    return { ...entry, html: code };
  }));
}
