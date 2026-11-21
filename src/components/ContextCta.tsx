import { BellIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CtaCard } from '@/components/CtaCard';
import { ctaLabel } from '../../lib/intent.js';

export function ContextCta({
  parsed, onAlert,
}: {
  parsed: any;
  onAlert: () => void;
}) {
  if (!parsed) return null;
  return (
    <CtaCard
      testid="context-cta"
      className="mt-6"
      icon={<BellIcon className="size-5" />}
      title="Get pinged when this moves"
      body="Same signup as home — one email when the situation moves."
      action={(
        <Button type="button" className="min-h-12 w-full text-base" data-testid="context-cta-btn" onClick={onAlert}>
          {ctaLabel(parsed)}
        </Button>
      )}
    />
  );
}
