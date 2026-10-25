import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { snowAmount, passLabel, tempLabel, windLabel, stormBadge } from '@/lib/format';
import { weatherGlyph } from '../../lib/snowWindow.js';
import { stormForResort } from '../../lib/storms.js';
import { partyOf, tripDates } from '../../lib/trip.js';
import { flightLinks, lodgingLinks, outboundRel } from '../../lib/links.js';
import { parseISO, fmtIn } from '../../lib/util.js';
import { isWatched, toggleWatch } from '@/lib/watchlist';

export function snowScore(row: { m: any }) {
  return row.m.windowCm || 0;
}

export function cardTone(rank: number, score: number, max: number) {
  const t = max > 0 ? Math.min(1, score / max) : 0;
  const hero = rank === 1 && t > 0.08;
  const l = hero ? 0.93 : 0.145 + t * 0.32;
  return { t, hero, l, ink: l > 0.52 };
}

export function SnowCard({
  row, rank, max, units, trip, win, snow, flipped, onFlip, onPlan, onWatch,
}: {
  row: { r: any; m: any; storm?: any; wx?: any };
  rank: number;
  max: number;
  units: 'in' | 'cm';
  trip: any;
  win: any;
  snow: any;
  flipped: boolean;
  onFlip: () => void;
  onPlan: () => void;
  onWatch: () => void;
}) {
  const { r, m, wx } = row;
  const tone = cardTone(rank, snowScore(row), max);
  const pass = passLabel(r);
  const storm = row.storm || stormForResort(r, snow);
  const tempC = wx?.current?.tempC ?? m.tmax;
  const wind = wx?.current?.windKmh;
  const glyph = weatherGlyph({ ...m, wcode: wx?.current?.wcode ?? m.wcode });
  const score = snowScore(row);
  const num = units === 'cm' ? Math.round(score) : fmtIn(score);
  const unit = units === 'cm' ? 'cm' : '″';
  const { start, end } = tripDates(trip, win);
  const { adults, kids } = partyOf(trip);
  const fl = flightLinks({ home: trip.home, iata: r.iata, start, end, adults, kids });
  const ld = lodgingLinks({ name: r.name, lat: r.center[1], lon: r.center[0], start, end, adults, kids });
  const daily = (wx?.daily || []).slice(0, 7);
  const maxDay = Math.max(0.1, ...daily.map((d: any) => d.snowCm || 0));
  const watched = isWatched(r.id);
  const fg = tone.ink ? '#08090b' : '#f2f3f5';
  const muted = tone.ink ? 'rgba(8,9,11,.58)' : 'rgba(242,243,245,.62)';

  return (
    <div className="flip-scene h-full w-full" data-testid="snow-card" data-resort={r.id} data-rank={rank}>
      <div className={`flip-card ${flipped ? 'is-flipped' : ''}`}>
        <button
          type="button"
          className="flip-face flip-front flex h-full w-full flex-col justify-between p-5 text-left"
          style={{ background: `oklch(${tone.l} ${tone.hero ? 0.018 : 0.012} 255)`, color: fg }}
          onClick={onFlip}
          data-testid="card-front"
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-base font-semibold"
              style={{ background: tone.hero ? 'var(--ice)' : tone.ink ? 'rgba(8,9,11,.08)' : 'rgba(255,255,255,.1)', color: tone.hero ? '#08090b' : fg }}
            >
              #{rank}
            </span>
            <div className="text-right">
              {pass ? <Badge variant="secondary" className="text-sm">{pass}</Badge> : null}
            </div>
          </div>
          <div>
            <div className="text-[clamp(1.6rem,6vw,2.15rem)] font-semibold leading-none tracking-tight">{r.name}</div>
            <div className="mt-2 text-base" style={{ color: muted }}>
              {r.town ? `${r.town}  ` : ''}{r.region || r.state}
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div className="font-display leading-none tracking-tight" style={{ fontSize: 'clamp(5.4rem, 22vw, 8.2rem)' }}>
                {num}<span className="text-[0.38em]">{unit}</span>
              </div>
              {storm.tier ? (
                <Badge variant="outline" className="mb-3 text-sm" style={{ borderColor: tone.hero ? 'var(--ice)' : fg }}>
                  Storm {stormBadge(storm.tier)}
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 text-lg" style={{ color: muted }}>
              {glyph}  {tempLabel(tempC, units)}
              {wind != null ? `  ${windLabel(wind, units)}` : ''}
              {r.base_depth ? `  base ${snowAmount(r.base_depth, units)}` : ''}
            </div>
          </div>
        </button>

        <div
          className="flip-face flip-back flex h-full w-full flex-col justify-between p-5"
          style={{ background: `oklch(${Math.min(tone.l, 0.22)} 0.012 255)`, color: '#f2f3f5' }}
          data-testid="card-back"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xl font-semibold tracking-tight">{r.name}</div>
                <div className="text-sm text-muted-foreground">#{rank}  {pass}</div>
              </div>
              <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={onFlip}>Back</Button>
            </div>
            <div className="mt-4 flex h-20 items-end gap-1.5" data-testid="week-bars">
              {(daily.length ? daily : placeholderDays(snow)).map((d: any) => {
                const h = Math.round(((d.snowCm || 0) / maxDay) * 100);
                return (
                  <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-14 w-full items-end rounded-sm bg-foreground/10">
                      <div className="w-full rounded-sm bg-accent" style={{ height: `${Math.max(h, d.snowCm ? 8 : 2)}%` }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {parseISO(d.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </span>
                  </div>
                );
              })}
            </div>
            {storm.tier ? (
              <p className="mt-3 text-sm">
                Storm {stormBadge(storm.tier)}
                {storm.start ? ` from ${parseISO(storm.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No 6″ pulse in the next 72h.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {trip.home}{r.iata ? ` → ${r.iata}` : ''}  {adults}+{kids}
            </p>
            {fl[0] ? (
              <Button className="min-h-12 w-full text-base" variant="secondary" asChild>
                <a href={fl[0].href} target="_blank" rel={outboundRel(fl[0].sponsored)}>{fl[0].label}</a>
              </Button>
            ) : null}
            {ld[0] ? (
              <Button className="min-h-12 w-full text-base" variant="outline" asChild>
                <a href={ld[0].href} target="_blank" rel={outboundRel(ld[0].sponsored)}>{ld[0].label}</a>
              </Button>
            ) : null}
            <Button className="min-h-12 w-full text-base" onClick={onPlan}>Plan trip</Button>
            <Button
              variant="ghost"
              className="min-h-11 w-full text-base"
              onClick={() => { toggleWatch(r.id); onWatch(); }}
            >
              {watched ? 'Watching' : 'Watch'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function placeholderDays(snow: any) {
  return (snow?.dates || []).slice(snow.today || 0, (snow.today || 0) + 7).map((date: string) => ({ date, snowCm: 0 }));
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(0.2, ...values);
  const w = 72;
  const h = 22;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
