import { navigate } from 'astro:transitions/client';

type ScrollPosition = { x: number; y: number; mode: 'workspace' | 'document' };
type ListLocation = { url: string; scroll: ScrollPosition };
type ContentState = { list?: ListLocation; origin?: ListLocation };

const stateKey = 'kaneContent';
const listPaths = new Set(['/dashboard', '/writing', '/work']);
const positions = new Map<number, ListLocation>();
let renderedURL = '';
let renderedHash = '';
let transitioning = false;
let navigationType = 'initial';
let composing = false;
let filterFocus: string | undefined;

const pageURL = () => location.pathname + location.search;
const state = (): ContentState => history.state?.[stateKey] ?? {};
const browser = () => document.querySelector<HTMLElement>('[data-content-browser]');
const scroller = () => document.querySelector<HTMLElement>('[data-workspace-scroll]');
const usesWorkspaceScroll = () => !!scroller() && matchMedia('(min-width: 800px)').matches;

function validList(value: unknown): value is ListLocation {
  if (!value || typeof value !== 'object') return false;
  const record = value as ListLocation;
  if (typeof record.url !== 'string' || !record.scroll) return false;
  try {
    const url = new URL(record.url, location.origin);
    return url.origin === location.origin && listPaths.has(url.pathname.replace(/\/$/, ''))
      && (record.scroll.mode === 'workspace' || record.scroll.mode === 'document')
      && Number.isFinite(record.scroll.x) && Number.isFinite(record.scroll.y)
      && record.scroll.x >= 0 && record.scroll.y >= 0;
  } catch { return false; }
}

function position(): ScrollPosition {
  const element = scroller();
  return usesWorkspaceScroll() && element
    ? { x: element.scrollLeft, y: element.scrollTop, mode: 'workspace' }
    : { x: scrollX, y: scrollY, mode: 'document' };
}

function savePosition(persist = true) {
  if (transitioning || !browser() || renderedURL !== pageURL()) return;
  const list = { url: pageURL(), scroll: position() };
  positions.set(history.state.index, list);
  if (persist) history.replaceState({ ...history.state, [stateKey]: { ...state(), list } }, '');
}

function restorePosition(saved: ScrollPosition) {
  if (usesWorkspaceScroll()) scroller()?.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
  else window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
}

function applyFilters() {
  const root = browser();
  if (!root) return;
  const parameters = new URLSearchParams(location.search);
  const query = parameters.get('q') ?? '';
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const category = parameters.get('category') ?? '';
  const hasCategories = !!root.querySelector('[data-content-category]');
  const input = root.querySelector<HTMLInputElement>('[data-content-query]');
  if (input && !composing && input.value !== query) input.value = query;
  root.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.category === category));
  });
  let count = 0;
  root.querySelectorAll<HTMLElement>('[data-content-group]').forEach((group) => {
    let groupCount = 0;
    group.querySelectorAll<HTMLElement>('[data-content-row]').forEach((row) => {
      const matches = (!normalizedQuery || (row.dataset.search ?? '').toLocaleLowerCase().includes(normalizedQuery))
        && (!hasCategories || !category || row.dataset.category === category);
      row.hidden = !matches;
      if (matches) groupCount++;
    });
    group.hidden = groupCount === 0;
    const label = group.querySelector('[data-group-count]');
    if (label) label.textContent = String(groupCount).padStart(2, '0');
    count += groupCount;
  });
  const countLabel = root.querySelector('[data-result-count]');
  if (countLabel) countLabel.textContent = `${count} 项内容`;
  const empty = root.querySelector<HTMLElement>('[data-content-empty]');
  if (empty) empty.hidden = count > 0;
  const clear = root.querySelector<HTMLElement>('.content-search-line [data-clear-filters]');
  if (clear) clear.hidden = !query && !category;
}

function mount() {
  renderedURL = pageURL();
  renderedHash = location.hash;
  composing = false;
  const root = browser();
  if (root) {
    const nativePosition: ScrollPosition = { x: history.state?.scrollX ?? 0, y: history.state?.scrollY ?? 0, mode: 'document' };
    root.querySelector<HTMLElement>('[data-content-tools]')?.removeAttribute('hidden');
    applyFilters();
    const saved = navigationType === 'traverse' ? positions.get(history.state?.index) ?? state().list : state().list;
    if (navigationType === 'traverse' && !usesWorkspaceScroll()) {
      // Filtering follows Astro's swap. Reapply its position after rows change height.
      restorePosition(nativePosition);
    } else if (validList(saved) && saved.url === pageURL()) {
      restorePosition(saved.scroll);
    }
  }
  const origin = state().origin;
  if (validList(origin)) {
    document.querySelectorAll<HTMLAnchorElement>('[data-return-results]').forEach((back) => {
      back.href = origin.url;
      back.textContent = '← 返回结果';
    });
  }
  if (filterFocus && root) {
    root.querySelector<HTMLElement>(filterFocus)?.focus({ preventScroll: true });
    filterFocus = undefined;
  }
  transitioning = false;
  savePosition();
}

function search(input: HTMLInputElement) {
  const url = new URL(location.href);
  if (input.value) url.searchParams.set('q', input.value);
  else url.searchParams.delete('q');
  url.hash = '';
  history.replaceState({ ...history.state }, '', url);
  renderedURL = pageURL();
  applyFilters();
  savePosition();
}

function pushFilters(url: URL) {
  if (url.pathname + url.search === pageURL()) { filterFocus = undefined; return; }
  savePosition();
  // Let ClientRouter create this entry so its internal history index stays in sync.
  const next: ContentState = { list: { url: url.pathname + url.search, scroll: { x: 0, y: 0, mode: position().mode } } };
  void navigate(url.href, { history: 'push', state: { ...history.state, [stateKey]: next } });
}

document.addEventListener('compositionstart', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-content-query]')) composing = true;
});
document.addEventListener('compositionend', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-content-query]')) {
    composing = false;
    search(event.target);
  }
});
document.addEventListener('input', (event) => {
  if (!composing && event.target instanceof HTMLInputElement && event.target.matches('[data-content-query]')) search(event.target);
});
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!(event.target instanceof Element)) return;
  const category = event.target.closest<HTMLButtonElement>('button[data-category]');
  const clear = event.target.closest<HTMLButtonElement>('[data-clear-filters]');
  if (category || clear) {
    const url = new URL(location.href);
    url.hash = '';
    if (clear) { url.searchParams.delete('q'); url.searchParams.delete('category'); }
    else if (category?.dataset.category) url.searchParams.set('category', category.dataset.category);
    else url.searchParams.delete('category');
    filterFocus = clear ? '[data-content-query]' : `button[data-category="${CSS.escape(category?.dataset.category ?? '')}"]`;
    pushFilters(url);
    return;
  }
  const anchor = event.target.closest<HTMLAnchorElement>('a');
  if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download') || anchor.hasAttribute('data-astro-reload')) return;
  const destination = new URL(anchor.href, location.href);
  if (destination.origin !== location.origin) return;
  if (anchor.matches('[data-result-link]') && browser()) {
    savePosition();
    const origin: ListLocation = { url: pageURL(), scroll: position() };
    if (!validList(origin)) return;
    event.preventDefault();
    void navigate(destination.href, { sourceElement: anchor, state: { [stateKey]: { origin } } });
  } else if (anchor.matches('[data-return-results]') && validList(state().origin)) {
    event.preventDefault();
    const origin = state().origin!;
    void navigate(origin.url, { sourceElement: anchor, state: { [stateKey]: { list: origin } } });
  } else if (destination.pathname === location.pathname && destination.search === location.search && destination.hash && (validList(state().origin) || browser())) {
    // Preserve list/source state for skip links and ToC history entries.
    savePosition();
    event.preventDefault();
    void navigate(destination.href, { sourceElement: anchor, state: { ...history.state, [stateKey]: state() } }).then(() => {
      if (renderedURL === pageURL()) renderedHash = location.hash;
    });
  }
}, true);

document.addEventListener('scroll', (event) => {
  // Keep every position in memory; avoid History API rate limits during long scrolls.
  if (event.target === document || event.target === scroller()) savePosition(false);
}, { capture: true, passive: true });
document.addEventListener('scrollend', (event) => {
  if (event.target === document || event.target === scroller()) savePosition();
}, { capture: true, passive: true });
window.addEventListener('pagehide', () => savePosition());
window.addEventListener('popstate', () => {
  const hashTraversal = renderedURL === pageURL() && renderedHash !== location.hash;
  transitioning = !hashTraversal;
  navigationType = 'traverse';
  if (hashTraversal) {
    renderedHash = location.hash;
    // Same-document hash traversal emits no Astro swap lifecycle events.
    queueMicrotask(() => {
      const saved = positions.get(history.state?.index) ?? state().list;
      if (browser() && usesWorkspaceScroll() && validList(saved) && saved.url === pageURL()) restorePosition(saved.scroll);
      savePosition();
    });
  }
}, true);
window.addEventListener('hashchange', () => { if (renderedURL === pageURL()) renderedHash = location.hash; });
document.addEventListener('astro:before-preparation', (event) => {
  if (event.navigationType !== 'traverse') savePosition();
  transitioning = true;
  navigationType = event.navigationType;
});
document.addEventListener('astro:after-swap', mount);
// Initial load is the only mount not preceded by an Astro swap.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
