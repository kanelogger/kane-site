/**
 * Backwards-compatible import surface for components that predate the split
 * i18n modules. Keep all locale behavior in src/i18n/runtime.ts so missing
 * dictionary keys fail during the build instead of silently rendering keys.
 */
export {
  defaultLocale,
  dictionaries,
  getDictionary,
  getLocaleFromPath,
  getLocalePath,
  isLocale,
  normalizeLocale,
  stripLocalePrefix,
  t,
} from '../i18n/runtime';
export type { Dictionary, Locale } from '../i18n/runtime';

export function getAlternateLocale(locale: import('../i18n/runtime').Locale) {
  return locale === 'en' ? 'zh-CN' as const : 'en' as const;
}
