import { useEffect, type ReactNode } from 'react';
import { MessageCircleIcon, XIcon } from 'lucide-react';

/**
 * One chat instance, two presentations:
 * - wide: a docked side panel (its own tinted surface) next to the list, under the header.
 * - narrow: hidden until the sticky "Ask SkiScope…" bar opens it as a sheet that starts
 *   below the app header, so the header and account menu stay reachable.
 */
export function ChatDock({
  wide, open, onOpenChange, title, subtitle, barLabel, children, className = '',
  testid, barTestid, closeTestid,
}: {
  wide: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  barLabel: string;
  children: ReactNode;
  /** Desktop sizing/positioning for the docked panel. */
  className?: string;
  testid: string;
  barTestid: string;
  closeTestid: string;
}) {
  const sheet = !wide && open;

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Let an open modal (account menu, alert flow) take Escape first.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      onOpenChange(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey, true); };
  }, [sheet, onOpenChange]);

  return (
    <>
      <aside
        className={wide
          ? `chat-surface flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] ${className}`
          : sheet
            ? 'chat-surface fixed inset-x-0 bottom-0 top-[calc(var(--app-header-h)+env(safe-area-inset-top)+0.5rem)] z-20 flex flex-col overflow-hidden rounded-t-[var(--radius-card)] border-b-0'
            : 'hidden'}
        data-testid={testid}
        data-open={wide || sheet ? '1' : '0'}
        data-presentation={wide ? 'docked' : 'sheet'}
        aria-label={title}
      >
        <div className="flex items-center gap-2 border-b border-[var(--chat-panel-line)] px-4 py-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ice)]/15 text-[var(--ice)]" aria-hidden>
            <MessageCircleIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold leading-tight" data-testid={`${testid}-title`}>{title}</h2>
            {subtitle ? <p className="truncate text-xs leading-tight text-muted-foreground">{subtitle}</p> : null}
          </div>
          {!wide ? (
            <button
              type="button"
              className="grid size-11 place-items-center rounded-full hover:bg-foreground/[0.06]"
              aria-label="Close chat"
              data-testid={closeTestid}
              onClick={() => onOpenChange(false)}
            >
              <XIcon className="size-5" />
            </button>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </aside>

      {!wide && !open ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="pointer-events-auto flex min-h-12 w-full items-center gap-2.5 rounded-2xl bg-[var(--chat-input)] px-4 text-left text-[15px] text-foreground/85 shadow-[0_10px_28px_-12px_rgb(0_0_0/0.7)] ring-1 ring-[var(--chat-panel-line)]"
            data-testid={barTestid}
            onClick={() => onOpenChange(true)}
          >
            <MessageCircleIcon className="size-4 shrink-0 text-[var(--ice)]" />
            <span className="truncate">{barLabel}</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
