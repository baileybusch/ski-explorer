import { MenuIcon } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND } from '@/lib/brand';

export type AppSection = 'home' | 'resorts';

/**
 * One app header for home, region view and the resorts page:
 * logo (home) · primary nav · account/settings menu pinned top-right.
 * Everything else (chat panel, lists) sits below it and never covers it.
 */
export function AppHeader({
  active, onHome, onResorts, onMenu, maxWidth = 1440, testid = 'app-header',
}: {
  active: AppSection;
  onHome: () => void;
  onResorts: () => void;
  onMenu: () => void;
  maxWidth?: number;
  testid?: string;
}) {
  const nav = (id: AppSection) =>
    `inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
      active === id
        ? 'bg-[var(--surface-raised)] text-foreground ring-1 ring-[var(--surface-line)]'
        : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
    }`;
  return (
    <header
      className="sticky top-0 z-30 w-full border-b border-[var(--surface-line)] bg-[var(--header-bg)] pt-[env(safe-area-inset-top)] backdrop-blur-md"
      data-testid={testid}
    >
      <div className="mx-auto flex h-14 w-full items-center gap-2 px-3 min-[840px]:h-16 min-[840px]:gap-4 min-[840px]:px-6" style={{ maxWidth }}>
        <button
          type="button"
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-full px-1 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`${BRAND.name} home`}
          data-testid="logo-home"
          onClick={onHome}
        >
          <BrandLogo size="header" />
        </button>
        <nav className="flex items-center gap-1" aria-label="Primary">
          <button
            type="button"
            className={nav('resorts')}
            aria-current={active === 'resorts' ? 'page' : undefined}
            data-testid="nav-resorts"
            onClick={onResorts}
          >
            Resorts
          </button>
        </nav>
        <span className="flex-1" />
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-full text-foreground outline-offset-2 ring-1 ring-[var(--surface-line)] transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Menu"
          data-testid="menu-button"
          onClick={onMenu}
        >
          <MenuIcon className="size-5" />
        </button>
      </div>
    </header>
  );
}
