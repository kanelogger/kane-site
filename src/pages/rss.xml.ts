import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { sortArticles } from '../lib/content';

export async function GET(context: APIContext) {
  const articles = (await getCollection('blog')).sort(sortArticles);
  return rss({
    title: 'KANE 的文章',
    description: site.description,
    site: context.site!,
    trailingSlash: false,
    items: articles.map(({ id, data }) => ({
      title: data.title,
      description: data.description,
      pubDate: data.publishedAt,
      link: `/writing/${id}`,
      categories: data.tags,
    })),
    customData: '<language>zh-CN</language>',
  });
}
