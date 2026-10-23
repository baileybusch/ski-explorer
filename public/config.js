// Feature flags shared by the browser (public/app.js, public/alerts.html) and the API (api/*).
// Email alerts are PAUSED: signup UI is hidden, /api/subscribe refuses, and /api/cron/digest is a no-op.
// Subscriber data in Vercel Blob and the Resend env vars are intentionally left in place.
// To resume: set this to true, and re-add the cron to vercel.json:
//   "crons": [{ "path": "/api/cron/digest", "schedule": "30 13 * * *" }]
export const EMAIL_ALERTS_ENABLED = false;
