import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Resorts page sub-header (under the app header, inside the list panel):
 * page title + count, the active search chip, and "Back to all resorts" when scoped.
 * The app header (logo · Resorts · account menu) is AppHeader.
 */
export function BoardChrome({
  title, count, onClearScope, scoped, chip, showTitle = true,
}: {
  title: string;
  count: number;
  onClearScope: () => void;
  scoped?: boolean;
  chip?: string;
  /** Category pages render their own header block instead. */
  showTitle?: boolean;
}) {
  if (!showTitle && !chip && !scoped) return null;
  return (
    <div className="flex flex-col gap-2 px-3 pt-3 min-[720px]:px-6 min-[720px]:pt-5" data-testid="board-scope-bar">
      {showTitle ? (
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-[1.9rem] leading-none tracking-wide min-[720px]:text-[2.25rem]" data-testid="board-title">{title}</h1>
          <p className="shrink-0 text-xs text-muted-foreground min-[720px]:text-sm" data-testid="board-count">
            {count} mountains · tap one to ask about it
          </p>
        </div>
      ) : null}
      {chip || scoped ? (
        <div className="flex flex-wrap items-center gap-2">
          {scoped ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 gap-1.5 rounded-full px-3 text-sm"
              data-testid="back-to-all"
              onClick={onClearScope}
            >
              <ArrowLeftIcon className="size-4" /> Back to all resorts
            </Button>
          ) : null}
          {chip ? (
            <span className="flex items-center gap-1" data-testid="intent-chip">
              <span className="rounded-full border border-[var(--surface-line)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm">{chip}</span>
              <Button type="button" variant="ghost" className="min-h-10 px-2 text-sm" data-testid="intent-clear" onClick={onClearScope}>
                Clear
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
