import { Button } from '@/components/ui/button';
import { CONSENT_TEXT } from '../../lib/consentText.js';

export function HomeSignup({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto mt-8 w-full max-w-xl px-3" data-testid="home-signup">
      <h2 className="font-display text-4xl tracking-wide">Monitor your home resort</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick one mountain. We email you when it actually snows or a storm is lining up.
      </p>
      <Button type="button" className="mt-4 min-h-12 w-full px-5 text-base" data-testid="home-signup-submit" onClick={onStart}>
        Monitor your home resort
      </Button>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground" data-testid="signup-consent">{CONSENT_TEXT}</p>
    </section>
  );
}
