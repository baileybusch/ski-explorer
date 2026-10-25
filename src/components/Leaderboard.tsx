import { useEffect, useRef } from 'react';
import { SnowCard, snowScore } from '@/components/SnowCard';

export function Leaderboard({
  rows, units, trip, win, snow, flippedId, onFlip, onPlan, onWatch,
}: {
  rows: { r: any; m: any; storm?: any; wx?: any }[];
  units: 'in' | 'cm';
  trip: any;
  win: any;
  snow: any;
  flippedId: string | null;
  onFlip: (id: string | null) => void;
  onPlan: (r: any) => void;
  onWatch: () => void;
}) {
  const max = Math.max(0, ...rows.map(snowScore));
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!flippedId || !scroller.current) return;
    const el = scroller.current.querySelector(`[data-resort="${flippedId}"]`);
    el?.closest('.snap-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [flippedId]);

  return (
    <div
      ref={scroller}
      className="snap-board min-h-0 flex-1 overflow-y-auto"
      data-testid="board-a"
    >
      {rows.map((row, i) => (
        <section key={row.r.id} className="snap-card h-full px-3 pb-20 pt-2">
          <SnowCard
            row={row}
            rank={i + 1}
            max={max}
            units={units}
            trip={trip}
            win={win}
            snow={snow}
            flipped={flippedId === row.r.id}
            onFlip={() => onFlip(flippedId === row.r.id ? null : row.r.id)}
            onPlan={() => onPlan(row.r)}
            onWatch={onWatch}
          />
        </section>
      ))}
    </div>
  );
}
