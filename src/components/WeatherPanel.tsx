import { useEffect, useState } from 'react';
import { snowAmount, tempLabel, windLabel, fzlLabel, stormBadge } from '@/lib/format';
import { weatherGlyph } from '../../lib/snowWindow.js';
import { fetchResortWeather, snapshotWeather } from '../../lib/weather.js';
import { stormForResort } from '../../lib/storms.js';
import { fmtShort } from '../../lib/util.js';

export function WeatherPanel({ resort, snow, units }: { resort: any; snow: any; units: 'in' | 'cm' }) {
  const [wx, setWx] = useState<any>(() => snapshotWeather(resort, snow));
  const [err, setErr] = useState('');
  const storm = stormForResort(resort, snow);

  useEffect(() => {
    let live = true;
    setWx(snapshotWeather(resort, snow));
    setErr('');
    fetchResortWeather(resort).then(data => {
      if (live && data) setWx(data);
    }).catch(() => { if (live) setErr('Live weather unavailable — showing snapshot.'); });
    return () => { live = false; };
  }, [resort, snow]);

  const cur = wx?.current || {};
  const daily = (wx?.daily || []).slice(0, 7);
  const hourly = wx?.hourly || [];
  const live = wx?.source === 'Open-Meteo forecast';

  return (
    <div data-testid="weather-panel" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-bold tracking-tight">
            {weatherGlyph({ wcode: cur.wcode, outlookCm: daily[0]?.snowCm, tmax: cur.tempC })} {tempLabel(cur.tempC, units)}
          </div>
          <div className="text-sm text-muted-foreground">Wind {windLabel(cur.windKmh, units)}</div>
        </div>
        {storm.tier ? (
          <div className="rounded-xl bg-accent/20 px-3 py-2 text-right">
            <div className="text-sm font-bold">Storm incoming · {stormBadge(storm.tier)}</div>
            <div className="text-xs text-muted-foreground">72h forecast</div>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {live ? 'Live Open-Meteo forecast.' : 'From the saved snow snapshot.'} {err}
        {hourly.length ? ' Hourly is the next 48 hours.' : ''}
      </p>

      {storm.tier ? (
        <div className="rounded-xl border border-border/70 p-3">
          <div className="text-base font-bold">Storm timeline</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Starts {storm.start ? fmtShort(storm.start) : '—'} · Peak {storm.peak ? fmtShort(storm.peak) : '—'} ({snowAmount(storm.peakCm, units)}) ·
            Next 7d {snowAmount(storm.totalCm, units)} · Best 72h {snowAmount(storm.max72Cm, units)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{storm.label}</p>
        </div>
      ) : null}

      <div className="text-base font-bold">7-day forecast</div>
      <div className="grid grid-cols-7 gap-1">
        {daily.map((d: any) => (
          <div key={d.date} className="rounded-lg bg-secondary/70 px-1 py-2 text-center">
            <div className="text-[10px] text-muted-foreground">{fmtShort(d.date).split(' ')[0]}</div>
            <div className="text-base">{weatherGlyph({ wcode: d.wcode, outlookCm: d.snowCm, tmax: d.tmax })}</div>
            <div className="text-xs font-semibold">{tempLabel(d.tmax, units)}</div>
            <div className="text-[10px] text-muted-foreground">{snowAmount(d.snowCm, units)}</div>
            <div className="text-[10px] text-muted-foreground">{windLabel(d.windKmh, units)}</div>
          </div>
        ))}
      </div>

      {hourly.length ? (
        <>
          <div className="text-base font-bold">Next 48 hours</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {hourly.filter((_: any, i: number) => i % 3 === 0).map((h: any) => (
              <div key={h.time} className="min-w-16 rounded-lg bg-secondary/70 px-2 py-2 text-center">
                <div className="text-[10px] text-muted-foreground">{h.time.slice(11, 16)}</div>
                <div>{weatherGlyph({ wcode: h.wcode, outlookCm: h.snowCm, tmax: h.tempC })}</div>
                <div className="text-xs font-semibold">{tempLabel(h.tempC, units)}</div>
                <div className="text-[10px]">{snowAmount(h.snowCm, units)}</div>
                <div className="text-[10px] text-muted-foreground">FZL {fzlLabel(h.fzlM, units)}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
