import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { rainviewerMaps, radarFrameUrls } from '@/lib/rainviewer';

export function RadarPlayer({
  lon, lat, active,
}: {
  lon: number;
  lat: number;
  active: boolean;
}) {
  const [frames, setFrames] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (!active) return;
    let live = true;
    rainviewerMaps()
      .then(maps => {
        if (!live) return;
        const urls = radarFrameUrls(maps, lon, lat, 7);
        setFrames(urls);
        setI(Math.max(0, urls.length - 1));
      })
      .catch(() => { /* radar optional */ });
    return () => { live = false; };
  }, [active, lon, lat]);

  useEffect(() => {
    if (!play || frames.length < 2 || !active) return;
    const t = setInterval(() => setI(n => (n + 1) % frames.length), 420);
    return () => clearInterval(t);
  }, [play, frames.length, active]);

  const src = frames[i];

  return (
    <div className="flex flex-col gap-2" data-testid="radar-player">
      <div className="relative aspect-[1.4/1] overflow-hidden rounded-xl bg-muted min-[840px]:aspect-[16/9]">
        {src ? (
          <img src={src} alt="RainViewer radar" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Radar loading…</div>
        )}
        {frames.map(url => (
          <img key={url} src={url} alt="" className="hidden" />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setPlay(p => !p)} data-testid="radar-play">
          {play ? 'Pause' : 'Play'}
        </Button>
        <p className="text-xs text-muted-foreground">Radar from RainViewer. Shows precipitation, not snow totals.</p>
      </div>
    </div>
  );
}
