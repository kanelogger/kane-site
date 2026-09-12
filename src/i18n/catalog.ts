import en from './en';
import zhCN from './zh-CN';

/** Locales that have a published route in the site. */
export const locales = ['zh-CN', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-CN';

export const dictionaries = {
  'zh-CN': zhCN,
  en,
} as const;

export type Dictionary = (typeof dictionaries)[Locale];
export type DictionaryKey = keyof Dictionary;

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale];
}
