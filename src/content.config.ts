import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const text = z.string().trim().min(1);
const asset = z.string().regex(/^\/assets\/.+\.(webp|avif|png|jpe?g|svg)$/i);

const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog' }),
  schema: z.object({
    title: text,
    description: text,
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    category: text,
    tags: z.array(text).min(1),
    featured: z.boolean().default(false),
    featuredOrder: z.number().int().positive().optional(),
    order: z.number().int().nonnegative().default(0),
    cover: asset.optional(),
    author: text.default('Kane'),
  }).refine((data) => !data.featured || data.featuredOrder !== undefined, {
    message: '精选文章必须填写 featuredOrder', path: ['featuredOrder'],
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: text,
    description: text,
    cardDescription: text.optional(),
    year: z.number().int().min(2000).max(2100),
    role: text,
    tags: z.array(text).min(1),
    cover: asset,
    featured: z.boolean().default(false),
    order: z.number().int().positive(),
    github: z.url().optional(),
    release: z.url().optional(),
    designDoc: z.url().optional(),
  }),
});

export const collections = { blog, projects };
