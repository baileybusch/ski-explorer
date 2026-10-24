import { useEffect, useState } from 'react';
import { MoreHorizontalIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { GHOSTS } from '@/lib/ghosts';

export function SearchBar({
  value, onChange, onSubmit, onSettings, onActivate, loading, status, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onSettings: () => void;
  onActivate?: () => void;
  loading?: boolean;
  status?: string;
  autoFocus?: boolean;
}) {
  const [i, setI] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused || value) return;
    const t = setInterval(() => setI(n => (n + 1) % GHOSTS.length), 3200);
    return () => clearInterval(t);
  }, [focused, value]);

  return (
    <form
      className="w-full"
      onSubmit={e => { e.preventDefault(); onSubmit(); }}
    >
      <InputGroup className="h-14 rounded-2xl border-border/80 bg-card shadow-sm">
        <InputGroupAddon>
          {loading ? <SparklesIcon className="animate-pulse" /> : <SearchIcon />}
        </InputGroupAddon>
        <InputGroupInput
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { setFocused(true); onActivate?.(); }}
          onBlur={() => setFocused(false)}
          placeholder={focused || value ? '' : GHOSTS[i]}
          data-ghost={GHOSTS[i]}
          aria-label="Ask SkiScope"
          className="h-14 text-base"
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-sm"
            variant="ghost"
            aria-label="Settings"
            className="min-h-11 min-w-11"
            onClick={e => { e.preventDefault(); onSettings(); }}
          >
            <MoreHorizontalIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {status ? <p className="mt-2 px-1 text-sm text-muted-foreground">{status}</p> : null}
    </form>
  );
}
