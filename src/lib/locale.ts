import {
  defaultLocale,
  getLocaleFromPath,
  getLocalePath,
  normalizeLocale,
  stripLocalePrefix,
  type Locale,
} from '../i18n/runtime';

export { defaultLocale, getLocaleFromPath, getLocalePath, normalizeLocale, stripLocalePrefix };
export type { Locale };

export type ContentRoute = 'writing' | 'work';
export type SiteRoute = ContentRoute | 'dashboard' | 'about' | 'rss' | 'home';

/** Build a stable URL for a localized site route. */
export function getLocalizedUrl(
  route: SiteRoute,
  slug?: string,
  locale: Locale = defaultLocale,
): string {
  const base = route === 'home'
    ? '/'
    : route === 'rss'
      ? '/rss.xml'
      : `/${route}`;
  const path = slug && (route === 'writing' || route === 'work')
    ? `${base}/${slug.replace(/^\/+|\/+$/g, '')}`
    : base;
  return getLocalePath(locale, path);
}

/** Point a language switcher at the same route in another locale. */
export function getAlternateLocaleUrl(pathname: string, targetLocale: Locale): string {
  const [path, suffix = ''] = pathname.split(/([?#].*)/, 2);
  return `${getLocalePath(targetLocale, path || '/')}${suffix}`;
}

export interface LocalizedEntry {
  data: {
    locale?: string;
    translationKey?: string;
  };
}

/** Filter a collection to entries intended for one locale. */
export function getLocalizedCollection<T extends LocalizedEntry>(entries: T[], locale: Locale): T[] {
  return entries.filter((entry) => normalizeLocale(entry.data.locale) === locale);
}

/** Find the translation paired with a source entry. */
export function getTranslation<T extends LocalizedEntry>(
  entries: T[],
  translationKey: string,
  locale: Locale,
): T | undefined {
  return getLocalizedCollection(entries, locale).find(
    (entry) => entry.data.translationKey === translationKey,
  );
}

/** Return locales for which a translation exists, in site locale order. */
export function getAvailableLocales<T extends LocalizedEntry>(
  entries: T[],
  translationKey: string,
): Locale[] {
  const available: Locale[] = [];
  for (const locale of ['zh-CN', 'en'] as const) {
    if (getTranslation(entries, translationKey, locale)) available.push(locale);
  }
  return available;
}
