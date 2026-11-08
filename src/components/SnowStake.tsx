/**
 * Snow stake: solid = snow that fell, hatched = snow the model expects.
 * Both use one shared scale per view so lengths compare across rows.
 */
export function SnowStake({
  cm, max, kind, estimated = false, size = 'card',
}: {
  cm: number;
  max: number;
  kind: 'actual' | 'forecast';
  estimated?: boolean;
  size?: 'line' | 'row' | 'card' | 'featured' | 'hero';
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (cm / max) * 100)) : 0;
  const h = size === 'hero' ? 8 : size === 'featured' ? 7 : size === 'row' ? 6 : size === 'line' ? 3 : 5;
  return (
    <div
      className="relative w-full overflow-hidden rounded-[2px]"
      style={{ height: h, background: 'color-mix(in oklch, currentColor 12%, transparent)' }}
      data-testid={`stake-${kind}`}
      aria-hidden
    >
      {cm > 0 ? (
        <div
          className={`absolute inset-y-0 left-0 rounded-[2px] ${kind === 'forecast' ? 'stake-forecast' : 'stake-actual'}`}
          style={{ width: `max(${h}px, ${pct}%)`, opacity: kind === 'actual' && estimated ? 0.62 : 1 }}
        />
      ) : null}
    </div>
  );
}
