import { LogoMark } from '@/components/LogoMark';
import { withAlerts } from '@/lib/alertsUi';

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/disclosure', label: 'Affiliate disclosure' },
  { href: '/contact', label: 'Contact' },
];

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-10 w-full max-w-xl px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]" data-testid="site-footer">
      <a href={withAlerts('/')} className="flex items-center gap-2" aria-label="SkiScope home">
        <LogoMark className="size-6" />
        <span className="font-display text-lg tracking-wide">SKISCOPE</span>
      </a>
      <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {LINKS.map(l => (
          <a key={l.href} href={withAlerts(l.href)} className="text-muted-foreground underline-offset-4 hover:underline">
            {l.label}
          </a>
        ))}
      </nav>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Snow: Open-Meteo (modeled). Runs and lifts: OpenSkiMap contributors. Radar: RainViewer.
      </p>
    </footer>
  );
}
