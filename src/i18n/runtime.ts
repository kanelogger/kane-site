import {
  defaultLocale,
  dictionaries,
  getDictionary,
  locales,
  type Dictionary,
  type Locale,
} from './catalog';

export { defaultLocale, dictionaries, getDictionary, locales };
export type { Dictionary, Locale };

const localeSet = new Set<string>(locales);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && localeSet.has(value);
}

/** Normalize browser and document language tags to the site's supported locales. */
export function normalizeLocale(value?: string | null): Locale {
  if (!value) return defaultLocale;
  if (value === 'en' || value.toLowerCase().startsWith('en-')) return 'en';
  return defaultLocale;
}

/** Resolve a locale from a pathname, ignoring query strings and hashes. */
export function getLocaleFromPath(pathname: string): Locale {
  const path = pathname.split(/[?#]/, 1)[0];
  return path === '/en' || path.startsWith('/en/') ? 'en' : defaultLocale;
}

/** Remove a locale prefix while retaining the root slash. */
export function stripLocalePrefix(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  if (path === '/en' || path.startsWith('/en/')) return path.slice(3) || '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/** Add the locale prefix used by this site to a route. */
export function getLocalePath(locale: Locale, route = '/'): string {
  const [path, suffix = ''] = route.split(/([?#].*)/, 2);
  const normalized = stripLocalePrefix(path || '/');
  const localized = locale === 'en'
    ? normalized === '/' ? '/en' : `/en${normalized}`
    : normalized;
  return `${localized}${suffix}`;
}

type DictionaryValue = string | ((...args: unknown[]) => string) | Record<string, unknown>;

/**
 * Read a dot-separated dictionary key. Missing keys throw during build so a
 * newly added UI string cannot silently ship as an untranslated key.
 */
export function t(locale: Locale, key: string, ...args: unknown[]): string {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, getDictionary(locale) as DictionaryValue);

  if (typeof value === 'function') return value(...args);
  if (typeof value === 'string') return value;
  throw new Error(`Missing i18n message: ${locale}.${key}`);
}
