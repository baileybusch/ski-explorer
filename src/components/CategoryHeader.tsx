import { BellIcon, Share2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConsentNote } from '@/components/ConsentNote';

export type CategoryPage = { kind: 'region' | 'pass'; id: string; name: string };

/** Header for /region/<id> and /pass/<id>: what this board is, and the alert CTA preset to it. */
export function CategoryHeader({
  page, heading, count, leader, cta, onAlert,
}: {
  page: CategoryPage;
  heading: string;
  count: number;
  leader: string | null;
  cta: string;
  onAlert: () => void;
}) {
  async function share() {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch { /* dismissed */ }
  }

  return (
    <section className="pb-3 pt-3" data-testid="category-header" data-kind={page.kind} data-id={page.id}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {page.kind === 'pass' ? 'Pass' : 'Region'} · live snow board
      </p>
      <h1 className="mt-1 font-display text-[2.6rem] leading-[0.95] tracking-wide min-[700px]:text-6xl" data-testid="category-title">
        {heading}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground" data-testid="category-summary">
        {count} {count === 1 ? 'resort' : 'resorts'}{leader ? <> · leading now: <span className="text-foreground">{leader}</span></> : null}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button type="button" className="min-h-12 flex-1 text-base min-[700px]:flex-none min-[700px]:px-6" onClick={onAlert} data-testid="category-cta">
          <BellIcon /> {cta}
        </Button>
        <Button type="button" variant="outline" className="min-h-12 px-4" onClick={share} aria-label="Share this board" data-testid="category-share">
          <Share2Icon />
        </Button>
      </div>
      <ConsentNote compact className="mt-2 max-w-xl text-xs" testId="category-consent" />
    </section>
  );
}

/** Bottom-of-board repeat of the category CTA (replaces the home signup on category pages). */
export function CategoryFooterCta({ name, cta, onAlert }: { name: string; cta: string; onAlert: () => void }) {
  return (
    <section className="mx-auto mt-8 w-full max-w-xl px-3" data-testid="category-footer-cta">
      <h2 className="font-display text-4xl tracking-wide">Don&apos;t miss the next {name} dump</h2>
      <p className="mt-2 text-sm text-muted-foreground">One email when it actually snows or a storm is lining up. Nothing else.</p>
      <Button type="button" className="mt-4 min-h-12 w-full text-base" onClick={onAlert} data-testid="category-footer-cta-btn">
        {cta}
      </Button>
      <ConsentNote compact className="mt-2 text-xs" testId="category-footer-consent" />
    </section>
  );
}
