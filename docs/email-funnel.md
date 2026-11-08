# Email funnel

Audit of what already existed, what this pass added, and the Hobby budget. Sending stays **off** (`EMAIL_ALERTS_ENABLED = false`). Test sends, if any, go only to `baileybusch@gmail.com`.

## Audit (what was already there)

| Piece | Where | Gap before this pass |
|---|---|---|
| Alert me 6-step onboarding | `src/components/AlertOnboarding.tsx` | Home + resort only. No region/pass/chat capture. |
| Link sign-in, double opt-in, prefs | `api/auth.js`, `api/subscribe.js`, `api/confirm.js`, `/manage` | No `/my-alerts` focus, no Do Not Sell, no welcome send on confirm. |
| Consent records | `lib/consent.js` + `ss-consent-1` | Copy did not disclose Ask/browsing linkage. |
| Alerts v2 (resort / region / trip) | `lib/evaluateAlerts.js`, cron | No welcome series; sponsor slot was hardcoded "Example sponsor". |
| Email templates + preview | `lib/emails.js`, `/api/email/preview` | No W1–W3, no index of all templates. |
| Subscriber store | private Vercel Blob `subs/` + `emails/` | No insights events. |
| 12 serverless functions | `api/*.js` (underscore files are not functions) | Cap already hit — fold new surfaces into existing handlers. |

## What shipped

1. **Capture points**, each preset to context
   - Home and resort Alert me (kept).
   - Shareable `/region/<id>`, `/pass/<id>`, `/resort/<id>` with their own title, description, canonical, JSON-LD, OG card, sitemap entry. CTA "Get alerts for California" (etc.).
   - Ask: policy-appended `offerAlertSignup` card after interest (specific resort/region, a month, or 2+ questions). Once per session unless asked; dismissible.
2. **Accounts** — email is the account. `/my-alerts` syncs rules when live. Anonymous `ss_sid` is linked on signup/sign-in.
3. **Welcome series** — W1 at confirm, W2 day 2, W3 day 5 (`lib/welcome.js` + `lib/welcomeSend.js`). Gated by `canSendEmail`. Preview index: `/api/email/preview?type=index`.
4. **Insights** — chat, signup, link, dns, offer, unsubscribe events in Blob `insights/<env>/` (batched; Hobby list/put budget). `/admin` is password-protected (`ADMIN_PASSWORD`, never in the repo). Demo toggle seeds labeled `demo+N@example.com` data.
5. **Privacy (draft, pending lawyer review)** — Ask questions and browsing interests are linked to the email on signup, used for alerts and personalization. **We do not sell or share individual emails, questions, or profiles.** Sponsors, when they exist, see aggregate counts and a labeled slot in emails we already send. CCPA Do Not Sell page + account switch.

## Amendment (this pass)

- **No selling individual data.** Consent `ss-consent-3`. Partner CSV of emails is gone. Aggregates CSV is counts only.
- **Aggregate-first admin.** Charts and tops are the default view. Individual profiles sit under an "internal only" disclosure. Demo data is labeled.
- **JSON sponsor slot.** `public/data/sponsor.json` drives the labeled Sponsored block on automated alerts and recaps (`lib/sponsor.js`). Off until `on: true` and the subscriber left sponsor content on.
- **Share / referral.** `?ref=` on board URLs (visitor id, never an email). Signup events record `ref`. W3 and post-signup share use it. Admin KPI "From a share".
- **SEO.** Static HTML + OG + JSON-LD + `sitemap.xml` + `robots.txt` for every region, pass, and resort.

## Hobby budget

Still **12 functions**. New HTTP surfaces are rewrites, not files:

| URL | Handler |
|---|---|
| `/api/events` | `api/headless.js?surface=events` |
| `/api/ask` | `api/headless.js?surface=ask` (unchanged) |
| `/api/admin` | `api/admin/render.js?surface=dashboard` |
| `/api/email/preview` | existing |
| `/region/:id`, `/pass/:id`, `/resort/:id` | static HTML in `dist/` (0 invocations); SPA rewrite fallback |

Blob: events batch in memory and flush with `waitUntil`. Finished days compact to one object. Stay inside Hobby advanced-op limits.

## Env (Vercel, never in the repo)

- `ADMIN_PASSWORD` — `/admin` login. Required in production for the dashboard.
- Existing: `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `AUTH_SECRET`.
- `EMAIL_ALERTS_ENABLED` stays false in `public/config.js`.

Local `/admin`: the Vite plugin writes a random password to gitignored `tmp/.admin-dev-password` when the env var is unset.
