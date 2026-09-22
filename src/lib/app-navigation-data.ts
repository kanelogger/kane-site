export const APP_DATA_VERSION = 1;
export const MAX_APP_ENTRIES = 1000;
export const MAX_CATEGORIES = 100;

export interface AppEntry {
  id: string;
  name: string;
  url: string;
  category: string;
  sortOrder: number;
  description: string;
  shortcode: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppExportPayload {
  version: typeof APP_DATA_VERSION;
  exportedAt: string;
  categories: string[];
  apps: AppEntry[];
}

export type AppDataErrorCode =
  | 'invalid-payload'
  | 'unsupported-version'
  | 'categories-required'
  | 'too-many-categories'
  | 'invalid-category'
  | 'duplicate-category'
  | 'apps-required'
  | 'too-many-apps'
  | 'invalid-app'
  | 'missing-name'
  | 'invalid-url'
  | 'missing-category'
  | 'unknown-category';

export class AppDataError extends Error {
  code: AppDataErrorCode;
  index?: number;

  constructor(code: AppDataErrorCode, index?: number) {
    super(code);
    this.name = 'AppDataError';
    this.code = code;
    this.index = index;
  }
}

const cleanText = (value: unknown, maximum: number) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `app-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function normalizeAppUrl(value: unknown): string {
  const raw = cleanText(value, 2048);
  if (!raw) throw new AppDataError('invalid-url');
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AppDataError('invalid-url');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new AppDataError('invalid-url');
  return url.href;
}

export function appInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const value = parts.length > 1 ? parts.map((part) => part[0]).join('') : name.slice(0, 2);
  return value.toLocaleUpperCase().slice(0, 2);
}

export function categoriesFromApps(apps: readonly AppEntry[]): string[] {
  return [...new Set(sortApps(apps).map((app) => app.category))];
}

export function sortApps(apps: readonly AppEntry[]): AppEntry[] {
  return [...apps].sort((a, b) => Number(b.favorite) - Number(a.favorite)
    || a.sortOrder - b.sortOrder
    || a.name.localeCompare(b.name, 'zh-CN'));
}

export function createAppExport(apps: readonly AppEntry[], exportedAt = new Date()): AppExportPayload {
  return {
    version: APP_DATA_VERSION,
    exportedAt: exportedAt.toISOString(),
    categories: categoriesFromApps(apps),
    apps: sortApps(apps),
  };
}

export function parseAppImport(payload: unknown, now = Date.now()): AppEntry[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AppDataError('invalid-payload');
  const record = payload as Record<string, unknown>;
  if (record.version !== APP_DATA_VERSION) throw new AppDataError('unsupported-version');
  if (!Array.isArray(record.categories)) throw new AppDataError('categories-required');
  if (record.categories.length > MAX_CATEGORIES) throw new AppDataError('too-many-categories');

  const categories = record.categories.map((value) => cleanText(value, 40));
  if (categories.some((category) => !category)) throw new AppDataError('invalid-category');
  if (new Set(categories).size !== categories.length) throw new AppDataError('duplicate-category');
  const categorySet = new Set(categories);

  if (!Array.isArray(record.apps)) throw new AppDataError('apps-required');
  if (record.apps.length > MAX_APP_ENTRIES) throw new AppDataError('too-many-apps');
  const identifiers = new Set<string>();

  return record.apps.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppDataError('invalid-app', index);
    const source = value as Record<string, unknown>;
    const name = cleanText(source.name, 80);
    if (!name) throw new AppDataError('missing-name', index);
    let url: string;
    try {
      url = normalizeAppUrl(source.url);
    } catch {
      throw new AppDataError('invalid-url', index);
    }
    const category = cleanText(source.category, 40);
    if (!category) throw new AppDataError('missing-category', index);
    if (!categorySet.has(category)) throw new AppDataError('unknown-category', index);

    const importedId = cleanText(source.id, 80);
    let id = /^[a-z\d][\w-]{0,79}$/i.test(importedId) ? importedId : makeId();
    while (identifiers.has(id)) id = makeId();
    identifiers.add(id);
    const createdAt = typeof source.createdAt === 'number' && Number.isFinite(source.createdAt) ? source.createdAt : now + index;
    const sortOrder = typeof source.sortOrder === 'number' && Number.isFinite(source.sortOrder) ? source.sortOrder : now + index;

    return {
      id,
      name,
      url,
      category,
      sortOrder,
      description: cleanText(source.description, 240),
      shortcode: cleanText(source.shortcode, 2).toLocaleUpperCase() || appInitials(name),
      favorite: source.favorite === true,
      createdAt,
      updatedAt: now + index,
    };
  });
}
