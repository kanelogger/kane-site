import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseNotes, renderNotes } from './notes.mjs';

test('notes sort by Beijing time, normalize CRLF, and keep stable anchors', () => {
  const notes = parseNotes('## 2026-11-01\r\n\r\n第一条\r\n## 2026-11-02 08:15\r\n\r\n第二条');
  assert.deepEqual(notes.map((note) => note.label), ['2026-11-02 08:15', '2026-11-01']);
  assert.equal(notes[0].datetime, '2026-11-02T08:15:00+08:00');
  assert.equal(notes[0].id, 'note-202611020815');
  assert.deepEqual(parseNotes(' \n'), []);
});

test('fenced Markdown examples do not create entries or image dependencies', async () => {
  const source = '## 2026-11-01 10:00\n\n```md\n## 2026-11-02 10:00\n![example](missing.png)\n```\n\n~~~\n## 2026-11-03\n~~~';
  assert.equal(parseNotes(source).length, 1);
  assert.match((await renderNotes(source))[0].html, /<pre/);
});

test('malformed, impossible, duplicate, and empty entries fail visibly', async () => {
  for (const source of [
    'undated text', '## yesterday\ntext', '## 2026-02-30\ntext',
    '## 2026-11-01 24:00\ntext', '## 2026-11-01\n',
    '## 2026-11-01\na\n## 2026-11-01 00:00\nb',
    '## 2026-11-01\n# bad heading',
  ]) assert.throws(() => parseNotes(source), /notes.md/);
  await assert.rejects(renderNotes('## 2026-11-01\n\n<!-- only a comment -->'), /visible content/);
});

test('local images render with intrinsic sizes; remote, missing, undescribed and escaping images fail', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'kane-notes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'public/assets/notes/day'), { recursive: true });
  const image = await sharp({ create: { width: 120, height: 90, channels: 3, background: '#253c31' } }).webp().toBuffer();
  writeFileSync(join(root, 'public/assets/notes/day/test.webp'), image);
  writeFileSync(join(root, 'public/outside.webp'), image);
  const source = '## 2026-11-01\n\n**正文**\n\n![图片](/assets/notes/day/test.webp)';
  const [note] = await renderNotes(source, root);
  assert.match(note.html, /<strong>正文<\/strong>/);
  assert.match(note.html, /width="120"/);
  assert.match(note.html, /height="90"/);
  assert.match(note.html, /loading="lazy"/);
  for (const body of [
    '![]( /assets/notes/day/test.webp)',
    '![图片](https://example.com/test.webp)', '![图片](./test.webp)',
    '![图片](/assets/notes/day/missing.webp)',
    '![图片](/assets/notes/%2e%2e/%2e%2e/outside.webp)',
    '![图片][photo]\n\n[photo]: https://example.com/test.webp',
  ]) await assert.rejects(renderNotes(`## 2026-11-01\n\n${body}`, root));
});

test('note search combines normalized keywords and inclusive Beijing date boundaries', async () => {
  const { matchesNote } = await import('../src/scripts/notes-filter.mjs');
  const text = 'GPT 与 Claude：今天的工作流';
  assert.equal(matchesNote(text, '2026-11-01', { q: 'ｇｐｔ 工作流', from: '2026-11-01', to: '2026-11-01' }), true);
  assert.equal(matchesNote(text, '2026-11-01', { q: 'Grok' }), false);
  assert.equal(matchesNote(text, '2026-11-01', { from: '2026-11-02' }), false);
  assert.equal(matchesNote(text, '2026-11-01', { to: '2026-10-31' }), false);
  assert.equal(matchesNote(text, '2026-11-01', { q: '  ' }), true);
  assert.equal(matchesNote(text, '2026-11-01', { q: 'GPT', to: '2026-10-31' }), false);
});

test('highlight ranges preserve original offsets, merge overlaps, and treat queries as literal text', async () => {
  const { noteMatchRanges } = await import('../src/scripts/notes-filter.mjs');
  assert.deepEqual(noteMatchRanges('GPT 与 gpt', 'gPt'), [[0, 3], [6, 9]]);
  assert.deepEqual(noteMatchRanges('ＡＩ ﬁ e\u0301', 'ai fi é'), [[0, 2], [3, 4], [5, 7]]);
  assert.deepEqual(noteMatchRanges('Claude', 'claude laud'), [[0, 6]]);
  assert.deepEqual(noteMatchRanges('[GPT] <script>', '[GPT]'), [[0, 5]]);
  assert.deepEqual(noteMatchRanges('正文', '  '), []);
});
