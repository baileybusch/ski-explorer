import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { BottomChrome } from '@/components/BottomChrome';
import { snowAmount, passLabel, tempLabel, fzlLabel, stormBadge } from '@/lib/format';
import { weatherGlyph } from '../../lib/snowWindow.js';
import { fetchResortWeather, snapshotWeather } from '../../lib/weather.js';
import { stormForResort } from '../../lib/storms.js';
import { interestingBlurb, peopleLabel, partyOf, tripDates } from '../../lib/trip.js';
import { flightLinks, lodgingLinks, outboundRel, shareURL } from '../../lib/links.js';
import { fmtFt, fmtShort, parseISO } from '../../lib/util.js';
import { isWatched, toggleWatch } from '@/lib/watchlist';
import { toast } from 'sonner';

export function ResortDetail({
  pages, selectedId, onSelect, snow, typical, units, trip, win, pass,
  onPlan, onWatch, onList, onMap, onExpandMap,
}: {
  pages: any[];
  selectedId: string;
  onSelect: (id: string) => void;
  snow: any;
  typical: any;
  units: 'in' | 'cm';
  trip: any;
  win: any;
  pass: string;
  onPlan: (r: any) => void;
  onWatch: () => void;
  onList: () => void;
  onMap: () => void;
  onExpandMap: (r: any) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const index = Math.max(0, pages.findIndex(r => r.id === selectedId));

  useEffect(() => {
    if (!api) return;
    const onSelectSnap = () => {
      const i = api.selectedScrollSnap();
      const r = pages[i];
      if (r && r.id !== selectedId) onSelect(r.id);
    };
    api.on('select', onSelectSnap);
    return () => { api.off('select', onSelectSnap); };
  }, [api, pages, selectedId, onSelect]);

  useEffect(() => {
    if (!api) return;
    if (api.selectedScrollSnap() !== index) api.scrollTo(index, true);
  }, [api, index]);

  return (
    <div className="flex h-full min-h-dvh flex-col bg-background" data-testid="resort-detail">
      <Carousel className="min-h-0 flex-1 overflow-hidden" opts={{ align: 'start', containScroll: 'trimSnaps' }} setApi={setApi}>
        <CarouselContent className="-ml-0 h-full">
          {pages.map(r => (
            <CarouselItem key={r.id} className="pl-0 basis-full">
              <ResortPage
                resort={r}
                active={r.id === selectedId}
                snow={snow}
                typical={typical}
                units={units}
                trip={trip}
                win={win}
                pass={pass}
                onPlan={() => onPlan(r)}
                onWatch={onWatch}
                onExpandMap={() => onExpandMap(r)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <BottomChrome
        page={index}
        count={pages.length}
        onList={onList}
        onMap={onMap}
        onDot={i => { api?.scrollTo(i); const r = pages[i]; if (r) onSelect(r.id); }}
      />
    </div>
  );
}

function ResortPage({
  resort, active, snow, typical, units, trip, win, pass, onPlan, onWatch, onExpandMap,
}: any) {
  const [wx, setWx] = useState<any>(() => snapshotWeather(resort, snow));
  const [watched, setWatched] = useState(() => isWatched(resort.id));
  const storm = useMemo(() => stormForResort(resort, snow), [resort, snow]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    setWx(snapshotWeather(resort, snow));
    fetchResortWeather(resort).then(data => { if (live && data) setWx(data); }).catch(() => { /* snapshot */ });
    return () => { live = false; };
  }, [active, resort, snow]);

  const cur = wx?.current || {};
  const daily = (wx?.daily || []).slice(0, 7);
  const hourly = wx?.hourly || [];
  const maxSnow = Math.max(0.1, ...daily.map((d: any) => d.snowCm || 0));
  const { start, end } = tripDates(trip, win);
  const { adults, kids } = partyOf(trip);
  const fl = flightLinks({ home: trip.home, iata: resort.iata, start, end, adults, kids });
  const ld = lodgingLinks({ name: resort.name, lat: resort.center[1], lon: resort.center[0], start, end, adults, kids });
  const passName = passLabel(resort);
  const hi = daily[0]?.tmax ?? cur.tempC;
  const lo = daily[0]?.tmin ?? resort.tmin;

  return (
    <div className="h-[calc(100dvh-4.25rem)] overflow-y-auto overscroll-y-contain">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
        <Card data-testid="tile-hero">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold tracking-tight">{resort.name}</CardTitle>
            <CardDescription className="text-base">
              {resort.town ? `${resort.town}, ` : ''}{resort.region || resort.state}
              {passName ? <> · <Badge variant="secondary">{passName}</Badge></> : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div>
              <div className="text-6xl font-semibold tracking-tight">{tempLabel(cur.tempC, units)}</div>
              <div className="mt-1 text-lg text-muted-foreground">
                {weatherGlyph({ wcode: cur.wcode, outlookCm: daily[0]?.snowCm, tmax: cur.tempC })}
                {' '}H {tempLabel(hi, units)} / L {tempLabel(lo, units)}
              </div>
              <div className="mt-1 text-base font-medium">
                Next 7d {snowAmount(resort.fc, units)} · Recent {snowAmount(resort.d7, units)}
              </div>
            </div>
            {storm.tier ? (
              <Badge variant="outline" className="text-sm">Storm {stormBadge(storm.tier)}</Badge>
            ) : null}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <Button className="min-h-11 w-full shrink text-base" onClick={onPlan}>Plan trip</Button>
            <Button
              variant={watched ? 'secondary' : 'ghost'}
              className="min-h-11 w-full shrink text-base"
              onClick={() => { setWatched(toggleWatch(resort.id)); onWatch(); }}
            >
              {watched ? 'Watching' : 'Watch'}
            </Button>
          </CardFooter>
        </Card>

        <Card data-testid="weather-panel">
          <CardHeader>
            <CardTitle>Next 48 hours</CardTitle>
            <CardDescription>{wx?.source === 'Open-Meteo forecast' ? 'Live Open-Meteo forecast.' : 'From the snow snapshot.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(hourly.length ? hourly.filter((_: any, i: number) => i % 3 === 0) : []).map((h: any) => (
                <div key={h.time} className="min-w-16 rounded-lg bg-secondary px-2 py-2 text-center">
                  <div className="text-xs text-muted-foreground">{h.time.slice(11, 16)}</div>
                  <div className="text-base">{weatherGlyph({ wcode: h.wcode, outlookCm: h.snowCm, tmax: h.tempC })}</div>
                  <div className="text-sm font-semibold">{tempLabel(h.tempC, units)}</div>
                  <div className="text-xs">{snowAmount(h.snowCm, units)}</div>
                  <div className="text-xs text-muted-foreground">{fzlLabel(h.fzlM, units)}</div>
                </div>
              ))}
              {!hourly.length ? <p className="text-sm text-muted-foreground">Hourly loads for the open resort only.</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7-day forecast</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {daily.map((d: any) => (
              <div key={d.date} className="flex items-center gap-3">
                <div className="w-10 shrink-0 text-sm font-medium">
                  {parseISO(d.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="w-8 shrink-0 text-center text-base">{weatherGlyph({ wcode: d.wcode, outlookCm: d.snowCm, tmax: d.tmax })}</div>
                <div className="w-12 shrink-0 text-sm">{tempLabel(d.tmax, units)}</div>
                <div className="min-w-0 flex-1">
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${Math.round(((d.snowCm || 0) / maxSnow) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-12 shrink-0 text-right text-sm font-medium">{snowAmount(d.snowCm, units)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {storm.tier ? (
          <Card data-testid="tile-storm">
            <CardHeader>
              <CardTitle>Storm timeline</CardTitle>
              <CardDescription>{storm.label}</CardDescription>
            </CardHeader>
            <CardContent className="text-base">
              Starts {storm.start ? fmtShort(storm.start) : '—'} · Peak {storm.peak ? fmtShort(storm.peak) : '—'} ({snowAmount(storm.peakCm, units)}) ·
              Next 7d {snowAmount(storm.totalCm, units)} · Best 72h {snowAmount(storm.max72Cm, units)}
            </CardContent>
          </Card>
        ) : null}

        <Card data-testid="tile-map">
          <CardHeader>
            <CardTitle>Map</CardTitle>
            <CardDescription>Tap to open the globe.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="secondary" className="min-h-12 w-full text-base" onClick={onExpandMap}>
              Open map
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="tile-trip">
          <CardHeader>
            <CardTitle>Trip</CardTitle>
            <CardDescription>
              {fmtShort(start)}–{fmtShort(end)} · {peopleLabel(trip)}
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
                const url = shareURL({ resort: resort.id, from: start, to: end, adults, kids, home: trip.home, mode: 'explore', pass });
                try { await navigator.clipboard.writeText(url); toast('Link copied'); }
                catch { toast(url); }
              }}
            >
              Share link
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facts</CardTitle>
            <CardDescription>{interestingBlurb(resort)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-base">
            <div>Vertical {resort.summit && resort.base ? `${fmtFt(resort.summit - resort.base)} ft` : '—'}</div>
            {resort.id === 'eagle-point' ? (
              <p>Closed 26/27 after the Cottonwood Fire. Targeting Nov 2027.</p>
            ) : null}
            {resort.web ? <a className="underline" href={resort.web} target="_blank" rel="noopener">Resort site</a> : null}
            <a className="underline" href={`https://openskimap.org/#13/${resort.center[1]}/${resort.center[0]}`} target="_blank" rel="noopener">OpenSkiMap</a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
