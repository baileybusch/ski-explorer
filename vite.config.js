import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { DEFAULT_BRAND } from './lib/brand.js';
import { devApi } from './scripts/vite-dev-api.js';

/** Serve MapLibre's ES worker at a stable same-origin URL (dev + dist). */
function maplibreWorker() {
  const workerPath = fileURLToPath(new URL('./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url));
  const source = readFileSync(workerPath);
  return {
    name: 'maplibre-worker',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/maplibre-gl-worker.mjs') {
          res.setHeader('Content-Type', 'text/javascript');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(source);
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'maplibre-gl-worker.mjs', source });
    },
  };
}

/** index.html ships the default brand; ?brand= mockups swap title + favicon at runtime (src/lib/brand.ts). */
function brandHtml() {
  return {
    name: 'brand-html',
    transformIndexHtml: html => html
      .replaceAll('%BRAND_TITLE%', DEFAULT_BRAND.title)
      .replaceAll('%BRAND_FAVICON%', DEFAULT_BRAND.favicon),
  };
}

/** Static HTML + OG card per category page (scripts/og.js). Build only; dev renders cards on demand. */
function categoryPages() {
  let outDir = 'dist';
  return {
    name: 'category-pages',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    async closeBundle() {
      const { ogPages, renderOgPng, categoryHtml, ogImagePath, sitemapXml } = await import('./scripts/og.js');
      const { SITE } = await import('./lib/site.js');
      const index = readFileSync(`${outDir}/index.html`, 'utf8');
      mkdirSync(`${outDir}/og`, { recursive: true });
      for (const kind of ['region', 'pass', 'resort']) mkdirSync(`${outDir}/${kind}`, { recursive: true });
      const pages = ogPages();
      for (const page of pages) {
        writeFileSync(`${outDir}/${page.kind}/${page.id}.html`, categoryHtml(index, page, SITE));
        writeFileSync(`${outDir}${ogImagePath(page.kind, page.id)}`, await renderOgPng(page));
      }
      writeFileSync(`${outDir}/sitemap.xml`, sitemapXml(pages, SITE));
      console.log(`category pages: ${pages.length} html + og cards + sitemap`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreWorker(), brandHtml(), devApi(), categoryPages()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 4173 },
  preview: { port: 4174 },
  worker: { format: 'es' },
  optimizeDeps: { include: ['maplibre-gl'] },
});
