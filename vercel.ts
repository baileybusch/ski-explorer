import { withEve } from 'eve/vercel';
import { vercelSpa } from './lib/vercelSpa.js';

/**
 * Compose the Vite SPA + existing /api functions with the eve agent service.
 * vercel.json cannot coexist with vercel.ts.
 *
 * withEve prepends /eve/v1/* to the generated agent service. Do not catch-all
 * /api onto the Vite web service — existing serverless functions stay there.
 *
 * Hobby note: eve deploys as a Vercel Service (Workflow + Schedules), not as
 * another of the 12 serverless functions. Preview from this PR is the test;
 * Workflow/Sandbox/Services may require Pro.
 */
const apiRoutes = (vercelSpa.rewrites || [])
  .filter(r => String(r.source).startsWith('/api/'))
  .map(r => ({
    src: `^${escapeSrc(r.source)}$`,
    destination: r.destination,
  }));

function escapeSrc(source) {
  return String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default await withEve({
  ...vercelSpa,
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  framework: 'vite',
  services: {
    web: {
      framework: 'vite',
      root: '.',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
    },
  },
  routes: [
    ...apiRoutes,
    { src: '^(?!/api(?:/|$))(.*)$', destination: { type: 'service', service: 'web' } },
  ],
});
