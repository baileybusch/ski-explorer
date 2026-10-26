import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Field, FieldLabel } from '@/components/ui/field';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { snowAmount, passLabel, tempLabel, fzlLabel, stormBadge, windLabel } from '@/lib/format';
import { weatherGlyph, presetWindow, windowMetrics, SNOW_PRESETS } from '../../lib/snowWindow.js';
import { fetchResortWeather, snapshotWeather } from '../../lib/weather.js';
import { stormForResort } from '../../lib/storms.js';
import { interestingBlurb, peopleLabel, partyOf, tripDates } from '../../lib/trip.js';
import { flightLinks, lodgingLinks, outboundRel, shareURL } from '../../lib/links.js';
import { fmtFt, fmtShort, parseISO } from '../../lib/util.js';
import { isWatched, toggleWatch } from '@/lib/watchlist';
import { snowScore } from '@/lib/board';
import { toast } from 'sonner';

export function ResortProfile({
  pages, selectedId, onSelect, onBack, onPlan, onWatch, onScroll, snow, typical, units, trip, win, pass,
  lodgingOn, setLodgingOn, onShowMap,
}: {
  pages: { r: any; m: any; storm?: any; wx?: any }[];
  selectedId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onPlan: (r: any) => void;
  onWatch: () => void;
  onScroll?: (y: number) => void;
  snow: any;
  typical: any;
  units: 'in' | 'cm';
  trip: any;
  win: any;
  pass: string;
  lodgingOn: boolean;
  setLodgingOn: (v: boolean) => void;
  onShowMap: (r: any) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const index = Math.max(0, pages.findIndex(x => x.r.id === selectedId));

  useEffect(() => {
    if (!api) return;
    const onSnap = () => {
      const i = api.selectedScrollSnap();
      const row = pages[i];
      if (row && row.r.id !== selectedId) onSelect(row.r.id);
    };
    api.on('select', onSnap);
    return () => { api.off('select', onSnap); };
  }, [api, pages, selectedId, onSelect]);

  useEffect(() => {
    if (!api) return;
    if (api.selectedScrollSnap() !== index) api.scrollTo(index, true);
  }, [api, index]);

  return (
    <div className="relative z-10 flex h-full min-h-dvh flex-col" data-testid="resort-profile">
      <Button
        type="button"
        variant="secondary"
        className="absolute top-[max(0.55rem,env(safe-area-inset-top))] left-3 z-30 min-h-11 min-w-11 rounded-full"
        aria-label="Back to board"
        data-testid="profile-back"
        onClick={onBack}
      >
        <ChevronLeftIcon />
      </Button>
      <Carousel className="min-h-0 flex-1 overflow-hidden" opts={{ align: 'start', containScroll: 'trimSnaps' }} setApi={setApi}>
        <CarouselContent className="-ml-0 h-full">
          {pages.map(row => (
            <CarouselItem key={row.r.id} className="pl-0 basis-full">
              <ProfilePage
                row={row}
                rank={pages.findIndex(x => x.r.id === row.r.id) + 1}
                active={row.r.id === selectedId}
                snow={snow}
                typical={typical}
                units={units}
                trip={trip}
                win={win}
                pass={pass}
                lodgingOn={lodgingOn}
                setLodgingOn={setLodgingOn}
                onPlan={() => onPlan(row.r)}
                onWatch={onWatch}
                onShowMap={() => onShowMap(row.r)}
                onBack={onBack}
                onScroll={row.r.id === selectedId ? onScroll : undefined}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}

function ProfilePage({
  row, rank, active, snow, typical, units, trip, win, pass, lodgingOn, setLodgingOn,
  onPlan, onWatch, onShowMap, onBack, onScroll,
}: any) {
  const resort = row.r;
  const [wx, setWx] = useState<any>(() => row.wx || snapshotWeather(resort, snow));
  const [watched, setWatched] = useState(() => isWatched(resort.id));
  const scroller = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const storm = useMemo(() => row.storm || stormForResort(resort, snow), [row.storm, resort, snow]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    setWx(row.wx || snapshotWeather(resort, snow));
    fetchResortWeather(resort).then(data => { if (live && data) setWx(data); }).catch(() => { /* snapshot */ });
    return () => { live = false; };
  }, [active, resort, snow, row.wx]);

  const cur = wx?.current || {};
  const daily = (wx?.daily || []).slice(0, 7);
  const hourly = (wx?.hourly || []).filter((_: any, i: number) => i % 3 === 0);
  const maxSnow = Math.max(0.1, ...daily.map((d: any) => d.snowCm || 0));
  const { start: from, end: to } = tripDates(trip, win);
  const { adults, kids } = partyOf(trip);
  const fl = flightLinks({ home: trip.home, iata: resort.iata, start: from, end: to, adults, kids });
  const ld = lodgingLinks({ name: resort.name, lat: resort.center[1], lon: resort.center[0], start: from, end: to, adults, kids });
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
            <span className="text-sm font-semibold opacity-80">#{rank}</span>
            {passName ? <Badge variant="secondary">{passName}</Badge> : null}
            {storm.tier ? <Badge variant="outline" className="border-white/50 text-white">Storm {stormBadge(storm.tier)}</Badge> : null}
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

      <div className="relative z-20 -mt-3 flex flex-col gap-3 rounded-t-[1.6rem] bg-background px-3 pb-[5.8rem] pt-4">
        <Card data-testid="tile-snow">
          <CardHeader>
            <CardTitle>Snow</CardTitle>
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

        <Card data-testid="weather-panel">
          <CardHeader>
            <CardTitle>Weather</CardTitle>
            <CardDescription>{wx?.source === 'Open-Meteo forecast' ? 'Live Open-Meteo. Swipe hourly / 7-day.' : 'Snapshot until live weather loads.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Carousel opts={{ align: 'start' }} onPointerDown={e => e.stopPropagation()}>
              <CarouselContent>
                <CarouselItem>
                  <p className="mb-2 text-sm font-medium">Next 48 hours</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {hourly.length ? hourly.map((h: any) => (
                      <div key={h.time} className="min-w-16 rounded-lg bg-secondary px-2 py-2 text-center">
                        <div className="text-xs text-muted-foreground">{h.time.slice(11, 16)}</div>
                        <div className="text-base">{weatherGlyph({ wcode: h.wcode, outlookCm: h.snowCm, tmax: h.tempC })}</div>
                        <div className="text-sm font-semibold">{tempLabel(h.tempC, units)}</div>
                        <div className="text-xs">{snowAmount(h.snowCm, units)}</div>
                        <div className="text-xs text-muted-foreground">{fzlLabel(h.fzlM, units)}</div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Hourly loads for the open resort only.</p>}
                  </div>
                </CarouselItem>
                <CarouselItem>
                  <p className="mb-2 text-sm font-medium">7-day forecast</p>
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
                </CarouselItem>
              </CarouselContent>
            </Carousel>
          </CardContent>
        </Card>

        <Card data-testid="tile-storm">
          <CardHeader>
            <CardTitle>Storm timeline</CardTitle>
            <CardDescription>{storm.label}</CardDescription>
          </CardHeader>
          <CardContent className="text-base">
            {storm.tier ? (
              <>Starts {storm.start ? fmtShort(storm.start) : '—'} · Peak {storm.peak ? fmtShort(storm.peak) : '—'} ({snowAmount(storm.peakCm, units)}) · Next 7d {snowAmount(storm.totalCm, units)} · Best 72h {snowAmount(storm.max72Cm, units)}</>
            ) : (
              <span className="text-muted-foreground">No 6″ pulse in the next 72h.</span>
            )}
          </CardContent>
        </Card>

        <Card data-testid="tile-trip">
          <CardHeader>
            <CardTitle>Trip</CardTitle>
            <CardDescription>
              {fmtShort(from)}–{fmtShort(to)} · {peopleLabel(trip)}
              {resort.iata ? ` · ${trip.home} → ${resort.iata}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Google Flights first. Search links only — no invented prices.</p>
            {fl.map((link: any) => (
              <Button key={link.id} variant={link.primary ? 'default' : 'outline'} className="min-h-12 w-full text-base" asChild>
                <a href={link.href} target="_blank" rel={outboundRel(link.sponsored)}>{link.label}</a>
              </Button>
            ))}
            {ld.map((link: any) => (
              <Button key={link.id} variant="outline" className="min-h-12 w-full text-base" asChild>
                <a href={link.href} target="_blank" rel={outboundRel(link.sponsored)}>{link.label}</a>
              </Button>
            ))}
            <Button
              variant="outline"
              className="min-h-12 text-base"
              onClick={async () => {
                const url = shareURL({ resort: resort.id, from, to, adults, kids, home: trip.home, mode: 'explore', pass });
                try { await navigator.clipboard.writeText(url); toast('Link copied'); }
                catch { toast(url); }
              }}
            >
              Share link
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="tile-facts">
          <CardHeader>
            <CardTitle>Facts</CardTitle>
            <CardDescription>Swipe for mountain stats.</CardDescription>
          </CardHeader>
          <CardContent>
            <Carousel opts={{ align: 'start' }} onPointerDown={e => e.stopPropagation()}>
              <CarouselContent>
                <CarouselItem>
                  <p className="text-base">{interestingBlurb(resort) || 'OpenSkiMap facts when we have a match.'}</p>
                  {resort.id === 'eagle-point' ? <p className="mt-2 text-sm">Closed 26/27 after the Cottonwood Fire. Targeting Nov 2027.</p> : null}
                </CarouselItem>
                <CarouselItem>
                  <div className="flex flex-col gap-2 text-base">
                    <div>Vertical {resort.summit && resort.base ? `${fmtFt(resort.summit - resort.base)} ft` : '—'}</div>
                    {resort.runs ? <div>{resort.runs} runs mapped</div> : null}
                    {resort.lifts ? <div>{resort.lifts} lifts</div> : null}
                    {resort.web ? <a className="underline" href={resort.web} target="_blank" rel="noopener">Resort site</a> : null}
                    <a className="underline" href={`https://openskimap.org/#13/${resort.center[1]}/${resort.center[0]}`} target="_blank" rel="noopener">OpenSkiMap</a>
                  </div>
                </CarouselItem>
              </CarouselContent>
            </Carousel>
          </CardContent>
        </Card>

        <Card data-testid="tile-lodging-map">
          <CardHeader>
            <CardTitle>Lodging map</CardTitle>
            <CardDescription>OSM hotels near the village. Toggle pins, then open the globe.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field orientation="horizontal">
              <FieldLabel htmlFor={`lodge-${resort.id}`}>Show lodging pins</FieldLabel>
              <Switch id={`lodge-${resort.id}`} checked={lodgingOn} onCheckedChange={setLodgingOn} />
            </Field>
            <Button type="button" variant="secondary" className="min-h-12 w-full text-base" onClick={onShowMap}>
              Open map
            </Button>
          </CardContent>
        </Card>

        <Button
          variant={watched ? 'secondary' : 'ghost'}
          className="min-h-11 w-full text-base"
          onClick={() => { setWatched(toggleWatch(resort.id)); onWatch(); }}
        >
          {watched ? 'Watching' : 'Watch'}
        </Button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" className="pointer-events-auto min-h-12 w-full text-base shadow-lg" data-testid="plan-trip" onClick={onPlan}>
          Plan trip
        </Button>
      </div>
    </div>
  );
}
