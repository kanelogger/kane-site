import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import markdownMedia from './scripts/markdown-media.mjs';
import sitemap from '@astrojs/sitemap';
import sceneManifest from './scripts/scene-manifest.mjs';

export default defineConfig({
  site: 'https://kanelogger.com',
  trailingSlash: 'never',
  i18n: {
    locales: ['zh-CN', 'en'],
    defaultLocale: 'zh-CN',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [sitemap({
    filter: (page) => !['/en/404', '/404'].includes(new URL(page).pathname),
  })],
  vite: { plugins: [tailwindcss(), sceneManifest()] },
  markdown: {
    processor: satteri({ hastPlugins: [markdownMedia()] }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false },
  },
});
