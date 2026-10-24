// Feature flags shared by the browser (public/app.js, public/alerts.html) and the API (api/*).
// Email alerts are PAUSED: signup UI is hidden, /api/subscribe refuses, and /api/cron/digest is a no-op.
// Subscriber data in Vercel Blob and the Resend env vars are intentionally left in place.
// To resume: set this to true, and re-add the cron to vercel.json:
//   "crons": [{ "path": "/api/cron/digest", "schedule": "30 13 * * *" }]
// Future snow emails (not built): threshold alerts like "Mammoth 12in+ / forecast 18in+ in 3 days"
// should deep-link here with /?resort=mammoth&from=...&to=...&adults=2&kids=2&mode=explore|plan
export const EMAIL_ALERTS_ENABLED = false;

// Affiliate wrap for outbound booking links. Leave empty — no wrap, no disclosure.
// Each value is either a query suffix ("aid=12345") appended to the destination URL,
// or a template containing {url} / {href} (URL-encoded destination).
// Do not commit secrets. Public affiliate ids are fine. See README "Affiliate programs".
export const AFFILIATES = {
  googleflights: '',
  kayak: '',
  skyscanner: '',
  booking: '',
  airbnb: '',
  vrbo: '',
  expedia: '',
  travelpayouts: '',
};

export function affiliateConfigured() {
  return Object.values(AFFILIATES).some(v => v && String(v).trim());
}
