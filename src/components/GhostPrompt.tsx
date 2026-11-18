import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

export function GhostPrompt({
  lines, paused, testid = 'search-ghost', className = 'ghost-prompt min-w-0 flex-1 truncate text-base text-muted-foreground',
}: {
  lines: readonly string[];
  paused: boolean;
  testid?: string;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(lines[0]);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  const n = lines.length;
  useEffect(() => {
    if (paused || prefersReducedMotion() || n < 2) return;
    const t = window.setInterval(() => {
      setPhase('out');
      window.setTimeout(() => {
        setI(i => {
          const next = (i + 1) % n;
          setShown(lines[next]);
          return next;
        });
        setPhase('in');
      }, 320);
    }, 3800);
    return () => window.clearInterval(t);
    // lines is a module-level constant; length is the stable dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, n]);

  return (
    <span
      className={className}
      data-testid={testid}
      data-ghost-index={i}
      data-ghost-phase={phase}
      aria-hidden={paused ? undefined : true}
    >
      <span data-state={phase}>{shown}</span>
    </span>
  );
}
