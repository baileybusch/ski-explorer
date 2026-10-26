import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon, MapIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadarPlayer } from '@/components/RadarPlayer';
import { SnowHistory } from '@/components/SnowHistory';
import { SeeYouOutThere } from '@/components/SeeYouOutThere';
import { snowAmount, passLabel, tempLabel, windLabel, type SnowUnits, type TempUnits } from '@/lib/format';
import { dumpAria, SnowSplit } from '@/components/SnowSplit';
import { weatherGlyph, forecastDays } from '../../lib/snowWindow.js';
import { fetchResortWeather, snapshotWeather } from '../../lib/weather.js';
import { interestingBlurb, peopleLabel, tripDates } from '../../lib/trip.js';
import { outboundRel, resortSite } from '../../lib/links.js';
import { fmtFt, fmtShort, parseISO } from '../../lib/util.js';
import { stormStatus } from '../../lib/stormStatus.js';
import { dumpParts } from '@/lib/board';

export function ResortProfile({
  row, onBack, onPlan, onScroll, snow, typical, units, tempUnits = 'F', trip, win, onShowMap, onAlert, onEditTrip, history, social,
}: {
  row: { r: any; m: any; storm?: any; wx?: any };
  onBack: () => void;
  onPlan: (r: any) => void;
  onScroll?: (y: number) => void;
  snow: any;
  typical: any;
  units: SnowUnits;
  tempUnits?: TempUnits;
  trip: any;
  win: any;
  onShowMap: (r: any) => void;
  onAlert?: (r: any) => void;
  onEditTrip?: () => void;
  history?: any;
  social?: { instagram?: string; featuredPosts?: string[] } | null;
}) {
  const resort = row.r;
  const [wx, setWx] = useState<any>(() => row.wx || snapshotWeather(resort, snow));
  const scroller = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const status = useMemo(() => stormStatus(resort, snow, { units }), [resort, snow, units]);

  useEffect(() => {
    let live = true;
    setWx(row.wx || snapshotWeather(resort, snow));
    fetchResortWeather(resort).then(data => { if (live && data) setWx(data); }).catch(() => { /* snapshot */ });
    return () => { live = false; };
  }, [resort, snow, row.wx]);

  const cur = wx?.current || {};
  const snapDays = forecastDays(resort, snow, { days: 7 });
  const liveByDate = Object.fromEntries((wx?.daily || []).map((d: any) => [d.date, d]));
  const daily = snapDays.map(d => ({ ...d, ...(liveByDate[d.date] || {}) }));
  const maxSnow = Math.max(0.1, ...daily.map((d: any) => d.snowCm || 0));
  const { start: from, end: to } = tripDates(trip, win);
  const site = resortSite(resort);
  const passName = passLabel(resort);
  const dump = dumpParts(resort, snow);
  const hi = daily[0]?.tmax ?? cur.tempC;
  const lo = daily[0]?.tmin ?? resort.tmin;
  const glyph = weatherGlyph({ ...row.m, wcode: cur.wcode ?? row.m?.wcode });

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (scroller.current && scroller.current.scrollTop > 8) return;
    if (dy > 72 && Math.abs(dx) < 56) onBack();
  }

  return (
    <div className="relative z-10 flex h-full min-h-dvh flex-col overflow-hidden" data-testid="resort-profile">
      <Button
        type="button"
        variant="ghost"
        className="absolute top-[max(0.55rem,env(safe-area-inset-top))] left-3 z-30 min-h-11 min-w-11 rounded-full bg-background/70"
        aria-label="Back to board"
        data-testid="profile-back"
        onClick={onBack}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="absolute top-[max(0.55rem,env(safe-area-inset-top))] right-3 z-30 min-h-11 min-w-11 rounded-full bg-background/70"
        aria-label="Open map"
        data-testid="profile-map"
        onClick={() => onShowMap(resort)}
      >
        <MapIcon />
      </Button>

      <div
        ref={scroller}
        className="h-full overflow-y-auto overscroll-y-contain"
        data-testid="profile-page"
        data-resort={resort.id}
        onScroll={e => onScroll?.((e.target as HTMLDivElement).scrollTop)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <section
          className="relative flex h-[48dvh] flex-col justify-end px-4 pb-5 pt-[max(3.4rem,calc(env(safe-area-inset-top)+2.6rem))] text-white"
          data-testid="profile-hero"
        >
          <div className="hero-scrim pointer-events-none absolute inset-0" />
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              {passName ? <Badge variant="secondary">{passName}</Badge> : null}
            </div>
            <h1 className="mt-1 text-3xl font-semibold leading-none tracking-tight">{resort.name}</h1>
            <p className="mt-1 text-sm text-white/70">
              {resort.town ? `${resort.town}, ` : ''}{resort.region || resort.state}
            </p>
            <div className="mt-2 flex min-w-0 items-end justify-between gap-3">
              <div className="min-w-0" aria-label={dumpAria(resort.name, dump.past72Cm, dump.next7Cm, units)}>
                <SnowSplit pastCm={dump.past72Cm} nextCm={dump.next7Cm} units={units} size="hero" />
              </div>
              <div className="mb-2 text-right text-base text-white/80">
                <div>{glyph} {tempLabel(cur.tempC, tempUnits)}</div>
                <div className="text-sm text-white/65">
                  H {tempLabel(hi, tempUnits)} / L {tempLabel(lo, tempUnits)}
                  {cur.windKmh != null ? ` · ${windLabel(cur.windKmh, units)}` : ''}
                </div>
                {resort.base_depth ? <div className="text-sm text-white/65">Base {snowAmount(resort.base_depth, units)}</div> : null}
              </div>
            </div>
          </div>
        </section>

        <div className="relative z-20 -mt-3 flex flex-col gap-3 rounded-t-[1.6rem] bg-background px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <Card data-testid="tile-storm-status">
            <CardHeader>
              <CardTitle>Storm status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed" data-testid="storm-status-text">{status.text}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">Modeled forecast.</p>
              {onAlert ? (
                <Button type="button" className="mt-4 min-h-12 w-full text-base" data-testid="profile-alert-me" onClick={() => onAlert(resort)}>
                  Alert me
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card data-testid="weather-panel">
            <CardHeader>
              <CardTitle>7-day forecast</CardTitle>
              <CardDescription>{wx?.source === 'Open-Meteo forecast' ? 'Live Open-Meteo.' : 'Snapshot until live weather loads.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {daily.map((d: any) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <div className="w-10 shrink-0 text-sm font-medium">
                      {parseISO(d.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="w-8 shrink-0 text-center text-base">{weatherGlyph({ wcode: d.wcode, outlookCm: d.snowCm, tmax: d.tmax })}</div>
                    <div className="w-12 shrink-0 text-sm">{tempLabel(d.tmax, tempUnits)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round(((d.snowCm || 0) / maxSnow) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="w-12 shrink-0 text-right text-sm font-medium">{snowAmount(d.snowCm, units)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Weather data by <a href="https://open-meteo.com/" className="underline-offset-4 hover:underline">Open-Meteo.com</a>
              </p>
            </CardContent>
          </Card>

          <Card data-testid="tile-radar">
            <CardHeader>
              <CardTitle>Radar</CardTitle>
              <CardDescription>RainViewer near the mountain. Play/pause the last frames.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadarPlayer lon={resort.center[0]} lat={resort.center[1]} active />
            </CardContent>
          </Card>

          <Card data-testid="tile-snow">
            <CardHeader>
              <CardTitle>Snow history</CardTitle>
              <CardDescription>Current snowfall, this season, and the last five.</CardDescription>
            </CardHeader>
            <CardContent>
              <SnowHistory resort={resort} snow={snow} history={history} units={units} />
            </CardContent>
          </Card>

          <Card data-testid="tile-trip">
            <CardHeader>
              <CardTitle>Plan a trip</CardTitle>
              <CardDescription>
                {fmtShort(from)}–{fmtShort(to)} · {peopleLabel(trip)}
                {resort.iata ? ` · ${trip.home} → ${resort.iata}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="plan-trip" onClick={onEditTrip || (() => onPlan(resort))}>
                Plan a trip
              </Button>
            </CardContent>
          </Card>

          <Card data-testid="tile-facts">
            <CardHeader>
              <CardTitle>Facts</CardTitle>
              <CardDescription>OpenSkiMap stats.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-base">
              <p>{interestingBlurb(resort) || 'OpenSkiMap facts when we have a match.'}</p>
              {resort.id === 'eagle-point' ? <p className="text-sm">Closed 26/27 after the Cottonwood Fire. Targeting Nov 2027.</p> : null}
              <div>Vertical {resort.summit && resort.base ? `${fmtFt(resort.summit - resort.base)} ft` : '—'}</div>
              {site ? (
                <Button variant="outline" className="min-h-12 w-full text-base" asChild>
                  <a href={site.href} target="_blank" rel={outboundRel(site.sponsored)} data-testid="official-site">
                    Official site
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <SeeYouOutThere resort={resort} social={social} />
        </div>
      </div>
    </div>
  );
}
