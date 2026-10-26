import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AUTO_ADVANCE_MS = 200;

/** Highlight, then advance. Cancel on unmount or a newer pick. */
export function useAutoAdvance(ms = AUTO_ADVANCE_MS) {
  const t = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (fn: () => void) => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(fn, ms);
  };
}

const shellClass = 'fixed inset-0 z-50 max-w-[100vw] overflow-x-hidden overscroll-x-none bg-background sm:bg-black/50 sm:grid sm:place-items-center';
const panelClass = 'flex h-full w-full max-w-[100vw] min-w-0 flex-col overflow-x-hidden bg-background sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl sm:ring-1 sm:ring-foreground/12';

export function FlowShell({
  open, onClose, onBack, title, hint, progress, total, children, footer, testId,
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  title: string;
  hint?: string;
  progress: number;
  total: number;
  children: ReactNode;
  footer?: ReactNode;
  testId: string;
}) {
  if (!open) return null;
  return (
    <div className={shellClass} data-testid={testId} style={{ touchAction: 'pan-y' }}>
      <div className={panelClass} style={{ touchAction: 'pan-y' }}>
        <div className="flex min-w-0 items-center gap-2 px-3 pt-[max(0.55rem,env(safe-area-inset-top))]">
          {onBack ? (
            <Button type="button" variant="ghost" className="min-h-11 min-w-11 rounded-full" aria-label="Back" data-testid={`${testId}-back`} onClick={onBack}>
              <ChevronLeftIcon />
            </Button>
          ) : <div className="w-11" />}
          <div className="flex min-w-0 flex-1 justify-center gap-1.5" data-testid={`${testId}-progress`}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`h-1.5 w-8 max-w-[2rem] rounded-full ${i < progress ? 'bg-foreground' : 'bg-foreground/20'}`} />
            ))}
          </div>
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-base" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none px-5 py-6" style={{ touchAction: 'pan-y' }}>
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
          <h2 className="mt-2 max-w-full break-words font-display text-4xl tracking-wide">{title}</h2>
          <div className="min-w-0 max-w-full">{children}</div>
        </div>
        {footer ? (
          <div className="flex min-w-0 flex-col gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChoiceTile({
  selected, onClick, title, hint, testId,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`min-h-20 w-full min-w-0 max-w-full rounded-2xl px-5 text-left ring-1 ${selected ? 'bg-foreground text-background ring-foreground' : 'ring-foreground/12'}`}
    >
      <div className="font-display text-3xl">{title}</div>
      {hint ? <div className="text-sm opacity-70">{hint}</div> : null}
    </button>
  );
}
