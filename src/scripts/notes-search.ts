import 'cally';
import { matchesNote, noteMatchRanges } from './notes-filter.mjs';

function highlightNote(body: HTMLElement, query: string) {
  body.querySelectorAll('mark[data-note-highlight]').forEach((mark) => mark.replaceWith(...mark.childNodes));
  body.normalize();
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number; end: number }[] = [];
  let text = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    nodes.push({ node, start: text.length, end: text.length + node.length });
    text += node.data;
  }
  const ranges = noteMatchRanges(text, query);
  // Split each text node independently so links, emphasis and code keep their structure.
  for (const { node, start, end } of nodes) {
    const matches = ranges.filter(([a, b]: number[]) => a < end && b > start);
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const [a, b] of matches) {
      const left = Math.max(a - start, 0);
      const right = Math.min(b - start, node.length);
      fragment.append(node.data.slice(cursor, left));
      const mark = document.createElement('mark');
      mark.dataset.noteHighlight = '';
      mark.textContent = node.data.slice(left, right);
      fragment.append(mark);
      cursor = right;
    }
    fragment.append(node.data.slice(cursor));
    node.replaceWith(fragment);
  }
}

let dispose: (() => void) | undefined;
function mountNotes() {
  dispose?.();
  const root = document.querySelector<HTMLElement>('[data-notes]');
  const form = root?.querySelector<HTMLFormElement>('[data-notes-search]');
  if (!root || !form) return;
  const controller = new AbortController();
  dispose = () => controller.abort();
  const options = { signal: controller.signal };
  const query = form.elements.namedItem('q') as HTMLInputElement;
  const from = form.elements.namedItem('from') as HTMLInputElement;
  const to = form.elements.namedItem('to') as HTMLInputElement;
  const entries = [...root.querySelectorAll<HTMLElement>('[data-note-date]')];
  const text = entries.map((entry) => entry.querySelector('.notes-body')?.textContent ?? '');
  const status = root.querySelector<HTMLElement>('[data-notes-status]')!;
  const empty = root.querySelector<HTMLElement>('[data-notes-empty]')!;
  const en = document.documentElement.lang === 'en';
  const calendar = root.querySelector('calendar-range')!;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  calendar.today = today;
  function syncCalendar() {
    const valid = !from.value || !to.value || from.value <= to.value;
    calendar.value = valid && from.value && to.value ? `${from.value}/${to.value}` : '';
    calendar.tentative = valid && from.value && !to.value ? from.value : '';
    calendar.focusedDate = from.value || to.value || today;
  }
  function apply() {
    const invalid = !!from.value && !!to.value && from.value > to.value;
    to.setCustomValidity(invalid ? (en ? 'End date must be on or after start date.' : '结束日期不能早于开始日期。') : '');
    to.setAttribute('aria-invalid', String(invalid));
    if (invalid) {
      status.textContent = en ? 'End date must be on or after start date.' : '结束日期不能早于开始日期。';
      return;
    }
    let count = 0;
    entries.forEach((entry, index) => {
      entry.hidden = !matchesNote(text[index], entry.dataset.noteDate, { q: query.value, from: from.value, to: to.value });
      const body = entry.querySelector<HTMLElement>('.notes-body');
      if (body) highlightNote(body, entry.hidden ? '' : query.value);
      if (!entry.hidden) count++;
    });
    status.textContent = en ? `${count} of ${entries.length} notes` : `共 ${entries.length} 条 · 显示 ${count} 条`;
    empty.hidden = count !== 0 || entries.length === 0;
    const url = new URL(location.href);
    for (const input of [query, from, to]) {
      if (input.value) url.searchParams.set(input.name, input.value);
      else url.searchParams.delete(input.name);
    }
    history.replaceState({ ...history.state }, '', url);
  }
  function restore() {
    const params = new URLSearchParams(location.search);
    for (const input of [query, from, to]) input.value = params.get(input.name) ?? '';
    syncCalendar();
    apply();
  }
  form.hidden = false;
  form.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement && (!(event instanceof InputEvent) || !event.isComposing)) {
      if (event.target === from || event.target === to) syncCalendar();
      apply();
    }
  }, options);
  calendar.addEventListener('rangestart', (event) => {
    // Cally emits a UTC Date representing a calendar day; avoid local timezone conversion.
    from.value = (event as CustomEvent<Date>).detail.toISOString().slice(0, 10);
    to.value = '';
    apply();
  }, options);
  calendar.addEventListener('change', (event) => {
    if (event.target !== calendar) return;
    [from.value, to.value] = calendar.value.split('/');
    apply();
  }, options);
  form.addEventListener('compositionend', apply, options);
  form.addEventListener('submit', (event) => { event.preventDefault(); apply(); form.reportValidity(); }, options);
  root.querySelectorAll('[data-notes-reset]').forEach((button) => button.addEventListener('click', () => {
    form.reset(); syncCalendar(); apply(); query.focus();
  }, options));
  window.addEventListener('popstate', restore, options);
  restore();
}
document.addEventListener('astro:before-swap', () => dispose?.());
document.addEventListener('astro:page-load', mountNotes);
