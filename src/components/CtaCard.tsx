import type { ReactNode } from 'react';

/**
 * The one CTA / promo container. Fills its column's width, consistent padding and
 * rounded containment, copy on the left and the action on the right (stacked on
 * narrow widths). Use it for every signup / alert / promo block so they read as
 * self-contained and line up with the section they sit in.
 */
export function CtaCard({
  icon, eyebrow, title, body, action, note, testid, className = '', titleClassName = '',
}: {
  icon?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  action: ReactNode;
  note?: ReactNode;
  testid: string;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <section className={`cta-card w-full p-5 min-[720px]:p-6 ${className}`} data-testid={testid} data-cta="1">
      <div className="grid items-center gap-4 min-[640px]:grid-cols-[minmax(0,1fr)_auto] min-[640px]:gap-6">
        <div className="flex min-w-0 items-start gap-3.5">
          {icon ? (
            <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ice)]/15 text-[var(--ice)] ring-1 ring-[var(--ice)]/25" aria-hidden>
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ice)]">{eyebrow}</p> : null}
            <h2 className={`font-display text-[1.75rem] leading-[1.05] tracking-wide min-[720px]:text-[2rem] ${titleClassName}`}>{title}</h2>
            {body ? <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">{body}</p> : null}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 min-[640px]:w-auto min-[640px]:min-w-[15rem]">{action}</div>
      </div>
      {note ? <div className="mt-3 border-t border-[var(--surface-line)] pt-3">{note}</div> : null}
    </section>
  );
}
