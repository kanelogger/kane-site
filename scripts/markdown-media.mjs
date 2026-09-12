import { readFileSync } from 'node:fs';
import { imageSize } from 'image-size';

// Keep public Markdown images stable while they load, and expose wide content
// to keyboard users without adding client-side rendering to article bodies.
export default function markdownMedia() {
  return {
    name: 'local-media-and-scroll-regions',
    element: {
      filter: ['img', 'pre', 'table'],
      visit(node, context) {
        if (node.tagName === 'img') {
          const src = node.properties?.src;
          if (typeof src !== 'string' || !src.startsWith('/assets/')) return;
          const file = new URL(`../public${decodeURI(src)}`, import.meta.url);
          const { width, height } = imageSize(readFileSync(file));
          context.setProperty(node, 'width', width);
          context.setProperty(node, 'height', height);
          context.setProperty(node, 'loading', 'lazy');
          context.setProperty(node, 'decoding', 'async');
        } else {
          if (node.properties?.tabindex === undefined && node.properties?.tabIndex === undefined) {
            context.setProperty(node, 'tabIndex', 0);
          }
          context.setProperty(node, 'aria-label', node.tagName === 'pre'
            ? 'Scrollable code block / 代码，可横向滚动'
            : 'Scrollable table / 表格，可横向滚动');
        }
      },
    },
  };
}
