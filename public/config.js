// Feature flags shared by the browser (alerts.html) and the API (api/*).
// Email alerts are PAUSED: production signup is hidden, /api/subscribe refuses real writes,
// and cron handlers no-op. Evaluator + templates are implemented.
// Preview deployments may reveal the flow with ?alerts=1 (writes nothing, sends nothing).
// To turn on real sends: verify a Resend domain, set RESEND_FROM, then flip this to true.
// Cron is wired in vercel.json (/api/cron/alerts daily) but stays a no-op while this is false.
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
