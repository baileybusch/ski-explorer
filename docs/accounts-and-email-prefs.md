# Accounts and email preferences

Passwordless. Signing in is a one-time link, not a password.

## Token

| | |
|---|---|
| Format | `ss1.<base64url(json)>.<base64url(hmac-sha256)>` |
| Payload | `{ v: 1, e: email, p: 'signin' \| 'manage', exp: unixSeconds }` |
| Key | `AUTH_TOKEN_SECRET` (live). `CRON_SECRET` is a fallback. Never commit it. |
| Sign-in TTL | 30 minutes |
| Manage-from-email TTL | 7 days |
| Storage | Tokens are not stored. Verify HMAC + expiry, then look up the subscriber by email. |

Implementation: `lib/authToken.js`. Evals: `evals/authToken.mjs`.

The Blob row `subs/<32-hex>.json` is still the durable subscriber id for unsubscribe and the cron. Magic links do not replace that id.

## Live vs preview

| | Live (`EMAIL_ALERTS_ENABLED`) | Preview / localhost / `?alerts=1` |
|---|---|---|
| Request link | `POST /api/auth?action=request` sends the email | Returns `{ preview: true }`. Nothing is emailed. |
| Sign-in | Open `/manage?token=ss1...` | **Dev: sign-in link** writes `ss_session` in localStorage |
| Prefs / rules | Blob `subs/<token>.json` | `ss_account_prefs` + `ss_alert_rules` |

## Manage page (`/manage`)

- Email
- Storm alerts / weekly recap / sponsor content toggles
- Recap day (stored; cron still fires Sunday until live sending is on)
- My alerts (same list + onboarding as the hamburger)
- Unsubscribe from everything
- Delete my data

Hamburger **Manage account** opens `/manage`. **My alerts** opens `/manage#alerts`.

## Subscriber prefs (Blob + local)

```json
{ "stormAlerts": true, "recap": true, "sponsor": false, "recapDay": "sun" }
```

`sponsor` defaults **off**.
