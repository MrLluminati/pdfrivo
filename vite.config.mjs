import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const slugs = [
  'organize-pdf', 'merge-pdf', 'split-pdf', 'rotate-pdf', 'delete-pdf-pages',
  'number-pdf', 'watermark-pdf', 'images-to-pdf',
  'resize-image', 'compress-image', 'convert-image', 'crop-image'
];

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        home: resolve('index.html'),
        privacy: resolve('privacy/index.html'),
        ...Object.fromEntries(slugs.map(slug => [slug, resolve('tools', slug, 'index.html')]))
      }
    }
  }
});
