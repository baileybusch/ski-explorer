import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { MessageCircleIcon, SnowflakeIcon, XIcon } from 'lucide-react';

/** Chat reports what it is doing ("Checking the snow…"); the dock header shows it like Muse's status line. */
export const ChatStatusCtx = createContext<((status: string | null) => void) | null>(null);

/** SkiScope's chat avatar: the snowflake in an iOS-blue circle. */
export function ChatAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#3a9bff] to-[var(--ice-strong)] text-white ${size === 'sm' ? 'size-7' : 'size-10'}`}
      aria-hidden
    >
      <SnowflakeIcon className={size === 'sm' ? 'size-4' : 'size-5'} strokeWidth={2.25} />
    </span>
  );
}

/**
 * One chat instance, two presentations:
 * - wide: a docked side panel (its own black chat surface) next to the list, under the header.
 * - narrow: hidden until the sticky "Ask SkiScope…" bar opens it as a sheet that starts
 *   below the app header, so the header and account menu stay reachable.
 * Header (Muse-style): avatar, bold name, live status line on a frosted pill.
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
  const [status, setStatusState] = useState<string | null>(null);
  const setStatus = useCallback((s: string | null) => setStatusState(s), []);

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
          ? `chat-surface flex min-h-0 flex-col overflow-hidden rounded-[24px] ${className}`
          : sheet
            ? 'chat-surface fixed inset-x-0 bottom-0 top-[calc(var(--app-header-h)+env(safe-area-inset-top)+0.5rem)] z-20 flex flex-col overflow-hidden rounded-t-[24px]'
            : 'hidden'}
        data-testid={testid}
        data-open={wide || sheet ? '1' : '0'}
        data-presentation={wide ? 'docked' : 'sheet'}
        aria-label={title}
      >
        <div className="relative flex flex-col items-center gap-1 px-14 pt-3 pb-2.5">
          <ChatAvatar />
          <h2 className="max-w-full truncate text-[15px] font-semibold leading-tight" data-testid={`${testid}-title`}>{title}</h2>
          <p
            className={`glass max-w-full truncate rounded-full px-2.5 py-0.5 text-xs leading-5 ${status ? 'text-foreground' : 'text-muted-foreground'}`}
            data-testid={`${testid}-status`}
            data-busy={status ? '1' : '0'}
            aria-live="polite"
          >
            {status ? `${status}…` : subtitle}
          </p>
          {!wide ? (
            <button
              type="button"
              className="glass absolute top-3 right-3 grid size-11 place-items-center rounded-full text-foreground"
              aria-label="Close chat"
              data-testid={closeTestid}
              onClick={() => onOpenChange(false)}
            >
              <XIcon className="size-5" />
            </button>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <ChatStatusCtx.Provider value={setStatus}>{children}</ChatStatusCtx.Provider>
        </div>
      </aside>

      {!wide && !open ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="pointer-events-auto flex min-h-12 w-full items-center gap-2.5 rounded-full bg-[var(--chat-input)] pr-4 pl-2 text-left text-[16px] text-muted-foreground ring-1 ring-[var(--chat-panel-line)]"
            data-testid={barTestid}
            onClick={() => onOpenChange(true)}
          >
            <ChatAvatar size="sm" />
            <span className="truncate">{barLabel}</span>
            <MessageCircleIcon className="ml-auto size-4 shrink-0 text-[var(--ice)]" aria-hidden />
          </button>
        </div>
      ) : null}
    </>
  );
}
