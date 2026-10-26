import { useEffect, useRef, useState } from 'react';
import { rainviewerMaps, radarPointUrl } from '@/lib/rainviewer';

export function RadarThumb({
  lon, lat, className, enabled,
}: {
  lon: number;
  lat: number;
  className?: string;
  enabled: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setOn(true); }, { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!on) return;
    let live = true;
    rainviewerMaps()
      .then(maps => {
        if (!live) return;
        setSrc(radarPointUrl(maps, lon, lat, 6));
      })
      .catch(() => { /* radar optional */ });
    return () => { live = false; };
  }, [on, lon, lat]);

  return (
    <div ref={box} className={className} data-testid="radar-thumb">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center text-[11px] opacity-60">Radar</div>
      )}
    </div>
  );
}
