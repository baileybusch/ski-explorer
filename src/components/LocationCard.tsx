import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { snowAmount, passLabel, tempLabel, stormBadge } from '@/lib/format';
import { weatherGlyph } from '../../lib/snowWindow.js';

export function LocationCard({
  row, units, onOpen,
}: {
  row: { r: any; m: any; storm?: any; wx?: any };
  units: 'in' | 'cm';
  onOpen: (id: string) => void;
}) {
  const { r, m, storm, wx } = row;
  const tempC = wx?.current?.tempC ?? m.tmax;
  const glyph = weatherGlyph({ ...m, wcode: wx?.current?.wcode ?? m.wcode });
  const pass = passLabel(r);
  const outlook = m.usedTypical && !m.usedForecast
    ? `Typical ${snowAmount(m.typicalCm, units)}`
    : snowAmount(m.outlookCm, units);
  const badge = storm?.tier ? stormBadge(storm.tier) : '';

  return (
    <Card
      size="sm"
      className="cursor-pointer py-0 ring-foreground/8"
      data-testid="location-card"
      data-resort={r.id}
    >
      <button
        type="button"
        className="min-h-24 w-full text-left"
        onClick={() => onOpen(r.id)}
      >
        <CardContent className="flex items-center gap-3 py-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-semibold tracking-tight">{r.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {pass ? <Badge variant="secondary">{pass}</Badge> : null}
              <span>{outlook}</span>
              {badge ? <Badge variant="outline">Storm {badge}</Badge> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-3xl font-semibold tracking-tight">{tempLabel(tempC, units)}</div>
            <div className="text-lg leading-none">{glyph}</div>
          </div>
        </CardContent>
      </button>
    </Card>
  );
}
