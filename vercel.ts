import { withEve } from 'eve/vercel';
import { vercelSpa } from './lib/vercelSpa.js';

/**
 * Compose the Vite SPA + existing /api functions with the eve agent service.
 * vercel.json cannot coexist with vercel.ts.
 *
 * withEve prepends /eve/v1/* to the generated agent service. With services
 * configured, Vercel does not build the zero-config api/ directory, so the
 * handlers ship as the `api` service (api/index.js dispatches by path).
 *
 * Vercel Services cannot mix top-level `framework` / `buildCommand` /
 * `outputDirectory` / `functions` with `services` (SERVICES_AND_TOP_LEVEL_BUILD_SETTINGS).
 * Those belong on `services.web`.
 *
 * Hobby note: eve deploys as a Vercel Service (Workflow + Schedules), not as
 * another of the 12 serverless functions. Preview from this PR is the test;
 * Workflow/Sandbox/Services may require Pro.
 */
export default await withEve({
  cleanUrls: vercelSpa.cleanUrls,
  headers: vercelSpa.headers,
  crons: vercelSpa.crons,
  services: {
    web: {
      framework: 'vite',
      root: '.',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      // SPA deep-link rewrites only; /api/* belongs to the `api` service.
      rewrites: (vercelSpa.rewrites || []).filter(r => !String(r.source).startsWith('/api')),
    },
    // With services configured Vercel skips the zero-config api/ directory, so
    // the existing handlers ship as one function that dispatches by path.
    api: {
      root: '.',
      entrypoint: 'api/index.js',
      functions: {
        'api/index.js': { includeFiles: 'public/data/**', maxDuration: 300 },
      },
    },
  },
  // withEve prepends ^/eve/v1/(.*)$ -> eve. /api/* -> api service; the rest
  // (SPA) -> web. Routing into a service is final, so order matters.
  routes: [
    { src: '^/api(?:/.*)?$', destination: { type: 'service', service: 'api' } },
    { src: '^/(.*)$', destination: { type: 'service', service: 'web' } },
  ],
});
