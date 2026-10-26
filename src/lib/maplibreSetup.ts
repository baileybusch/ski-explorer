/**
 * MapLibre v6 looks for maplibre-gl-worker.mjs next to the main bundle.
 * Vite folds maplibre-gl into index-*.js, so that sibling 404s and the
 * globe stays black ("Worker failed to load"). Point it at a file we emit.
 */
import { setWorkerUrl } from 'maplibre-gl';

const base = import.meta.env.BASE_URL || '/';
setWorkerUrl(`${base}maplibre-gl-worker.mjs`);
