import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

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

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreWorker()],
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
