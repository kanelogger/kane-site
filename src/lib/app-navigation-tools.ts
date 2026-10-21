import {
  APP_DATA_VERSION,
  AppDataError,
  MAX_APP_ENTRIES,
  MAX_CATEGORIES,
  appInitials,
  categoriesFromApps,
  createAppExport,
  normalizeAppUrl,
  parseAppImport,
  sortApps,
  type AppDataErrorCode,
  type AppEntry,
} from './app-navigation-data.ts';

export type AppSort = 'default' | 'name' | 'category';
export type AppNotice = 'added' | 'updated' | 'favorited' | 'unfavorited';
export type ToolError = { error: string };
export type ShowAppsState = { query: string; category: string; sort: AppSort };
export type ConfirmationRequest =
  | { action: 'delete'; app: AppEntry }
  | { action: 'import'; apps: readonly AppEntry[] }
  | { action: 'clear' };

export interface PublicApp {
  id: string;
  name: string;
  url: string;
  category: string;
  description: string;
  shortcode: string;
  favorite: boolean;
}

export interface AppNavigationToolHost {
  apps(): readonly AppEntry[];
  view(): ShowAppsState;
  applyView(state: ShowAppsState): number;
  persist(app: AppEntry, notice: AppNotice): Promise<boolean>;
  requestConfirmation(request: ConfirmationRequest): boolean;
}

interface ToolAnnotations {
  readOnlyHint: boolean;
  untrustedContentHint: boolean;
  consequentialHint: boolean;
}

interface ToolExecuteOptions {
  signal?: AbortSignal;
}

export interface AppNavigationTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: ToolAnnotations;
  execute: (input: unknown, options?: ToolExecuteOptions) => Promise<unknown>;
}

interface ModelContextRegistration {
  registerTool(tool: AppNavigationTool, options?: { signal?: AbortSignal }): Promise<void>;
}

const SORTS: readonly AppSort[] = ['default', 'name', 'category'];
const CANCELLED = 'The tool call was cancelled.';
const DIALOG_BUSY = 'A dialog is already open on the page. Close it before asking for another confirmation.';
const SAVE_FAILED = 'The app could not be saved in this browser.';

const importErrors: Record<AppDataErrorCode, string> = {
  'invalid-payload': 'The import must be an object with version, categories, and apps.',
  'unsupported-version': `Only version ${APP_DATA_VERSION} exports can be imported.`,
  'categories-required': 'categories must be an array.',
  'too-many-categories': `A list can contain at most ${MAX_CATEGORIES} categories.`,
  'invalid-category': 'Every category must be a non-empty string.',
  'duplicate-category': 'categories contains a duplicate.',
  'apps-required': 'apps must be an array.',
  'too-many-apps': `A list can contain at most ${MAX_APP_ENTRIES} apps.`,
  'invalid-app': 'An app entry must be an object.',
  'missing-name': 'An app is missing its name.',
  'invalid-url': 'An app URL must be an http or https address.',
  'missing-category': 'An app is missing its category.',
  'unknown-category': 'An app uses a category that is not listed in categories.',
};

const failure = (error: string): ToolError => ({ error });

function isToolError(value: unknown): value is ToolError {
  return value !== null && typeof value === 'object' && 'error' in value && typeof value.error === 'string';
}

function cancelled(options?: ToolExecuteOptions): boolean {
  return options?.signal?.aborted === true;
}

function argumentsOf(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

export function toPublicApp(app: AppEntry): PublicApp {
  return {
    id: app.id,
    name: app.name,
    url: app.url,
    category: app.category,
    description: app.description,
    shortcode: app.shortcode,
    favorite: app.favorite,
  };
}

function textField(value: unknown, maximum: number, label: string): string | ToolError | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return failure(`${label} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > maximum) return failure(`${label} must be ${maximum} characters or fewer.`);
  return trimmed;
}

export function resolveApp(apps: readonly AppEntry[], input: { id?: unknown; name?: unknown }): AppEntry | ToolError {
  const id = textField(input.id, 80, 'id');
  if (id && isToolError(id)) return id;
  const name = textField(input.name, 80, 'name');
  if (name && isToolError(name)) return name;
  if (!id && !name) return failure('Pass an app id or an exact app name.');
  if (id) {
    const match = apps.find((app) => app.id === id);
    return match ?? failure(`No app has id ${quoted(id)}.`);
  }
  const matches = apps.filter((app) => app.name === name);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) return failure(`No app is named ${quoted(name ?? '')}.`);
  return failure(`More than one app is named ${quoted(name ?? '')}. Pass its id.`);
}

export function filterListedApps(
  apps: readonly AppEntry[],
  input: { query?: unknown; category?: unknown; favorite?: unknown },
): PublicApp[] | ToolError {
  const query = textField(input.query, 200, 'query');
  if (query && isToolError(query)) return query;
  const category = textField(input.category, 40, 'category');
  if (category && isToolError(category)) return category;
  if (category && !apps.some((app) => app.category === category)) return failure(`No category is named ${quoted(category)}.`);
  if (input.favorite !== undefined && typeof input.favorite !== 'boolean') return failure('favorite must be a boolean.');
  const needle = query?.toLocaleLowerCase() ?? '';
  const favorite = typeof input.favorite === 'boolean' ? input.favorite : undefined;
  return sortApps(apps.filter((app) => {
    if (category && app.category !== category) return false;
    if (favorite !== undefined && app.favorite !== favorite) return false;
    if (!needle) return true;
    return `${app.name} ${app.url} ${app.category} ${app.description}`.toLocaleLowerCase().includes(needle);
  })).map(toPublicApp);
}

export function planShowApps(apps: readonly AppEntry[], current: ShowAppsState, input: Record<string, unknown>): ShowAppsState | ToolError {
  const hasQuery = 'query' in input;
  const hasCategory = 'category' in input;
  const hasSort = 'sort' in input;
  if (!hasQuery && !hasCategory && !hasSort) return failure('Pass a query, category, or sort.');

  let sort = current.sort;
  if (hasSort) {
    if (typeof input.sort !== 'string' || !SORTS.includes(input.sort as AppSort)) return failure('sort must be default, name, or category.');
    sort = input.sort as AppSort;
  }

  const query = hasQuery ? textField(input.query, 200, 'query') : undefined;
  if (query && isToolError(query)) return query;
  const category = hasCategory ? textField(input.category, 40, 'category') : undefined;
  if (category && isToolError(category)) return category;
  if (query && category) return failure('Pass either a search query or a category. A non-empty query searches every category.');
  if (category && !apps.some((app) => app.category === category)) {
    return failure(`No category is named ${quoted(category)}. Pass an empty string to show every category.`);
  }

  let nextQuery = current.query;
  let nextCategory = current.category;
  if (query) {
    nextQuery = query;
    nextCategory = '';
  } else if (category !== undefined) {
    nextCategory = category;
    nextQuery = '';
  } else if (query === '') {
    nextQuery = '';
  }
  return { query: nextQuery, category: nextCategory, sort };
}

function booleanField(value: unknown, label: string): boolean | ToolError | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') return failure(`${label} must be a boolean.`);
  return value;
}

function categoriesAfterReplacement(apps: readonly AppEntry[], existing?: AppEntry): Set<string> {
  const categories = new Set(apps.map((app) => app.category));
  if (!existing) return categories;
  const stillUsed = apps.some((app) => app.id !== existing.id && app.category === existing.category);
  if (!stillUsed) categories.delete(existing.category);
  return categories;
}

export function planAppSave(apps: readonly AppEntry[], input: Record<string, unknown>, now = Date.now()): { app: AppEntry; created: boolean } | ToolError {
  const id = textField(input.id, 80, 'id');
  if (id && isToolError(id)) return id;
  const existing = id ? apps.find((app) => app.id === id) : undefined;
  if (id && !existing) return failure(`No app has id ${quoted(id)}.`);

  const name = input.name === undefined && existing ? existing.name : textField(input.name, 80, 'name');
  if (typeof name !== 'string') return name ?? failure('name must not be empty.');
  if (!name) return failure('name must not be empty.');

  let url = existing?.url ?? '';
  if (input.url !== undefined || !existing) {
    if (typeof input.url !== 'string') return failure('url must be a string.');
    if (input.url.trim().length > 2048) return failure('url must be 2048 characters or fewer.');
    try {
      url = normalizeAppUrl(input.url);
    } catch {
      return failure('url must be an http or https address.');
    }
  }

  const category = input.category === undefined && existing ? existing.category : textField(input.category, 40, 'category');
  if (typeof category !== 'string') return category ?? failure('category must not be empty.');
  if (!category) return failure('category must not be empty.');

  if (!existing && apps.length >= MAX_APP_ENTRIES) return failure(`The list already has ${MAX_APP_ENTRIES} apps.`);
  const categories = categoriesAfterReplacement(apps, existing);
  if (!categories.has(category) && categories.size >= MAX_CATEGORIES) return failure(`The list already has ${MAX_CATEGORIES} categories.`);

  const description = input.description === undefined ? existing?.description ?? '' : textField(input.description, 240, 'description');
  if (typeof description !== 'string') return description ?? failure('description must be a string.');
  const shortcode = input.shortcode === undefined ? undefined : textField(input.shortcode, 2, 'shortcode');
  if (typeof shortcode === 'object') return shortcode;
  const favorite = booleanField(input.favorite, 'favorite');
  if (typeof favorite !== 'boolean' && favorite !== undefined) return favorite;

  return {
    created: !existing,
    app: {
      id: existing?.id ?? globalThis.crypto.randomUUID(),
      name,
      url,
      category,
      sortOrder: existing?.sortOrder ?? apps.reduce((maximum, app) => Math.max(maximum, Number.isFinite(app.sortOrder) ? app.sortOrder : 0), 0) + 1,
      description,
      shortcode: shortcode
        ? shortcode.toLocaleUpperCase()
        : shortcode === '' || !existing?.shortcode
          ? appInitials(name)
          : existing.shortcode,
      favorite: favorite ?? existing?.favorite ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
  };
}

export function planFavorite(apps: readonly AppEntry[], input: Record<string, unknown>, now = Date.now()): { app: AppEntry; changed: boolean } | ToolError {
  const favorite = booleanField(input.favorite, 'favorite');
  if (typeof favorite !== 'boolean') return favorite ?? failure('favorite must be a boolean.');
  const app = resolveApp(apps, input);
  if (isToolError(app)) return app;
  if (app.favorite === favorite) return { app, changed: false };
  return { app: { ...app, favorite, updatedAt: now }, changed: true };
}

export function planImport(payload: unknown): { apps: AppEntry[] } | ToolError {
  try {
    return { apps: parseAppImport(payload) };
  } catch (error) {
    if (error instanceof AppDataError) {
      const message = importErrors[error.code];
      return failure(error.index === undefined ? message : `Record ${error.index + 1}: ${message}`);
    }
    return failure('The import payload is invalid.');
  }
}

const stringProperty = (description: string, maxLength?: number) => ({
  type: 'string',
  description,
  ...(maxLength ? { maxLength } : {}),
});

function savedResult(app: AppEntry, created: boolean) {
  return { status: 'saved', created, app: toPublicApp(app) };
}

async function persistApp(host: AppNavigationToolHost, app: AppEntry, notice: AppNotice, options?: ToolExecuteOptions): Promise<true | ToolError> {
  if (cancelled(options)) return failure(CANCELLED);
  try {
    return await host.persist(app, notice) ? true : failure(SAVE_FAILED);
  } catch {
    return failure(SAVE_FAILED);
  }
}

function confirmationResult(action: ConfirmationRequest['action'], extra: Record<string, unknown>) {
  return {
    status: 'confirmation-required',
    action,
    ...extra,
    message: 'A confirmation dialog is open. The saved list changes only after the user confirms it on the page.',
  };
}

export function createAppNavigationTools(host: AppNavigationToolHost): AppNavigationTool[] {
  return [
    {
      name: 'list_apps',
      description: 'Read the apps saved in this browser. Filters for query, category, and favorite combine, and omitted filters stay open. This leaves the visible directory unchanged.',
      inputSchema: {
        type: 'object',
        properties: {
          query: stringProperty('Case-insensitive text matched against name, URL, category, and description.', 200),
          category: stringProperty('Exact category name.', 40),
          favorite: { type: 'boolean', description: 'When true, return pinned apps. When false, return apps that are not pinned.' },
        },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true, consequentialHint: false },
      async execute(input) {
        const apps = host.apps();
        const listed = filterListedApps(apps, argumentsOf(input));
        if (isToolError(listed)) return listed;
        return { total: apps.length, matched: listed.length, categories: categoriesFromApps(apps), apps: listed };
      },
    },
    {
      name: 'show_apps',
      description: 'Change the directory visible on the page. Set query to search names, URLs, categories, and descriptions. Set category to an existing category, or to an empty string to show every category. Set sort to default, name, or category. A non-empty query searches every category.',
      inputSchema: {
        type: 'object',
        properties: {
          query: stringProperty('Search text. An empty string clears the search.', 200),
          category: stringProperty('Exact category name. An empty string shows every category.', 40),
          sort: { type: 'string', enum: [...SORTS], description: 'default keeps pinned apps first, then directory order.' },
        },
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true, consequentialHint: false },
      async execute(input, options) {
        if (cancelled(options)) return failure(CANCELLED);
        const state = planShowApps(host.apps(), host.view(), argumentsOf(input));
        if (isToolError(state)) return state;
        return { ...state, visible: host.applyView(state) };
      },
    },
    {
      name: 'save_app',
      description: 'Create or update one app saved in this browser and refresh the directory. Creating requires name, url, and category. Pass id to update that app; omitted fields stay unchanged. A hostname is stored as an https URL.',
      inputSchema: {
        type: 'object',
        properties: {
          id: stringProperty('Id of an existing app. Omit it to create an app.', 80),
          name: stringProperty('App name.', 80),
          url: stringProperty('http or https URL. A hostname is stored as https.', 2048),
          category: stringProperty('Category name.', 40),
          description: stringProperty('Short description.', 240),
          shortcode: stringProperty('Up to two characters shown on the avatar.', 2),
          favorite: { type: 'boolean', description: 'Whether the app is pinned.' },
        },
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true, consequentialHint: false },
      async execute(input, options) {
        const planned = planAppSave(host.apps(), argumentsOf(input));
        if (isToolError(planned)) return planned;
        const saved = await persistApp(host, planned.app, planned.created ? 'added' : 'updated', options);
        return saved === true ? savedResult(planned.app, planned.created) : saved;
      },
    },
    {
      name: 'set_favorite',
      description: 'Pin or unpin one app saved in this browser and refresh the directory. Pass the app id or its exact name, and set favorite to true or false.',
      inputSchema: {
        type: 'object',
        properties: {
          id: stringProperty('Id of the app to update.', 80),
          name: stringProperty('Exact name of the app to update.', 80),
          favorite: { type: 'boolean', description: 'True pins the app. False removes the pin.' },
        },
        required: ['favorite'],
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true, consequentialHint: false },
      async execute(input, options) {
        const planned = planFavorite(host.apps(), argumentsOf(input));
        if (isToolError(planned)) return planned;
        if (!planned.changed) return { status: 'unchanged', app: toPublicApp(planned.app) };
        const saved = await persistApp(host, planned.app, planned.app.favorite ? 'favorited' : 'unfavorited', options);
        return saved === true ? { status: 'updated', app: toPublicApp(planned.app) } : saved;
      },
    },
    {
      name: 'delete_app',
      description: 'Open the page confirmation dialog for deleting one saved app. Pass the app id or its exact name. The app remains until the user confirms in that dialog.',
      inputSchema: {
        type: 'object',
        properties: {
          id: stringProperty('Id of the app to delete.', 80),
          name: stringProperty('Exact name of the app to delete.', 80),
        },
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true, consequentialHint: true },
      async execute(input, options) {
        if (cancelled(options)) return failure(CANCELLED);
        const app = resolveApp(host.apps(), argumentsOf(input));
        if (isToolError(app)) return app;
        if (!host.requestConfirmation({ action: 'delete', app })) return failure(DIALOG_BUSY);
        return confirmationResult('delete', { app: toPublicApp(app) });
      },
    },
    {
      name: 'export_apps',
      description: 'Return the version 1 JSON backup of every app saved in this browser, including categories. This does not download a file.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true, consequentialHint: false },
      async execute() {
        return createAppExport(host.apps());
      },
    },
    {
      name: 'import_apps',
      description: 'Open the page confirmation dialog to replace every saved app with a version 1 export. Pass version, categories, and apps. The current list remains until the user confirms in that dialog.',
      inputSchema: {
        type: 'object',
        properties: {
          version: { type: 'number', description: 'Export version. Use 1.' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Every category used by apps.' },
          apps: {
            type: 'array',
            description: 'Apps to store. Each item needs name, url, and category.',
            items: { type: 'object' },
          },
        },
        required: ['version', 'categories', 'apps'],
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false, consequentialHint: true },
      async execute(input, options) {
        if (cancelled(options)) return failure(CANCELLED);
        const planned = planImport(input);
        if (isToolError(planned)) return planned;
        if (!host.requestConfirmation({ action: 'import', apps: planned.apps })) return failure(DIALOG_BUSY);
        return confirmationResult('import', { count: planned.apps.length });
      },
    },
    {
      name: 'clear_apps',
      description: 'Open the page confirmation dialog to remove every app saved in this browser. The list remains until the user confirms in that dialog.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: false, untrustedContentHint: false, consequentialHint: true },
      async execute(_input, options) {
        if (cancelled(options)) return failure(CANCELLED);
        if (!host.requestConfirmation({ action: 'clear' })) return failure(DIALOG_BUSY);
        return confirmationResult('clear', { count: host.apps().length });
      },
    },
  ];
}

function readModelContext(): ModelContextRegistration | undefined {
  if (typeof document === 'undefined') return undefined;
  const context = (document as Document & { modelContext?: { registerTool?: unknown } }).modelContext;
  if (!context || typeof context.registerTool !== 'function') return undefined;
  return context as ModelContextRegistration;
}

export async function registerAppNavigationTools(
  host: AppNavigationToolHost,
  signal: AbortSignal,
  context: ModelContextRegistration | null | undefined = readModelContext(),
): Promise<void> {
  if (!context || signal.aborted) return;
  await Promise.all(createAppNavigationTools(host).map(async (tool) => {
    if (signal.aborted) return;
    try {
      await context.registerTool(tool, { signal });
    } catch (error) {
      if (!signal.aborted) console.error(error);
    }
  }));
}
