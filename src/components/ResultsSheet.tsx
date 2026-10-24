import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { snowAmount, passLabel } from '@/lib/format';
import { weatherGlyph } from '../../lib/snowWindow.js';

export function ResultsSheet({
  title, rows, units, snap, onSnap, onExplore,
}: {
  title: string;
  rows: { r: any; m: any }[];
  units: 'in' | 'cm';
  snap: 'peek' | 'half' | 'full';
  onSnap: (s: 'peek' | 'half' | 'full') => void;
  onExplore: (id: string) => void;
}) {
  const h = snap === 'peek' ? '9.5rem' : snap === 'half' ? '50dvh' : '86dvh';
  return (
    <section
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-3xl border-t border-border/80 bg-card/92 shadow-[0_-12px_40px_rgba(0,0,0,.45)] backdrop-blur-xl"
      style={{ height: h }}
      data-testid="results"
      data-snap={snap}
    >
      <button
        type="button"
        className="flex min-h-12 w-full flex-col items-center px-4 pt-2"
        aria-label="Resize list"
        onClick={() => onSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek')}
      >
        <span className="mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/50" />
        <div className="flex w-full items-baseline justify-between gap-3">
          <h2 className="text-left text-lg font-bold tracking-tight">{title}</h2>
          <span className="text-sm text-muted-foreground">{rows.length} areas</span>
        </div>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {rows.length === 0 ? (
          <p className="px-2 py-4 text-base text-muted-foreground">No matching resorts. Open the menu and try Both passes.</p>
        ) : rows.map(({ r, m }) => {
          const outlook = m.usedTypical && !m.usedForecast ? `Typical ${snowAmount(m.typicalCm, units)}` : snowAmount(m.outlookCm, units);
          const pass = passLabel(r);
          return (
            <div key={r.id} className="flex items-center gap-3 border-b border-border/60 py-2.5" data-resort={r.id}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold">{r.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                  {pass ? <Badge variant={pass.startsWith('Epic') ? 'secondary' : 'default'} className="h-6 px-2 text-[11px]">{pass}</Badge> : null}
                  <span>{weatherGlyph(m)} {outlook}</span>
                </div>
              </div>
              <Button className="min-h-11 min-w-[5.5rem] shrink-0 text-base" onClick={() => onExplore(r.id)}>Explore</Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
