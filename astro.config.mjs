import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import markdownMedia from './scripts/markdown-media.mjs';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kanelogger.com',
  trailingSlash: 'never',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
  markdown: {
    processor: satteri({ hastPlugins: [markdownMedia()] }),
    shikiConfig: { theme: 'github-light' },
  },
});
