import type { Locale } from '../i18n/runtime';

export interface MediaVariant {
  src: string;
  alt: string;
  caption?: string;
}

/** Optional locale-specific image replacements. Missing variants fall back to the source image. */
export const mediaVariants: Record<string, Partial<Record<Locale, MediaVariant>>> = {};

export function getMediaVariant(src: string, locale: Locale): MediaVariant | undefined {
  return mediaVariants[src]?.[locale];
}
