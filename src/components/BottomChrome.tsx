import { ListIcon, MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BottomChrome({
  page, count, onList, onMap, onDot,
}: {
  page: number;
  count: number;
  onList: () => void;
  onMap: () => void;
  onDot?: (i: number) => void;
}) {
  return (
    <nav
      className="flex items-center justify-between gap-3 border-t border-border/80 bg-background/90 px-3 py-2 backdrop-blur-xl"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      data-testid="bottom-bar"
    >
      <Button type="button" variant="ghost" className="min-h-11 min-w-11" aria-label="List" onClick={onList}>
        <ListIcon />
      </Button>
      <div className="flex min-h-11 flex-1 items-center justify-center gap-1.5">
        {Array.from({ length: Math.max(count, 1) }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Resort ${i + 1}`}
            aria-current={i === page}
            className={`size-2 rounded-full ${i === page ? 'bg-foreground' : 'bg-muted-foreground/40'}`}
            onClick={() => onDot?.(i)}
          />
        ))}
      </div>
      <Button type="button" variant="ghost" className="min-h-11 min-w-11" aria-label="Map" data-testid="map-button" onClick={onMap}>
        <MapIcon />
      </Button>
    </nav>
  );
}
