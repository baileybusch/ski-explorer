import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { rainviewerMaps, radarFrameUrls } from '@/lib/rainviewer';
import { prefersReducedMotion } from '@/lib/motion';

type Status = 'loading' | 'ready' | 'empty' | 'error';

export function RadarPlayer({
  lon, lat, active,
}: {
  lon: number;
  lat: number;
  active: boolean;
}) {
  const [frames, setFrames] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(() => !prefersReducedMotion());
  const [status, setStatus] = useState<Status>('loading');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    let live = true;
    setStatus('loading');
    const t = window.setTimeout(() => {
      if (live) setStatus(s => (s === 'loading' ? 'error' : s));
    }, 12_000);
    rainviewerMaps()
      .then(maps => {
        if (!live) return;
        const urls = radarFrameUrls(maps, lon, lat, 6);
        setFrames(urls);
        setI(Math.max(0, urls.length - 1));
        setStatus(urls.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!live) return;
        setFrames([]);
        setStatus('error');
      });
    return () => { live = false; window.clearTimeout(t); };
  }, [active, lon, lat, tick]);

  useEffect(() => {
    if (!play || frames.length < 2 || !active || prefersReducedMotion()) return;
    const t = setInterval(() => setI(n => (n + 1) % frames.length), 420);
    return () => clearInterval(t);
  }, [play, frames.length, active]);

  const src = frames[i];

  return (
    <div className="flex flex-col gap-2" data-testid="radar-player" data-status={status}>
      <div className="relative aspect-[1.4/1] overflow-hidden rounded-xl bg-muted min-[840px]:aspect-[16/9]">
        {status === 'ready' && src ? (
          <img
            src={src}
            alt="RainViewer radar"
            className="h-full w-full object-cover"
            onError={() => setStatus('error')}
          />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground" data-testid="radar-player-msg">
            {status === 'loading' ? 'Loading RainViewer radar…' : null}
            {status === 'empty' ? 'RainViewer has no radar frames for this view right now.' : null}
            {status === 'error' ? 'Radar did not load. RainViewer may be unreachable from here.' : null}
          </div>
        )}
        {frames.map(url => (
          <img key={url} src={url} alt="" className="hidden" />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        {status === 'ready' ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setPlay(p => !p)} data-testid="radar-play">
            {play ? 'Pause' : 'Play'}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setTick(n => n + 1)} data-testid="radar-retry">
            Retry
          </Button>
        )}
        <p className="text-xs text-muted-foreground">RainViewer mosaic. Precipitation, not snow totals. Coarse outside dense radar networks.</p>
      </div>
    </div>
  );
}
