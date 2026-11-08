import { CONSENT_TEXT } from '../../lib/consentText.js';
import { withAlerts } from '@/lib/alertsUi';

/**
 * One short signup line (ss-consent-4). Privacy and Do Not Sell are links; the Privacy Policy
 * page holds the full disclosure. `compact` is ignored — every capture point uses this line.
 */
export function ConsentNote({ className = '', testId = 'consent-note' }: { className?: string; testId?: string; compact?: boolean }) {
  return (
    <p className={`text-xs leading-snug text-muted-foreground ${className}`} data-testid={testId}>
      {CONSENT_TEXT}{' '}
      <a className="underline underline-offset-2 hover:text-foreground" href={withAlerts('/privacy')} target="_blank" rel="noreferrer">Privacy</a>
      {' · '}
      <a className="underline underline-offset-2 hover:text-foreground" href={withAlerts('/do-not-sell')} target="_blank" rel="noreferrer" data-testid="consent-dns-link">Do Not Sell</a>
    </p>
  );
}
