import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { rainviewerMaps, radarFrameUrls, probeRadarTile, type RadarCover } from '@/lib/rainviewer';
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
  const [cover, setCover] = useState<RadarCover | 'unknown'>('unknown');
  const [opaque, setOpaque] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    let live = true;
    setStatus('loading');
    const t = window.setTimeout(() => {
      if (live) setStatus(s => (s === 'loading' ? 'error' : s));
    }, 12_000);
    rainviewerMaps()
      .then(async maps => {
        if (!live) return;
        const urls = radarFrameUrls(maps, lon, lat, 6);
        setFrames(urls);
        setI(Math.max(0, urls.length - 1));
        if (!urls.length) {
          setCover('unavailable');
          setStatus('empty');
          return;
        }
        const probe = await probeRadarTile(maps, lon, lat, 6);
        if (!live) return;
        setCover(probe.kind);
        setStatus('ready');
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

  useEffect(() => {
    if (status !== 'ready' || !src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 16) n++;
        setOpaque(n);
      } catch { /* tainted canvas */ }
    };
    img.src = src;
  }, [status, src]);

  return (
    <div className="flex flex-col gap-2" data-testid="radar-player" data-status={status} data-cover={cover} data-opaque={opaque == null ? '' : String(opaque)}>
      <div className="relative aspect-[1.4/1] overflow-hidden rounded-xl bg-muted min-[840px]:aspect-[16/9]">
        {status === 'ready' && src ? (
          <>
            <img
              crossOrigin="anonymous"
              src={src}
              alt="RainViewer radar"
              className="h-full w-full object-cover"
              onError={() => setStatus('error')}
            />
            <p className="absolute inset-x-0 bottom-0 bg-background/80 px-3 py-1.5 text-center text-[11px] text-foreground" data-testid="radar-cover-note">
              {cover === 'precip' ? 'Precipitation in this tile (RainViewer)' : cover === 'clear' ? 'Mosaic up · no echo in this tile' : 'RainViewer mosaic'}
            </p>
          </>
        ) : (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground" data-testid="radar-player-msg">
            {status === 'loading' ? 'Loading RainViewer radar…' : null}
            {status === 'empty' ? 'RainViewer mosaic has no frames — unavailable, not a clear sky.' : null}
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
        <p className="text-xs text-muted-foreground">
          {cover === 'precip'
            ? 'RainViewer mosaic — precipitation in this tile. Not snow totals. Max zoom 7.'
            : cover === 'clear'
              ? 'RainViewer mosaic is up; this tile has no echo (clear, or outside a dense network).'
              : 'RainViewer mosaic. Precipitation, not snow totals. Coarse outside dense radar networks. Personal/educational API.'}
        </p>
      </div>
    </div>
  );
}
