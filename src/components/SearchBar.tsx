import { useEffect, useState } from 'react';
import { MenuIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { GHOSTS } from '@/lib/ghosts';

export function SearchBar({
  value, onChange, onSubmit, onMenu, loading, status,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onMenu: () => void;
  loading?: boolean;
  status?: string;
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
      className="pointer-events-auto w-full"
      onSubmit={e => { e.preventDefault(); onSubmit(); }}
    >
      <InputGroup className="h-14 rounded-2xl border-border/80 bg-card/90 shadow-lg backdrop-blur-xl">
        <InputGroupAddon>
          {loading ? <SparklesIcon className="animate-pulse" /> : <SearchIcon />}
        </InputGroupAddon>
        <InputGroupInput
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused || value ? '' : GHOSTS[i]}
          data-ghost={GHOSTS[i]}
          aria-label="Ask SkiScope"
          className="h-14 text-base"
          autoComplete="off"
          enterKeyHint="search"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-sm"
            variant="ghost"
            aria-label="Menu"
            className="min-h-11 min-w-11"
            onClick={e => { e.preventDefault(); onMenu(); }}
          >
            <MenuIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {status ? <p className="mt-2 px-3 text-sm text-muted-foreground">{status}</p> : null}
    </form>
  );
}
