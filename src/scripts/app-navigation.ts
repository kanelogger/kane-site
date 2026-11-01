import {
  AppDataError,
  appInitials,
  createAppExport,
  normalizeAppUrl,
  parseAppImport,
  sortApps,
  type AppDataErrorCode,
  type AppEntry,
} from '../lib/app-navigation-data';
import { registerAppNavigationTools, type AppNavigationToolHost, type AppSort } from '../lib/app-navigation-tools';

const DB_NAME = 'kane-app-navigation';
const DB_VERSION = 1;
const APP_STORE = 'apps';
const META_STORE = 'meta';
const KNOWN_STARTERS_KEY = 'knownStarterIds';
const MAX_IMPORT_SIZE = 2 * 1024 * 1024;
// One-time bridge for directories saved before knownStarterIds existed, so deleted defaults stay deleted. Later additions are filled from that record.
const INTRODUCED_STARTER_IDS = new Set(['default-111', 'default-112', 'default-113', 'default-114']);

type Copy = Record<string, string>;
type StarterApp = Omit<AppEntry, 'createdAt' | 'updatedAt'>;
type Bootstrap = { copy: Copy; starterApps: StarterApp[]; starterCategories: string[] };
type DialogFocus = { element?: HTMLElement; appId?: string; action?: string };

const errorCopy: Record<AppDataErrorCode, string> = {
  'invalid-payload': 'invalidFile',
  'unsupported-version': 'unsupportedVersion',
  'categories-required': 'categoriesRequired',
  'too-many-categories': 'tooManyCategories',
  'invalid-category': 'invalidCategory',
  'duplicate-category': 'duplicateCategory',
  'apps-required': 'appsRequired',
  'too-many-apps': 'tooManyApps',
  'invalid-app': 'invalidApp',
  'missing-name': 'missingName',
  'invalid-url': 'invalidUrl',
  'missing-category': 'missingCategory',
  'unknown-category': 'unknownCategory',
};

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.addEventListener('success', () => resolve(request.result), { once: true });
  request.addEventListener('error', () => reject(request.error), { once: true });
});

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.addEventListener('complete', () => resolve(), { once: true });
  transaction.addEventListener('error', () => reject(transaction.error), { once: true });
  transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
});

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let failed = false;
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(APP_STORE)) database.createObjectStore(APP_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
    });
    request.addEventListener('success', () => {
      if (failed) request.result.close();
      else resolve(request.result);
    }, { once: true });
    request.addEventListener('error', () => { failed = true; reject(request.error); }, { once: true });
    request.addEventListener('blocked', () => { failed = true; reject(new Error('IndexedDB upgrade blocked')); }, { once: true });
  });
}

class AppNavigationController {
  private root: HTMLElement;
  private copy: Copy;
  private starterApps: StarterApp[];
  private starterCategories: string[];
  private abort = new AbortController();
  private database?: IDBDatabase;
  private apps: AppEntry[] = [];
  private category = '';
  private query = '';
  private sort = 'default';
  private confirmAction?: () => Promise<void>;
  private destroyed = false;
  private composing = false;
  private initializing = false;
  private eventsBound = false;
  private toolsRegistered = false;
  private saving = false;
  private confirming = false;
  private desktop = matchMedia('(min-width: 960px)');
  private dialogFocus = new Map<HTMLDialogElement, DialogFocus>();
  private menuSequence = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const bootstrap = this.element<HTMLScriptElement>('[data-app-navigation-bootstrap]');
    const data = JSON.parse(bootstrap.textContent || '{}') as Bootstrap;
    this.copy = data.copy;
    this.starterApps = data.starterApps;
    this.starterCategories = data.starterCategories;
  }

  private element<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing app navigation element: ${selector}`);
    return element;
  }

  private text(key: string, values: Record<string, string | number> = {}): string {
    return (this.copy[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
  }

  private icon(name: string): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#apps-icon-${name}`);
    svg.append(use);
    return svg;
  }

  async init() {
    if (this.destroyed || this.initializing || this.root.dataset.ready === 'true') return;
    this.initializing = true;
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.root.setAttribute('aria-busy', 'true');
    this.element<HTMLElement>('[data-app-loading]').hidden = false;
    this.element<HTMLElement>('[data-storage-error]').hidden = true;
    this.element<HTMLElement>('[data-app-fallback]').hidden = true;
    try {
      this.database?.close();
      const database = await openDatabase();
      if (this.destroyed) {
        database.close();
        return;
      }
      this.database = database;
      await this.seedFirstVisit();
      if (this.destroyed) return;
      await this.syncStarterCatalog();
      if (this.destroyed) return;
      this.apps = await this.readAll();
      if (this.destroyed) return;
      this.render();
      this.root.dataset.ready = 'true';
      if (!this.toolsRegistered) {
        this.toolsRegistered = true;
        void registerAppNavigationTools(this.modelTools(), this.abort.signal);
      }
    } catch (error) {
      if (this.destroyed) return;
      console.error(error);
      this.database?.close();
      this.database = undefined;
      this.root.dataset.ready = 'false';
      this.element<HTMLElement>('[data-storage-error]').hidden = false;
      this.element<HTMLElement>('[data-app-fallback]').hidden = false;
    } finally {
      if (!this.destroyed) {
        this.initializing = false;
        this.element<HTMLElement>('[data-app-loading]').hidden = true;
        this.root.setAttribute('aria-busy', 'false');
      }
    }
  }

  destroy() {
    this.destroyed = true;
    this.closeCardMenu();
    this.toggleDataMenu(false);
    this.abort.abort();
    this.database?.close();
    this.root.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
    this.dialogFocus.clear();
  }

  isActiveOn(root: HTMLElement) {
    return !this.destroyed && this.root === root;
  }

  private async seedFirstVisit() {
    if (!this.database) return;
    const transaction = this.database.transaction([APP_STORE, META_STORE], 'readwrite');
    const apps = transaction.objectStore(APP_STORE);
    const meta = transaction.objectStore(META_STORE);
    const initialized = await requestResult(meta.get('initialized'));
    if (!initialized) {
      const now = Date.now();
      this.starterApps.forEach((app, index) => apps.put({ ...app, createdAt: now + index, updatedAt: now + index }));
      meta.put({ key: 'initialized', value: true });
    }
    await transactionDone(transaction);
  }

  private async readAll(): Promise<AppEntry[]> {
    if (!this.database) return [];
    return requestResult(this.database.transaction(APP_STORE, 'readonly').objectStore(APP_STORE).getAll()) as Promise<AppEntry[]>;
  }

  private async syncStarterCatalog() {
    if (!this.database) return;
    const catalog = new Map(this.starterApps.map((app) => [app.id, app]));
    const transaction = this.database.transaction([APP_STORE, META_STORE], 'readwrite');
    const store = transaction.objectStore(APP_STORE);
    const meta = transaction.objectStore(META_STORE);
    const existing = await requestResult(store.getAll()) as AppEntry[];
    const seen = new Set(existing.map((app) => app.id));
    existing.forEach((app) => {
      const starter = catalog.get(app.id);
      if (!starter || (app.category === starter.category && app.sortOrder === starter.sortOrder)) return;
      store.put({ ...app, category: starter.category, sortOrder: starter.sortOrder });
    });
    const record = await requestResult(meta.get(KNOWN_STARTERS_KEY)) as { value?: unknown } | undefined;
    const known = new Set(Array.isArray(record?.value) ? record.value.filter((id): id is string => typeof id === 'string') : []);
    const firstSync = known.size === 0;
    if (existing.length > 0) {
      const now = Date.now();
      this.starterApps.forEach((starter, index) => {
        if (seen.has(starter.id)) return;
        if (firstSync ? !INTRODUCED_STARTER_IDS.has(starter.id) : known.has(starter.id)) return;
        store.put({ ...starter, createdAt: now + index, updatedAt: now + index });
      });
    }
    meta.put({ key: KNOWN_STARTERS_KEY, value: this.starterApps.map((app) => app.id) });
    await transactionDone(transaction);
  }

  private async putApp(app: AppEntry) {
    if (!this.database) return;
    const transaction = this.database.transaction(APP_STORE, 'readwrite');
    transaction.objectStore(APP_STORE).put(app);
    await transactionDone(transaction);
  }

  private async deleteApp(id: string) {
    if (!this.database) return;
    const transaction = this.database.transaction(APP_STORE, 'readwrite');
    transaction.objectStore(APP_STORE).delete(id);
    await transactionDone(transaction);
  }

  private async replaceAll(apps: readonly AppEntry[]) {
    if (!this.database) return;
    const transaction = this.database.transaction(APP_STORE, 'readwrite');
    const store = transaction.objectStore(APP_STORE);
    store.clear();
    apps.forEach((app) => store.put(app));
    await transactionDone(transaction);
  }

  private visibleApps() {
    const query = this.query.trim().toLocaleLowerCase();
    const apps = this.apps.filter((app) => {
      const matchesCategory = !this.category || app.category === this.category;
      const haystack = `${app.name} ${app.url} ${app.category} ${app.description}`.toLocaleLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    });
    if (this.sort === 'name') return apps.sort((a, b) => a.name.localeCompare(b.name, document.documentElement.lang));
    if (this.sort === 'category') return apps.sort((a, b) => a.category.localeCompare(b.category, document.documentElement.lang) || a.name.localeCompare(b.name, document.documentElement.lang));
    return sortApps(apps);
  }

  private render() {
    if (this.destroyed) return;
    this.closeCardMenu();
    this.renderOrbit();
    this.renderCategories();
    this.renderList();
  }

  private categoryCounts() {
    return this.apps.reduce(
      (map, app) => map.set(app.category, (map.get(app.category) ?? 0) + 1),
      new Map<string, number>(),
    );
  }

  private orderedCategories(counts = this.categoryCounts()) {
    const ranks = new Map(this.starterCategories.map((category, index) => [category, index]));
    return [...counts.keys()].sort((a, b) => (ranks.get(a) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(b) ?? Number.MAX_SAFE_INTEGER)
      || (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
      || a.localeCompare(b, document.documentElement.lang));
  }


  private renderOrbit() {
    const favorites = sortApps(this.apps).filter((app) => app.favorite);
    const orbit = this.element<HTMLElement>('[data-favorite-orbit]');
    const overflow = this.element<HTMLDetailsElement>('[data-favorite-overflow]');
    const overflowList = this.element<HTMLElement>('[data-favorite-overflow-list]');
    const remaining = favorites.slice(8);
    overflow.hidden = remaining.length === 0;
    if (overflow.hidden) overflow.open = false;
    overflowList.replaceChildren(...remaining.map((app) => this.createOrbitItem(app)));
    this.updateFavoriteOverflowLabel();
    if (!favorites.length) {
      const empty = document.createElement('div');
      empty.className = 'apps-orbit-empty';
      const heading = document.createElement('strong');
      heading.textContent = this.text('orbitEmptyTitle');
      const hint = document.createElement('p');
      hint.textContent = this.text('orbitEmptyHint');
      empty.append(heading, hint);
      orbit.replaceChildren(empty);
      return;
    }
    orbit.replaceChildren(...favorites.slice(0, 8).map((app) => this.createOrbitItem(app)));
  }

  private updateFavoriteOverflowLabel() {
    const overflow = this.element<HTMLDetailsElement>('[data-favorite-overflow]');
    const remaining = this.element<HTMLElement>('[data-favorite-overflow-list]').childElementCount;
    this.element<HTMLElement>('[data-favorite-overflow-label]').textContent = this.text(overflow.open ? 'showFewerFavorites' : 'showMoreFavorites', { count: remaining });
  }

  private createOrbitItem(app: AppEntry): HTMLElement {
    const item = document.createElement('a');
    item.className = 'apps-orbit-item';
    item.href = app.url;
    item.target = '_blank';
    item.rel = 'noreferrer';
    item.title = app.name;
    const avatar = document.createElement('span');
    avatar.className = 'apps-orbit-avatar';
    avatar.textContent = app.shortcode || appInitials(app.name);
    avatar.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'apps-orbit-copy';
    const label = document.createElement('span');
    label.textContent = app.name;
    const domain = document.createElement('small');
    domain.textContent = new URL(app.url).hostname.replace(/^www\./, '');
    copy.append(label, domain);
    item.append(avatar, copy, this.icon('arrow'));
    return item;
  }

  private renderCategories() {
    const counts = this.categoryCounts();
    const categories = this.orderedCategories(counts);
    if (this.category && !counts.has(this.category)) this.category = '';
    const atlas = this.element<HTMLElement>('[data-category-atlas]');
    const focused = document.activeElement instanceof HTMLButtonElement && atlas.contains(document.activeElement)
      ? document.activeElement.dataset.appCategoryFilter : undefined;
    const createButton = (category: string, count: number) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'apps-category-button';
      button.dataset.appCategoryFilter = category;
      button.title = category || this.text('exploreAll');
      button.setAttribute('aria-pressed', String(this.category === category));
      button.setAttribute('aria-label', category ? this.text('openCategory', { name: category, count }) : this.text('exploreAll'));
      const label = document.createElement('span');
      label.textContent = category || this.text('exploreAll');
      const amount = document.createElement('span');
      amount.textContent = String(count).padStart(2, '0');
      button.append(label, amount);
      return button;
    };
    atlas.replaceChildren(createButton('', this.apps.length), ...categories.map((category) => {
      const count = counts.get(category) ?? 0;
      return createButton(category, count);
    }));
    this.element<HTMLElement>('[data-current-category]').textContent = this.category || this.text('exploreAll');
    if (focused !== undefined) this.focusCategory(focused);
    this.element<HTMLDataListElement>('[data-category-options]').replaceChildren(...categories.map((category) => {
      const option = document.createElement('option');
      option.value = category;
      return option;
    }));
  }

  private renderList() {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const focusedRow = focused?.closest<HTMLElement>('.apps-card');
    const focusedAction = focused?.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    this.closeCardMenu();
    const apps = this.visibleApps();
    this.element<HTMLElement>('[data-result-count]').textContent = `${apps.length} ${this.text('appCount')}`;
    this.element<HTMLElement>('[data-current-category-count]').textContent = String(apps.length);
    this.element<HTMLButtonElement>('[data-open-categories]').setAttribute('aria-label', `${this.text('chooseCategory')}: ${this.category || this.text('exploreAll')}, ${apps.length} ${this.text('appCount')}`);
    const title = this.query.trim()
      ? this.text('exploreSearch', { query: this.query.trim() })
      : this.category
        ? this.text('exploreCategory', { name: this.category })
        : this.text('exploreAll');
    this.element<HTMLElement>('[data-explore-title]').textContent = title;
    const reset = this.element<HTMLButtonElement>('[data-reset-filter]');
    reset.hidden = !this.category && !this.query.trim();
    const list = this.element<HTMLElement>('[data-app-list]');
    if (!apps.length) {
      const empty = document.createElement('section');
      empty.className = 'apps-empty';
      const index = document.createElement('span');
      index.className = 'apps-empty-index';
      index.textContent = '00';
      const heading = document.createElement('h2');
      heading.textContent = this.apps.length ? this.text('noMatches') : this.text('emptyTitle');
      const hint = document.createElement('p');
      hint.textContent = this.apps.length ? this.text('noMatchesHint') : this.text('emptyHint');
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'apps-action apps-action-primary';
      add.dataset.emptyAdd = '';
      const label = document.createElement('span');
      label.textContent = this.text('add');
      add.append(this.icon('plus'), label);
      empty.append(index, heading, hint, add);
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...apps.map((app) => this.createCard(app)));
    if (focusedRow?.dataset.id && focusedAction) this.focusCardAction(focusedRow.dataset.id, focusedAction === 'favorite' ? 'favorite' : 'more');
  }

  private createCard(app: AppEntry): HTMLElement {
    const card = document.createElement('article');
    card.className = `apps-card${app.favorite ? ' is-favorite' : ''}`;
    card.dataset.id = app.id;
    const avatar = document.createElement('div');
    avatar.className = 'apps-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = app.shortcode || appInitials(app.name);
    const copy = document.createElement('div');
    copy.className = 'apps-card-copy';
    const link = document.createElement('a');
    link.className = 'apps-card-link';
    link.href = app.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = app.name;
    link.title = app.name;
    const domain = document.createElement('small');
    domain.className = 'apps-domain';
    const hostname = new URL(app.url).hostname.replace(/^www\./, '');
    domain.textContent = hostname;
    domain.title = app.url;
    copy.append(link, domain);
    if (!this.category) {
      const category = document.createElement('span');
      category.className = 'apps-card-category';
      category.textContent = app.category;
      copy.append(category);
    }
    if (app.description.trim()) {
      const description = document.createElement('p');
      description.className = 'apps-card-description';
      description.textContent = app.description;
      description.title = app.description;
      copy.append(description);
    }
    const actions = document.createElement('div');
    actions.className = 'apps-card-actions';
    const favorite = this.actionButton(app.favorite ? 'unfavoriteAction' : 'favoriteAction', 'star', 'favorite', app, app.favorite ? 'is-favorite' : '');
    favorite.setAttribute('aria-pressed', String(app.favorite));
    const more = this.actionButton('moreActions', 'more', 'more', app, 'apps-card-menu-button');
    more.dataset.cardMenuButton = '';
    more.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'apps-card-menu';
    menu.dataset.cardMenu = '';
    menu.id = `apps-card-menu-${++this.menuSequence}`;
    menu.hidden = true;
    more.setAttribute('aria-controls', menu.id);
    for (const [label, icon, action] of [['editAction', 'edit', 'edit'], ['deleteAction', 'trash', 'delete']]) {
      const button = this.actionButton(label, icon, action, app, action === 'delete' ? 'is-danger' : '');
      button.classList.remove('apps-icon-button');
      const text = document.createElement('span');
      text.textContent = this.text(label);
      button.append(text);
      menu.append(button);
    }
    actions.append(favorite, more, menu);
    card.append(avatar, copy, actions);
    return card;
  }

  private focusCardAction(id: string, action: string) {
    const card = [...this.root.querySelectorAll<HTMLElement>('.apps-card')].find((row) => row.dataset.id === id);
    const button = card?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    if (button) button.focus({ preventScroll: true });
  }

  private closeCardMenu(restoreFocus = false) {
    const menu = this.root.querySelector<HTMLElement>('[data-card-menu]:not([hidden])');
    if (!menu) return false;
    const button = menu.parentElement?.querySelector<HTMLButtonElement>('[data-card-menu-button]');
    menu.hidden = true;
    menu.removeAttribute('style');
    button?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && button?.isConnected) button.focus({ preventScroll: true });
    return true;
  }

  private toggleCardMenu(button: HTMLButtonElement) {
    const menu = button.parentElement?.querySelector<HTMLElement>('[data-card-menu]');
    if (!menu) return;
    const opening = menu.hidden;
    this.closeCardMenu();
    this.toggleDataMenu(false);
    if (!opening) return;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    menu.style.maxHeight = `${Math.max(88, innerHeight - 24)}px`;
    menu.style.overflowY = 'auto';
    if (menu.getBoundingClientRect().bottom > innerHeight - 12) {
      menu.style.top = 'auto';
      menu.style.bottom = 'calc(100% + 6px)';
    }
    menu.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }

  private focusCategory(category: string) {
    const button = [...this.root.querySelectorAll<HTMLButtonElement>('[data-app-category-filter]')]
      .find((item) => item.dataset.appCategoryFilter === category);
    button?.focus({ preventScroll: true });
  }

  private syncCategoryLayout() {
    const dialog = this.element<HTMLDialogElement>('[data-category-dialog]');
    const panel = this.element<HTMLElement>('[data-category-panel]');
    const wasOpen = dialog.open;
    const focused = panel.contains(document.activeElement);
    if (this.desktop.matches) {
      if (wasOpen) dialog.close();
      this.element<HTMLElement>('[data-category-desktop]').append(panel);
      if (wasOpen || focused) this.focusCategory(this.category);
    } else {
      dialog.append(panel);
      if (focused && !dialog.open) this.element<HTMLButtonElement>('[data-open-categories]').focus({ preventScroll: true });
    }
    this.element<HTMLButtonElement>('[data-close-categories]').hidden = this.desktop.matches;
    this.element<HTMLButtonElement>('[data-open-categories]').setAttribute('aria-expanded', String(dialog.open));
  }

  private openCategories() {
    if (this.desktop.matches || this.root.dataset.ready !== 'true') return;
    this.closeCardMenu();
    this.toggleDataMenu(false);
    this.element<HTMLDialogElement>('[data-category-dialog]').showModal();
    this.element<HTMLButtonElement>('[data-open-categories]').setAttribute('aria-expanded', 'true');
    this.focusCategory(this.category);
  }

  private closeCategories() {
    const dialog = this.element<HTMLDialogElement>('[data-category-dialog]');
    if (dialog.open) dialog.close();
  }

  private rememberDialogFocus(dialog: HTMLDialogElement, source?: HTMLElement) {
    const active = source ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
    const card = active?.closest<HTMLElement>('.apps-card');
    const dataControl = active?.closest('.apps-data-control');
    this.dialogFocus.set(dialog, {
      element: dataControl ? this.element<HTMLButtonElement>('[data-data-menu-button]') : active,
      appId: card?.dataset.id,
      action: card ? 'more' : undefined,
    });
  }

  private restoreDialogFocus(dialog: HTMLDialogElement) {
    if (this.destroyed) return;
    const saved = this.dialogFocus.get(dialog);
    this.dialogFocus.delete(dialog);
    if (saved?.appId) {
      this.focusCardAction(saved.appId, saved.action ?? 'more');
      if (document.activeElement?.closest<HTMLElement>('.apps-card')?.dataset.id === saved.appId) return;
    }
    if (saved?.element?.isConnected && saved.element.getClientRects().length) saved.element.focus({ preventScroll: true });
    else this.element<HTMLButtonElement>('[data-add-button]').focus({ preventScroll: true });
  }

  private actionButton(labelKey: string, icon: string, action: string, app: AppEntry, className = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `apps-icon-button ${className}`.trim();
    button.dataset.action = action;
    button.setAttribute('aria-label', `${this.text(labelKey)} ${app.name}`);
    button.title = this.text(labelKey);
    button.append(this.icon(icon));
    return button;
  }

  private openEditor(app?: AppEntry, source?: HTMLElement) {
    const form = this.element<HTMLFormElement>('[data-app-form]');
    form.reset();
    const failure = this.element<HTMLElement>('[data-app-form-error]');
    failure.hidden = true;
    failure.textContent = '';
    this.root.querySelectorAll<HTMLElement>('[data-error-for]').forEach((node) => { node.textContent = ''; });
    form.querySelectorAll<HTMLElement>('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
    this.element<HTMLInputElement>('[data-app-id]').value = app?.id ?? '';
    this.element<HTMLInputElement>('[data-app-name]').value = app?.name ?? '';
    this.element<HTMLInputElement>('[data-app-url]').value = app?.url ?? '';
    this.element<HTMLInputElement>('[data-app-category]').value = app?.category ?? this.category;
    this.element<HTMLInputElement>('[data-app-shortcode]').value = app?.shortcode ?? '';
    this.element<HTMLTextAreaElement>('[data-app-description]').value = app?.description ?? '';
    this.element<HTMLInputElement>('[data-app-favorite]').checked = app?.favorite ?? false;
    this.element<HTMLElement>('[data-form-eyebrow]').textContent = this.text(app ? 'editEntry' : 'newEntry');
    this.element<HTMLElement>('[data-form-title]').textContent = this.text(app ? 'edit' : 'add');
    this.element<HTMLElement>('[data-save-label]').textContent = this.text(app ? 'saveChanges' : 'save');
    const dialog = this.element<HTMLDialogElement>('[data-app-dialog]');
    this.rememberDialogFocus(dialog, source);
    dialog.showModal();
    requestAnimationFrame(() => { if (!this.destroyed && dialog.open) this.element<HTMLInputElement>('[data-app-name]').focus(); });
  }

  private closeEditor() {
    const dialog = this.element<HTMLDialogElement>('[data-app-dialog]');
    if (dialog.open) dialog.close();
  }

  private validateForm(): { name: string; url: string; category: string } | undefined {
    const name = this.element<HTMLInputElement>('[data-app-name]').value.trim();
    const category = this.element<HTMLInputElement>('[data-app-category]').value.trim();
    let url = '';
    let validUrl = true;
    try { url = normalizeAppUrl(this.element<HTMLInputElement>('[data-app-url]').value); } catch { validUrl = false; }
    const errors = { name: name ? '' : this.text('nameRequired'), url: validUrl ? '' : this.text('urlRequired'), category: category ? '' : this.text('categoryRequired') };
    Object.entries(errors).forEach(([field, error]) => {
      const input = this.element<HTMLInputElement>(`[data-app-${field}]`);
      this.element<HTMLElement>(`[data-error-for="${field}"]`).textContent = error;
      input.setAttribute('aria-invalid', String(Boolean(error)));
    });
    if (Object.values(errors).some(Boolean)) {
      this.element<HTMLFormElement>('[data-app-form]').querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
      return undefined;
    }
    return { name, url, category };
  }

  private nextSortOrder() {
    return this.apps.reduce((maximum, app) => Math.max(maximum, Number.isFinite(app.sortOrder) ? app.sortOrder : 0), 0) + 1;
  }

  private async saveEditor(event: SubmitEvent) {
    event.preventDefault();
    if (this.saving || this.destroyed) return;
    const values = this.validateForm();
    if (!values) return;
    const id = this.element<HTMLInputElement>('[data-app-id]').value;
    const existing = this.apps.find((app) => app.id === id);
    const now = Date.now();
    const app: AppEntry = {
      id: existing?.id ?? globalThis.crypto.randomUUID(),
      name: values.name,
      url: values.url,
      category: values.category,
      sortOrder: existing?.sortOrder ?? this.nextSortOrder(),
      shortcode: this.element<HTMLInputElement>('[data-app-shortcode]').value.trim().toLocaleUpperCase().slice(0, 2) || appInitials(values.name),
      description: this.element<HTMLTextAreaElement>('[data-app-description]').value.trim().slice(0, 240),
      favorite: this.element<HTMLInputElement>('[data-app-favorite]').checked,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.saving = true;
    const failure = this.element<HTMLElement>('[data-app-form-error]');
    failure.hidden = true;
    failure.textContent = '';
    const form = this.element<HTMLFormElement>('[data-app-form]');
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      await this.putApp(app);
      if (this.destroyed) return;
      this.apps = await this.readAll();
      if (this.destroyed) return;
      this.closeEditor();
      this.render();
      this.showToast(this.text(existing ? 'updated' : 'added'));
    } catch (error) {
      if (!this.destroyed) {
        console.error(error);
        failure.textContent = this.text('saveFailed');
        failure.hidden = false;
      }
    } finally {
      if (!this.destroyed) {
        this.saving = false;
        submit.disabled = false;
        form.removeAttribute('aria-busy');
      }
    }
  }

  private openConfirm(title: string, message: string, actionLabel: string, action: () => Promise<void>, source?: HTMLElement) {
    this.confirmAction = action;
    const failure = this.element<HTMLElement>('[data-confirm-error]');
    failure.hidden = true;
    failure.textContent = '';
    this.element<HTMLElement>('[data-confirm-title]').textContent = title;
    this.element<HTMLElement>('[data-confirm-message]').textContent = message;
    this.element<HTMLButtonElement>('[data-confirm-action]').textContent = actionLabel;
    const dialog = this.element<HTMLDialogElement>('[data-confirm-dialog]');
    this.rememberDialogFocus(dialog, source);
    dialog.showModal();
  }

  private closeConfirm() {
    this.confirmAction = undefined;
    const dialog = this.element<HTMLDialogElement>('[data-confirm-dialog]');
    if (dialog.open) dialog.close();
  }

  private async runConfirm(event: SubmitEvent) {
    event.preventDefault();
    if (this.confirming || this.destroyed) return;
    const action = this.confirmAction;
    if (!action) return;
    this.confirming = true;
    const failure = this.element<HTMLElement>('[data-confirm-error]');
    failure.hidden = true;
    failure.textContent = '';
    const button = this.element<HTMLButtonElement>('[data-confirm-action]');
    const form = this.element<HTMLFormElement>('[data-confirm-form]');
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      await action();
      if (!this.destroyed) this.closeConfirm();
    } catch (error) {
      if (!this.destroyed) {
        console.error(error);
        failure.textContent = this.text('saveFailed');
        failure.hidden = false;
      }
    } finally {
      if (!this.destroyed) {
        this.confirming = false;
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    }
  }

  private toggleDataMenu(force?: boolean) {
    const menu = this.element<HTMLElement>('[data-data-menu]');
    const open = force ?? menu.hidden;
    if (open) this.closeCardMenu();
    menu.hidden = !open;
    this.element<HTMLButtonElement>('[data-data-menu-button]').setAttribute('aria-expanded', String(open));
  }

  private exportData() {
    const payload = createAppExport(this.apps);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `app-navigation-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    this.toggleDataMenu(false);
    this.showToast(this.text('exported', { count: this.apps.length }));
  }

  private importError(error: unknown): string {
    if (error instanceof AppDataError) {
      const reason = this.text(errorCopy[error.code]);
      return error.index === undefined ? reason : `${this.text('recordPrefix', { index: error.index + 1 })}${reason}`;
    }
    return this.text('invalidFile');
  }

  private async importFile(file: File) {
    try {
      if (file.size > MAX_IMPORT_SIZE) throw new Error(this.text('fileTooLarge'));
      let payload: unknown;
      try { payload = JSON.parse(await file.text()); } catch { throw new Error(this.text('invalidFile')); }
      if (this.destroyed) return;
      const apps = parseAppImport(payload);
      this.openConfirm(
        this.text('confirmImportTitle'),
        this.text('importMessage', { count: apps.length }),
        this.text('confirmImport'),
        () => this.commitImport(apps),
        this.element<HTMLButtonElement>('[data-data-menu-button]'),
      );
    } catch (error) {
      const reason = error instanceof Error && !(error instanceof AppDataError) ? error.message : this.importError(error);
      this.showToast(this.text('importFailed', { reason }), true);
    } finally {
      if (!this.destroyed) this.element<HTMLInputElement>('[data-import-input]').value = '';
    }
  }

  private async commitDelete(id: string) {
    await this.deleteApp(id);
    if (this.destroyed) return;
    this.apps = await this.readAll();
    if (this.destroyed) return;
    this.render();
    this.showToast(this.text('deleted'));
  }

  private async commitImport(apps: readonly AppEntry[]) {
    await this.replaceAll(apps);
    if (this.destroyed) return;
    this.apps = await this.readAll();
    if (this.destroyed) return;
    this.category = '';
    this.query = '';
    this.element<HTMLInputElement>('[data-search-input]').value = '';
    this.render();
    this.showToast(this.text('imported', { count: apps.length }));
  }

  private async commitClear() {
    await this.replaceAll([]);
    if (this.destroyed) return;
    this.apps = [];
    this.category = '';
    this.query = '';
    this.element<HTMLInputElement>('[data-search-input]').value = '';
    this.render();
    this.showToast(this.text('cleared'));
  }

  private currentSort(): AppSort {
    return this.sort === 'name' || this.sort === 'category' ? this.sort : 'default';
  }

  private dialogOpen(): boolean {
    return !!this.root.querySelector('dialog[open]');
  }

  private modelTools(): AppNavigationToolHost {
    return {
      apps: () => this.apps,
      view: () => ({ query: this.query, category: this.category, sort: this.currentSort() }),
      applyView: (state) => {
        if (this.destroyed) return 0;
        this.query = state.query;
        this.category = state.category;
        this.sort = state.sort;
        this.composing = false;
        this.element<HTMLInputElement>('[data-search-input]').value = state.query;
        this.element<HTMLSelectElement>('[data-sort-select]').value = state.sort;
        this.render();
        return this.visibleApps().length;
      },
      persist: async (app, notice) => {
        if (this.destroyed || !this.database) return false;
        try {
          await this.putApp(app);
          if (this.destroyed) return false;
          this.apps = await this.readAll();
          if (this.destroyed) return false;
          this.render();
          this.showToast(this.text(notice));
          return true;
        } catch (error) {
          console.error(error);
          return false;
        }
      },
      requestConfirmation: (request) => {
        if (this.destroyed || this.dialogOpen()) return false;
        if (request.action === 'delete') {
          const app = request.app;
          this.openConfirm(this.text('confirmDeleteTitle', { name: app.name }), this.text('confirmDeleteMessage'), this.text('confirmDelete'), () => this.commitDelete(app.id));
        } else if (request.action === 'import') {
          const apps = request.apps;
          this.openConfirm(this.text('confirmImportTitle'), this.text('importMessage', { count: apps.length }), this.text('confirmImport'), () => this.commitImport(apps));
        } else {
          this.openConfirm(this.text('confirmClearTitle'), this.text('confirmClearMessage'), this.text('confirmClear'), () => this.commitClear());
        }
        return true;
      },
    };
  }

  private showToast(message: string, error = false) {
    if (this.destroyed) return;
    const toast = document.createElement('div');
    toast.className = `apps-toast${error ? ' is-error' : ''}`;
    toast.append(this.icon(error ? 'close' : 'check'));
    const label = document.createElement('span');
    label.textContent = message;
    toast.append(label);
    this.element<HTMLElement>('[data-toast-region]').append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  private bindEvents() {
    const signal = this.abort.signal;
    this.element<HTMLFormElement>('[data-app-form]').addEventListener('submit', (event) => { void this.saveEditor(event); }, { signal });
    this.element<HTMLFormElement>('[data-confirm-form]').addEventListener('submit', (event) => { void this.runConfirm(event); }, { signal });
    this.element<HTMLDetailsElement>('[data-favorite-overflow]').addEventListener('toggle', () => this.updateFavoriteOverflowLabel(), { signal });
    this.element<HTMLInputElement>('[data-import-input]').addEventListener('change', (event) => {
      const file = (event.currentTarget as HTMLInputElement).files?.[0];
      if (file) void this.importFile(file);
    }, { signal });
    this.element<HTMLInputElement>('[data-search-input]').addEventListener('compositionstart', () => { this.composing = true; }, { signal });
    this.element<HTMLInputElement>('[data-search-input]').addEventListener('compositionend', (event) => {
      this.composing = false;
      this.query = (event.currentTarget as HTMLInputElement).value;
      if (this.query.trim()) this.category = '';
      this.renderCategories();
      this.renderList();
    }, { signal });
    this.element<HTMLInputElement>('[data-search-input]').addEventListener('input', (event) => {
      if (this.composing) return;
      this.query = (event.currentTarget as HTMLInputElement).value;
      if (this.query.trim()) this.category = '';
      this.renderCategories();
      this.renderList();
    }, { signal });
    this.element<HTMLSelectElement>('[data-sort-select]').addEventListener('change', (event) => {
      this.sort = (event.currentTarget as HTMLSelectElement).value;
      this.renderList();
    }, { signal });
    this.root.addEventListener('click', (event) => {
      void this.handleClick(event).catch((error) => {
        if (this.destroyed) return;
        console.error(error);
        this.showToast(this.text('saveFailed'), true);
      });
    }, { signal });
    this.desktop.addEventListener('change', () => this.syncCategoryLayout(), { signal });
    this.syncCategoryLayout();
    const categoryDialog = this.element<HTMLDialogElement>('[data-category-dialog]');
    categoryDialog.addEventListener('close', () => {
      if (this.destroyed) return;
      this.element<HTMLButtonElement>('[data-open-categories]').setAttribute('aria-expanded', 'false');
      if (this.desktop.matches) this.focusCategory(this.category);
      else this.element<HTMLButtonElement>('[data-open-categories]').focus({ preventScroll: true });
    }, { signal });
    for (const selector of ['[data-app-dialog]', '[data-confirm-dialog]']) {
      const dialog = this.element<HTMLDialogElement>(selector);
      dialog.addEventListener('close', () => {
        if (selector === '[data-confirm-dialog]') this.confirmAction = undefined;
        this.restoreDialogFocus(dialog);
      }, { signal });
    }
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.apps-data-control')) this.toggleDataMenu(false);
      if (!(event.target instanceof Element) || !event.target.closest('.apps-card-actions')) this.closeCardMenu();
    }, { signal });
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k' && this.root.dataset.ready === 'true' && !this.dialogOpen()) {
        event.preventDefault();
        this.element<HTMLInputElement>('[data-search-input]').focus();
      }
      if (event.key === 'Escape') {
        const cardClosed = this.closeCardMenu(true);
        const dataOpen = !this.element<HTMLElement>('[data-data-menu]').hidden;
        this.toggleDataMenu(false);
        if (dataOpen) this.element<HTMLButtonElement>('[data-data-menu-button]').focus({ preventScroll: true });
        if (cardClosed || dataOpen) event.preventDefault();
      }
    }, { signal });
    document.addEventListener('focusin', (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.apps-card-actions')) this.closeCardMenu();
    }, { signal });
    window.addEventListener('resize', () => this.closeCardMenu(), { signal });
    this.root.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }, { signal });
    });
  }

  private async handleClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-retry-storage]')) { void this.init(); return; }
    if (event.target.closest('[data-open-categories]')) { this.openCategories(); return; }
    if (event.target.closest('[data-close-categories]')) { this.closeCategories(); return; }
    if (event.target.closest('[data-add-button], [data-empty-add]')) { this.openEditor(); return; }
    if (event.target.closest('[data-close-app-dialog], [data-cancel-app-dialog]')) { this.closeEditor(); return; }
    if (event.target.closest('[data-confirm-cancel]')) { this.closeConfirm(); return; }
    if (event.target.closest('[data-data-menu-button]')) { this.toggleDataMenu(); return; }
    if (event.target.closest('[data-import-button]')) { this.toggleDataMenu(false); this.element<HTMLInputElement>('[data-import-input]').click(); return; }
    if (event.target.closest('[data-export-button]')) { this.exportData(); return; }
    if (event.target.closest('[data-clear-button]')) {
      this.toggleDataMenu(false);
      this.openConfirm(this.text('confirmClearTitle'), this.text('confirmClearMessage'), this.text('confirmClear'), () => this.commitClear(), this.element<HTMLButtonElement>('[data-data-menu-button]'));
      return;
    }
    if (event.target.closest('[data-reset-filter]')) {
      this.category = '';
      this.query = '';
      this.element<HTMLInputElement>('[data-search-input]').value = '';
      this.render();
      return;
    }
    const category = event.target.closest<HTMLButtonElement>('[data-app-category-filter]');
    if (category) {
      this.category = category.dataset.appCategoryFilter ?? '';
      this.query = '';
      this.element<HTMLInputElement>('[data-search-input]').value = '';
      this.render();
      if (this.desktop.matches) this.focusCategory(this.category);
      else this.closeCategories();
      return;
    }
    const row = event.target.closest<HTMLElement>('.apps-card');
    const action = event.target.closest<HTMLButtonElement>('[data-action]');
    if (!row || !action) return;
    const app = this.apps.find((entry) => entry.id === row.dataset.id);
    if (!app) return;
    if (action.dataset.action === 'more') { this.toggleCardMenu(action); return; }
    this.closeCardMenu();
    if (action.dataset.action === 'favorite') {
      action.disabled = true;
      try {
        await this.putApp({ ...app, favorite: !app.favorite, updatedAt: Date.now() });
        if (this.destroyed) return;
        this.apps = await this.readAll();
        if (this.destroyed) return;
        this.render();
        this.focusCardAction(app.id, 'favorite');
      } finally {
        if (!this.destroyed && action.isConnected) action.disabled = false;
      }
      this.showToast(this.text(app.favorite ? 'unfavorited' : 'favorited'));
    } else if (action.dataset.action === 'edit') {
      this.openEditor(app, row.querySelector<HTMLButtonElement>('[data-card-menu-button]') ?? undefined);
    } else if (action.dataset.action === 'delete') {
      this.openConfirm(this.text('confirmDeleteTitle', { name: app.name }), this.text('confirmDeleteMessage'), this.text('confirmDelete'), () => this.commitDelete(app.id), row.querySelector<HTMLButtonElement>('[data-card-menu-button]') ?? undefined);
    }
  }
}

let controller: AppNavigationController | undefined;

function mount() {
  const root = document.querySelector<HTMLElement>('[data-app-navigation]');
  if (!root) {
    controller?.destroy();
    controller = undefined;
    return;
  }
  if (controller?.isActiveOn(root)) return;
  controller?.destroy();
  controller = new AppNavigationController(root);
  void controller.init();
}

document.addEventListener('astro:before-swap', () => {
  controller?.destroy();
  controller = undefined;
});
document.addEventListener('astro:page-load', mount);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
