import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { siteByLocale } from '../../data/site';
import { sortArticles } from '../../lib/content';

export async function GET(context: APIContext) {
  const articles = (await getCollection('blog', ({ data }) => data.locale === 'en' && data.translationStatus !== 'summary')).sort(sortArticles);
  return rss({
    title: 'KANE Writing',
    description: siteByLocale.en.description,
    site: context.site!,
    trailingSlash: false,
    items: articles.map(({ data }) => ({
      title: data.title,
      description: data.description,
      pubDate: data.publishedAt,
      link: `/en/writing/${data.slug}`,
      categories: data.tags,
    })),
    customData: '<language>en</language>',
  });
}
