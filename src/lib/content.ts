import type { CollectionEntry } from 'astro:content';

export function sortArticles(a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) {
  return b.data.publishedAt.getTime() - a.data.publishedAt.getTime()
    || a.data.order - b.data.order || a.id.localeCompare(b.id);
}

export const formatDate = (date: Date) => date.toISOString().slice(0, 10).replaceAll('-', '.');

export function readingMinutes(body = '') {
  const text = body.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (text.match(/[a-zA-Z0-9]+/g) || []).length;
  return Math.max(1, Math.ceil(chinese / 350 + words / 220));
}
