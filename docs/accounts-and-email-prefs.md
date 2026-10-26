# Accounts and email preferences

There are **no user accounts and no passwords**. Everything is controlled by an email address plus a signed link.

Signup copy and Privacy copy share one consent string (`ss-consent-1` in `lib/consent.js`):

> By subscribing you agree to get storm alerts and recaps, which may include sponsored content. Unsubscribe anytime.

Do not add “we don’t sell your data” (or any selling-data language). Unsubscribe anytime is enough.

## Live vs preview

`EMAIL_ALERTS_ENABLED` stays `false`. Preview hosts and `?alerts=1` never send mail and never write Blob. Local preview uses `localStorage` (`ss_session`, `ss_account_prefs`, `ss_alert_rules`).

| | Live | Preview / localhost / `?alerts=1` |
|---|---|---|
| Sign up | Email a confirm link. Subscriber stays `pending` until click. | Device-only. Nothing emailed. |
| Manage | Email a 30-minute sign-in link. | **Dev: sign-in link** writes a local session. |
| Unsub from email | One-click `/api/unsubscribe?token=` scoped to that subscriber. | N/A |

## Sign up (double opt-in)

1. Enter email (home signup or Alert me). Consent line is shown under the field.
2. Server creates or updates a Blob row `subs/<32-hex>.json` with `status: pending` and a consent record.
3. A signed one-time `confirm` token is emailed (`ss1.…`, 7-day TTL, bound to that email, consumed once).
4. Only after the click is `status` set to `active` and `confirmed` stamped. Alerts and recaps start then.
5. Unconfirmed subscribers receive **nothing**. Pending rows older than ~7 days are expired (`lib/consent.js` `isPendingExpired`). `allActive()` never returns them.

HTTP responses are enumeration-safe: the same `{ ok, status: 'check-email', message }` whether or not the address already exists.

## Manage (preference center)

1. Menu → Manage account → enter email.
2. Live path emails a signed one-time `signin` token (30 minutes). The link opens `/manage?token=` and is exchanged for an `ss_sess` cookie:
   `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (~30 days).
3. Preference reads and writes require that session cookie (or a freshly consumed one-time token). CSRF: mutating POSTs check `Origin` / `Referer` against `Host`.
4. Every alert / recap email also carries a one-click unsubscribe URL scoped to that subscriber only. It turns storms, recap, and sponsor off and sets `status: unsubscribed`. It does not delete the record.

Rate limits on request-link and signup: 5 / email / 15 min and 20 / IP / 15 min (`lib/authLimit.js`).

## Preference sections

- Email (address + status)
- Storm alerts on/off + my alerts (edit / pause / delete through the alert flow)
- Optional Alert sensitivity (Standard / Big storms only / Every storm). Default Standard = 6″ / 72h. Not required at signup.
- Weekly recap on/off + day
- Sponsored content on/off (default off)
- Quiet hours
- Units
- Unsubscribe from all
- Delete my data (confirm step)

## Consent record

Stored on the subscriber:

```json
{
  "at": "2026-10-26T12:00:00.000Z",
  "source": "signup",
  "version": "ss-consent-1",
  "ipHash": "hex-16-bytes"
}
```

`source` is the page that collected the email (`signup`, `resort`, `menu`, …). `ipHash` is SHA-256 of `secret|ip`, not the raw IP. Keep `CONSENT_VERSION` / `CONSENT_TEXT` in lockstep when Privacy or signup copy changes.

## Tokens

| | |
|---|---|
| Format | `ss1.<base64url(json)>.<base64url(hmac-sha256)>` |
| Payload | `{ v: 1, e: email, p: purpose, exp, j?: jti }` |
| Purposes | `signin` (30m, one-time), `confirm` (7d, one-time), `manage` (7d, one-time), `session` (30d, cookie), `unsub` (1y) |
| Key | `AUTH_TOKEN_SECRET` (live). `CRON_SECRET` is a fallback. Never commit it. |
| Replay | One-time purposes carry a `jti`. `consumeJti` rejects reuse. |

Implementation: `lib/authToken.js`, `lib/consent.js`, `lib/authLimit.js`. Evals: `evals/authToken.mjs`.

The Blob row `subs/<32-hex>.json` is the durable subscriber id for one-click unsubscribe and cron. Magic links do not replace that id.

## Threat model

| Threat | Control |
|---|---|
| Enumerate who is on the list | Signup and manage-request always return the same check-email payload. |
| Token replay | HMAC + expiry + one-time `jti` on sign-in / confirm / manage. |
| CSRF on writes | Session cookie is `SameSite=Lax`. POSTs also check Origin/Referer. |
| Brute-force / inbox flooding | 5/email/15m and 20/IP/15m. |
| Read or change someone else’s prefs | No prefs without a valid session or a consumed per-email token. |
| Unconfirmed spam | Pending never receive mail; expire after 7 days. |
| Token in a forwarded email | 30-minute sign-in TTL; consumed on first use. |

## Live vs this repo

Sending stays off until a domain, Resend verification, and `EMAIL_ALERTS_ENABLED=true`. See [alerts-and-paid-watches.md](alerts-and-paid-watches.md).
