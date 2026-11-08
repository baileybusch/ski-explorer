import { CONSENT_TEXT, DNS_LINK_TEXT } from '../../lib/consentText.js';
import { withAlerts } from '@/lib/alertsUi';

/**
 * Signup consent copy (versioned in lib/consentText.js) with the policy and CCPA opt-out links.
 * `compact` is for buttons that open the signup sheet; the full text shows wherever the email is entered.
 */
export function ConsentNote({ className = '', testId = 'consent-note', compact = false }: { className?: string; testId?: string; compact?: boolean }) {
  return (
    <p className={`leading-relaxed text-muted-foreground ${className}`} data-testid={testId}>
      {compact ? 'Free. Unsubscribe anytime. Signing up links your questions and browsing to your email.' : CONSENT_TEXT}{' '}
      <a className="underline underline-offset-2 hover:text-foreground" href={withAlerts('/privacy')} target="_blank" rel="noreferrer">Privacy Policy</a>
      {' · '}
      <a className="underline underline-offset-2 hover:text-foreground" href={withAlerts('/do-not-sell')} target="_blank" rel="noreferrer" data-testid="consent-dns-link">{DNS_LINK_TEXT}</a>
    </p>
  );
}
