import { BellIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConsentNote } from '@/components/ConsentNote';
import { CtaCard } from '@/components/CtaCard';

export function HomeSignup({ onStart, className = 'mt-8' }: { onStart: () => void; className?: string }) {
  return (
    <CtaCard
      testid="home-signup"
      className={className}
      icon={<BellIcon className="size-5" />}
      title="Monitor your home resort"
      body="Pick one mountain. We email you when it actually snows or a storm is lining up."
      action={(
        <Button type="button" className="min-h-12 w-full px-5 text-base" data-testid="home-signup-submit" onClick={onStart}>
          Monitor your home resort
        </Button>
      )}
      note={<ConsentNote compact className="text-xs" testId="signup-consent" />}
    />
  );
}
