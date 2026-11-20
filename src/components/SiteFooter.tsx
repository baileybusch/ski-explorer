import { withAlerts } from '@/lib/alertsUi';
import { BRAND } from '@/lib/brand';
import { affiliateConfigured } from '../../public/config.js';
import { DNS_LINK_TEXT } from '../../lib/consentText.js';

/** Legal / minimal links only. Region links live in "Browse by region" on the home page. */
const LINKS = [
  { href: '/privacy', label: 'Privacy', testid: 'footer-privacy' },
  { href: '/terms', label: 'Terms', testid: 'footer-terms' },
  { href: '/manage', label: 'Unsubscribe', testid: 'footer-unsubscribe' },
  { href: '/about', label: 'Data sources & credits', testid: 'footer-credits' },
];

export function SiteFooter() {
  return (
    <footer
      className="mx-auto mt-10 w-full max-w-[840px] border-t border-foreground/8 px-3 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] min-[880px]:px-0.5"
      data-testid="site-footer"
    >
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Legal">
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        {LINKS.map(l => (
          <a key={l.href} href={withAlerts(l.href)} className="underline-offset-4 hover:text-foreground hover:underline" data-testid={l.testid}>
            {l.label}
          </a>
        ))}
        {affiliateConfigured() ? (
          <a href={withAlerts('/disclosure')} className="underline-offset-4 hover:text-foreground hover:underline" data-testid="footer-disclosure">
            Affiliate disclosure
          </a>
        ) : null}
        <a href={withAlerts('/do-not-sell')} className="underline-offset-4 hover:text-foreground hover:underline" data-testid="footer-dns">
          {DNS_LINK_TEXT}
        </a>
      </nav>
    </footer>
  );
}
