import { Button } from '@/components/ui/button';
import { ctaLabel } from '../../lib/intent.js';

export function ContextCta({
  parsed, onAlert,
}: {
  parsed: any;
  onAlert: () => void;
}) {
  if (!parsed) return null;
  return (
    <section className="mx-auto mt-6 w-full max-w-xl px-3" data-testid="context-cta">
      <Button type="button" className="min-h-12 w-full text-base" data-testid="context-cta-btn" onClick={onAlert}>
        {ctaLabel(parsed)}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">Same signup as home — one email when the situation moves.</p>
    </section>
  );
}
