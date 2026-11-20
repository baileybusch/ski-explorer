import { withEve } from 'eve/vercel';
import { vercelSpa } from './lib/vercelSpa.js';

/**
 * Compose the Vite SPA + existing /api functions with the eve agent service.
 * vercel.json cannot coexist with vercel.ts.
 *
 * withEve prepends /eve/v1/* to the generated agent service. The /api/*
 * serverless functions are built by the web service, so /api must route to web
 * (a plain-string destination or an /api exclusion leaves them unreachable: 404).
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
      functions: vercelSpa.functions,
      // Service-scoped: run after ingress picks `web`, so /api/observed ->
      // /api/headless?surface=observed etc. resolve to this service's functions.
      rewrites: vercelSpa.rewrites,
    },
  },
  // withEve prepends ^/eve/v1/(.*)$ -> eve. Everything else (SPA + /api/*
  // serverless functions, which live in the web service) goes to web.
  // Routing into a service is final, so /api must not be excluded here.
  routes: [
    { src: '^/(.*)$', destination: { type: 'service', service: 'web' } },
  ],
});
