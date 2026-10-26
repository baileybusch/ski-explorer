import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function HomeSignup({ onStart }: { onStart: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setMsg('Enter a valid email');
      return;
    }
    setMsg('');
    onStart(addr);
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-xl px-3" data-testid="home-signup">
      <h2 className="font-display text-4xl tracking-wide">Know before it dumps</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Get a storm alert when a mountain you care about is about to get hit. No password.
      </p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          className="min-h-12 flex-1"
          value={email}
          onChange={e => setEmail(e.target.value)}
          data-testid="home-signup-email"
        />
        <Button type="submit" className="min-h-12 px-5 text-base" data-testid="home-signup-submit">
          Get alerts
        </Button>
      </form>
      {msg ? <p className="mt-2 text-sm text-destructive">{msg}</p> : null}
    </section>
  );
}
