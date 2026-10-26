import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon, MapIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadarPlayer } from '@/components/RadarPlayer';
import { snowAmount, passLabel, tempLabel, windLabel } from '@/lib/format';
import { weatherGlyph, presetWindow, windowMetrics, SNOW_PRESETS, forecastDays } from '../../lib/snowWindow.js';
import { fetchResortWeather, snapshotWeather } from '../../lib/weather.js';
import { interestingBlurb, peopleLabel, partyOf, tripDates } from '../../lib/trip.js';
import { flightLinks, lodgingLinks, outboundRel, resortSite } from '../../lib/links.js';
import { fmtFt, fmtShort, parseISO } from '../../lib/util.js';
import { stormStatus } from '../../lib/stormStatus.js';
import { snowScore } from '@/lib/board';

export function ResortProfile({
  row, onBack, onPlan, onScroll, snow, typical, units, trip, win, onShowMap, onAlert, onEditTrip,
}: {
  row: { r: any; m: any; storm?: any; wx?: any };
  onBack: () => void;
  onPlan: (r: any) => void;
  onScroll?: (y: number) => void;
  snow: any;
  typical: any;
  units: 'in' | 'cm';
  trip: any;
  win: any;
  onShowMap: (r: any) => void;
  onAlert?: (r: any) => void;
  onEditTrip?: () => void;
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
  const { adults, kids } = partyOf(trip);
  const fl = flightLinks({ home: trip.home, iata: resort.iata, start: from, end: to, adults, kids });
  const ld = lodgingLinks({ name: resort.name, lat: resort.center[1], lon: resort.center[0], start: from, end: to, adults, kids });
  const site = resortSite(resort);
  const passName = passLabel(resort);
  const score = snowScore(row);
  const num = units === 'cm' ? Math.round(score) : Math.round((score / 2.54) * 10) / 10;
  const unit = units === 'cm' ? 'cm' : '″';
  const windows = SNOW_PRESETS.map(p => ({
    ...p,
    cm: windowMetrics(resort, snow, presetWindow(snow, p.id), typical).windowCm,
  }));
  const maxWin = Math.max(0.1, ...windows.map(w => w.cm));
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
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="font-display leading-none" style={{ fontSize: 'clamp(4.6rem, 22vw, 7.2rem)' }}>
                {num}<span className="text-[0.36em]">{unit}</span>
              </div>
              <div className="mb-2 text-right text-base text-white/80">
                <div>{glyph} {tempLabel(cur.tempC, units)}</div>
                <div className="text-sm text-white/65">
                  H {tempLabel(hi, units)} / L {tempLabel(lo, units)}
                  {cur.windKmh != null ? ` · ${windLabel(cur.windKmh, units)}` : ''}
                </div>
                {resort.base_depth ? <div className="text-sm text-white/65">Base {snowAmount(resort.base_depth, units)}</div> : null}
              </div>
            </div>
          </div>
        </section>

        <div className="relative z-20 -mt-3 flex flex-col gap-3 rounded-t-[1.6rem] bg-background px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4">
          <Card data-testid="tile-storm-status">
            <CardHeader>
              <CardTitle>Storm status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed" data-testid="storm-status-text">{status.text}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">Modeled forecast.</p>
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
                    <div className="w-12 shrink-0 text-sm">{tempLabel(d.tmax, units)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round(((d.snowCm || 0) / maxSnow) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="w-12 shrink-0 text-right text-sm font-medium">{snowAmount(d.snowCm, units)}</div>
                  </div>
                ))}
              </div>
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
              <CardDescription>Observed windows and the next-7 forecast.</CardDescription>
            </CardHeader>
            <CardContent className="flex h-24 items-end gap-2">
              {windows.map(w => (
                <div key={w.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end rounded-md bg-muted">
                    <div className="w-full rounded-md bg-accent" style={{ height: `${Math.max(8, Math.round((w.cm / maxWin) * 100))}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{w.label}</span>
                  <span className="text-xs font-semibold">{snowAmount(w.cm, units)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card data-testid="tile-trip">
            <CardHeader>
              <CardTitle>Plan trip</CardTitle>
              <CardDescription>
                {fmtShort(from)}–{fmtShort(to)} · {peopleLabel(trip)}
                {resort.iata ? ` · ${trip.home} → ${resort.iata}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {onEditTrip ? (
                <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="edit-trip" onClick={onEditTrip}>
                  People, dates, airport
                </Button>
              ) : null}
              {fl[0] ? (
                <Button variant="outline" className="min-h-12 w-full text-base" asChild>
                  <a href={fl[0].href} target="_blank" rel={outboundRel(fl[0].sponsored)}>Flights</a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">No nearby airport on file.</p>
              )}
              {ld[0] ? (
                <Button variant="outline" className="min-h-12 w-full text-base" asChild>
                  <a href={ld[0].href} target="_blank" rel={outboundRel(ld[0].sponsored)}>Stays</a>
                </Button>
              ) : null}
              <Button variant="outline" className="min-h-12 w-full text-base" data-testid="plan-trip" onClick={() => onPlan(resort)}>
                Plan with an AI agent
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
        </div>
      </div>

      {onAlert ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" className="pointer-events-auto min-h-12 w-full text-base shadow-lg" data-testid="profile-alert-me" onClick={() => onAlert(resort)}>
            Alert me
          </Button>
        </div>
      ) : null}
    </div>
  );
}
