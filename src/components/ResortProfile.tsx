import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeftIcon, MapIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadarPlayer } from '@/components/RadarPlayer';
import { SnowHistory } from '@/components/SnowHistory';
import { SeeYouOutThere } from '@/components/SeeYouOutThere';
import { SnowStake } from '@/components/SnowStake';
import { snowAmount, passLabel, tempLabel, windLabel, fzlLabel, type SnowUnits, type TempUnits } from '@/lib/format';
import { dumpAria, SnowSplit } from '@/components/SnowSplit';
import { weatherGlyph, forecastDays } from '../../lib/snowWindow.js';
import { fetchResortWeather, snapshotWeather } from '../../lib/weather.js';
import { outboundRel, resortSite } from '../../lib/links.js';
import { fmtFt, parseISO } from '../../lib/util.js';
import { stormStatus } from '../../lib/stormStatus.js';
import { dumpParts } from '@/lib/board';
import { BOARD_LAYOUT, stakeMax } from '@/lib/boardLayout';

/** "2026-11-08T16:51" → "4:51 pm" (F users) or "16:51". Open-Meteo already returns resort-local time. */
function clock(iso: string | null | undefined, tempUnits: TempUnits) {
  if (!iso) return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  const h = Number(m[1]);
  if (tempUnits === 'C') return `${m[1]}:${m[2]}`;
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

function daylight(rise?: string | null, set?: string | null) {
  if (!rise || !set) return null;
  const mins = (Date.parse(set) - Date.parse(rise)) / 60000;
  if (!Number.isFinite(mins) || mins <= 0) return null;
  return `${Math.floor(mins / 60)} h ${Math.round(mins % 60)} min`;
}

function weekday(date: string) {
  return parseISO(date).toLocaleDateString('en-US', { weekday: 'short' });
}

export function ResortProfile({
  row, onBack, onScroll, snow, units, tempUnits = 'F', onShowMap, onAlert, onAsk, history, social,
}: {
  row: { r: any; m: any; storm?: any; wx?: any };
  onBack: () => void;
  onScroll?: (y: number) => void;
  snow: any;
  units: SnowUnits;
  tempUnits?: TempUnits;
  onShowMap: (r: any) => void;
  onAlert?: (r: any) => void;
  onAsk?: (r: any) => void;
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

  const isLive = wx?.source === 'Open-Meteo forecast';
  const cur = wx?.current || {};
  const snapDays = forecastDays(resort, snow, { days: 7 });
  const liveByDate = Object.fromEntries((wx?.daily || []).map((d: any) => [d.date, d]));
  const daily = snapDays.map(d => ({ ...d, ...(liveByDate[d.date] || {}) }));
  const dayMax = Math.max(BOARD_LAYOUT.stakeFloorCm / 2, ...daily.map((d: any) => d.snowCm || 0));
  const site = resortSite(resort);
  const passName = passLabel(resort);
  const dump = dumpParts(resort, snow);
  const today = isLive ? wx.daily?.[0] : null;
  const hi = today?.tmax ?? daily[0]?.tmax ?? cur.tempC;
  const lo = today?.tmin ?? daily[0]?.tmin ?? resort.tmin;
  const glyph = weatherGlyph({ ...row.m, wcode: cur.wcode ?? row.m?.wcode });
  const fzl = wx?.hourly?.find((h: any) => Number.isFinite(h.fzlM))?.fzlM;
  const place = [resort.town, resort.region || resort.state].filter(Boolean).join(', ');

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

  const wrap = 'mx-auto w-full px-4 min-[840px]:px-6';
  const facts: [string, string][] = [];
  if (resort.summit) facts.push(['Summit', units === 'cm' ? `${Math.round(resort.summit).toLocaleString()} m` : `${fmtFt(resort.summit)} ft`]);
  if (resort.base) facts.push(['Base', units === 'cm' ? `${Math.round(resort.base).toLocaleString()} m` : `${fmtFt(resort.base)} ft`]);
  if (resort.summit && resort.base) {
    const v = resort.summit - resort.base;
    facts.push(['Vertical', units === 'cm' ? `${Math.round(v).toLocaleString()} m` : `${fmtFt(v)} ft`]);
  }
  if (resort.runs) facts.push(['Runs mapped', String(resort.runs)]);
  if (resort.lifts) facts.push(['Lifts', String(resort.lifts)]);
  if (resort.iata) facts.push(['Nearest airport', resort.iata]);

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
          className="relative flex min-h-[min(46dvh,24rem)] flex-col justify-end pb-6 pt-[max(3.6rem,calc(env(safe-area-inset-top)+2.8rem))] text-white min-[840px]:min-h-[22rem] min-[840px]:pb-8"
          data-testid="profile-hero"
        >
          <div className="hero-scrim pointer-events-none absolute inset-0" />
          <div
            className={`${wrap} relative z-10 grid gap-5 min-[840px]:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] min-[840px]:items-end min-[840px]:gap-10`}
            style={{ maxWidth: BOARD_LAYOUT.maxWidth }}
          >
            <div className="min-w-0">
              {passName ? <Badge variant="secondary">{passName}</Badge> : null}
              <h1 className="mt-2 text-[2rem] font-semibold leading-[1.05] tracking-tight min-[840px]:text-5xl">{resort.name}</h1>
              {place ? <p className="mt-1.5 text-sm text-white/70 min-[840px]:text-base">{place}</p> : null}
              <p className="mt-3 text-sm text-white/80" data-testid="hero-conditions">
                {glyph} {tempLabel(cur.tempC, tempUnits)} now. High {tempLabel(hi, tempUnits)}, low {tempLabel(lo, tempUnits)}.
                {cur.windKmh != null ? ` Wind ${windLabel(cur.windKmh, units)}.` : ''}
              </p>
            </div>
            <div className="min-w-0" aria-label={dumpAria(resort.name, dump.past72Cm, dump.next7Cm, units, dump.estimated)}>
              <SnowSplit
                pastCm={dump.past72Cm}
                nextCm={dump.next7Cm}
                units={units}
                size="hero"
                estimated={dump.estimated}
                max={stakeMax([dump.past72Cm, dump.next7Cm])}
              />
            </div>
          </div>
        </section>

        <div
          className="relative z-20 -mt-3 rounded-t-[1.6rem] bg-background pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 min-[840px]:pt-6"
        >
          <div className={wrap} style={{ maxWidth: BOARD_LAYOUT.maxWidth }}>
            <section
              className="grid gap-4 rounded-[var(--radius-card)] bg-card p-5 ring-1 ring-foreground/10 min-[840px]:grid-cols-[minmax(0,1fr)_14rem] min-[840px]:items-center min-[840px]:gap-10 min-[840px]:p-6"
              aria-label="Storm status"
              data-testid="tile-storm-status"
            >
              <div className="min-w-0">
                <p className="max-w-[62ch] text-[17px] leading-relaxed min-[840px]:text-xl min-[840px]:leading-snug" data-testid="storm-status-text">
                  {status.text}
                </p>
                <p className="mt-2 text-xs text-muted-foreground" data-testid="storm-source">
                  {status.source}
                </p>
                {onAsk ? (
                  <button
                    type="button"
                    className="mt-3 min-h-11 text-left text-sm text-muted-foreground underline-offset-4 outline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    data-testid="profile-ask"
                    onClick={() => onAsk(resort)}
                  >
                    Ask about {String(resort.name || '').replace(/ \([^)]*\)$/, '') || 'this mountain'}
                  </button>
                ) : null}
              </div>
              {onAlert ? (
                <Button type="button" className="min-h-12 w-full text-base" data-testid="profile-alert-me" onClick={() => onAlert(resort)}>
                  Alert me
                </Button>
              ) : null}
            </section>

            <div className="mt-8 grid gap-x-10 gap-y-10 min-[840px]:mt-10 min-[840px]:grid-cols-12">
              <Block
                title="Next 7 days"
                note={isLive ? 'Live from Open-Meteo.' : 'From the morning snapshot until live weather loads.'}
                className="min-[840px]:col-span-7"
                testId="weather-panel"
              >
                <ol className="flex flex-col gap-2.5 min-[840px]:hidden">
                  {daily.map((d: any) => (
                    <li key={d.date} className="grid grid-cols-[2.75rem_1.5rem_2.75rem_minmax(0,1fr)_3.25rem] items-center gap-3">
                      <span className="text-sm font-medium">{weekday(d.date)}</span>
                      <span className="text-center" aria-hidden>{weatherGlyph({ wcode: d.wcode, outlookCm: d.snowCm, tmax: d.tmax })}</span>
                      <span className="tabular text-sm text-muted-foreground">{tempLabel(d.tmax, tempUnits)}</span>
                      <SnowStake cm={d.snowCm || 0} max={dayMax} kind="forecast" size="row" />
                      <span className="tabular text-right text-sm font-medium">{snowAmount(d.snowCm, units)}</span>
                    </li>
                  ))}
                </ol>
                <ol
                  className="hidden gap-3 min-[840px]:grid"
                  style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(0, 1fr))` }}
                  data-testid="forecast-columns"
                >
                  {daily.map((d: any) => {
                    const pct = Math.min(100, ((d.snowCm || 0) / dayMax) * 100);
                    return (
                      <li key={d.date} className="flex flex-col items-center gap-2 text-center">
                        <span className="text-sm font-medium">{weekday(d.date)}</span>
                        <span aria-hidden>{weatherGlyph({ wcode: d.wcode, outlookCm: d.snowCm, tmax: d.tmax })}</span>
                        <span className="relative h-14 w-full border-b border-foreground/25" aria-hidden>
                          {d.snowCm > 0 ? (
                            <span className="stake-forecast absolute bottom-0 left-1/2 w-8 -translate-x-1/2 rounded-t-[2px]" style={{ height: `max(4px, ${pct}%)` }} />
                          ) : null}
                        </span>
                        <span className="font-display tabular text-2xl leading-none">{snowAmount(d.snowCm, units)}</span>
                        <span className="tabular text-xs text-muted-foreground">
                          {tempLabel(d.tmax, tempUnits)} / {tempLabel(d.tmin, tempUnits)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-4 text-xs text-muted-foreground">
                  Weather data by <a href="https://open-meteo.com/" className="underline underline-offset-4">Open-Meteo.com</a>
                </p>
              </Block>

              <Block title="Today on the mountain" className="min-[840px]:col-span-5" testId="tile-today">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Fact label="Sunrise" value={clock(today?.sunrise, tempUnits)} testId="sunrise" />
                  <Fact label="Sunset" value={clock(today?.sunset, tempUnits)} testId="sunset" />
                  <Fact label="Daylight" value={daylight(today?.sunrise, today?.sunset)} />
                  <Fact label="Wind now" value={cur.windKmh != null ? windLabel(cur.windKmh, units) : null} />
                  <Fact label="Gusts" value={cur.gustKmh != null ? windLabel(cur.gustKmh, units) : null} />
                  <Fact label="Freezing level" value={fzl != null ? fzlLabel(fzl, units) : null} />
                </dl>
                {!today ? (
                  <p className="mt-4 text-xs text-muted-foreground">Sunrise, sunset, and wind fill in when live weather loads.</p>
                ) : null}
              </Block>

              <Block
                title="Radar"
                note="The last hour of precipitation around the mountain."
                className="min-[840px]:col-span-7"
                testId="tile-radar"
              >
                <RadarPlayer lon={resort.center[0]} lat={resort.center[1]} active />
              </Block>

              <Block title="Mountain Facts" note="From OpenSkiMap." className="min-[840px]:col-span-5" testId="tile-facts">
                {resort.id === 'eagle-point' ? <p className="mb-4 text-sm">Closed for 26/27 after the Cottonwood Fire. Targeting a November 2027 reopening.</p> : null}
                {facts.length ? (
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {facts.map(([k, v]) => <Fact key={k} label={k} value={v} />)}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">OpenSkiMap has no stats for this mountain yet.</p>
                )}
                {site ? (
                  <Button variant="outline" className="mt-5 min-h-12 w-full text-base" asChild>
                    <a href={site.href} target="_blank" rel={outboundRel(site.sponsored)} data-testid="official-site">
                      Official site
                    </a>
                  </Button>
                ) : null}
              </Block>

              <Block
                title="Snow history"
                note="This storm, this season, and how it compares with past winters."
                className="min-[840px]:col-span-12"
                testId="tile-snow"
              >
                <SnowHistory resort={resort} snow={snow} history={history} units={units} />
              </Block>

              <div className="min-[840px]:col-span-12">
                <SeeYouOutThere resort={resort} social={social} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({
  title, note, className = '', testId, children,
}: {
  title: string;
  note?: string;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 border-t border-foreground/12 pt-4 ${className}`} data-testid={testId}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {note ? <p className="mt-0.5 text-sm text-muted-foreground">{note}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Fact({ label, value, testId }: { label: string; value: string | null | undefined; testId?: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-lg font-medium tabular">{value ?? '—'}</dd>
    </div>
  );
}
