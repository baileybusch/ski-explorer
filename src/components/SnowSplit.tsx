import { fmtIn } from '../../lib/util.js';
import { snowAmount, type SnowUnits } from '@/lib/format';
import { SnowStake } from '@/components/SnowStake';

export function dumpAria(name: string, pastCm: number, nextCm: number, units: SnowUnits, estimated = false) {
  const est = estimated ? ' estimated' : '';
  return `${name}, ${snowAmount(pastCm, units)}${est} last 72 hours, ${snowAmount(nextCm, units)} forecast next 7 days`;
}

export function statNum(cm: number, units: SnowUnits) {
  if (units === 'cm') return Math.round(cm);
  return fmtIn(cm);
}

/** Inch mark set like a prime against the cap height, not trailing on the baseline. */
export function Unit({ units }: { units: SnowUnits }) {
  return (
    <span className="ml-[0.05em] inline-block align-top font-sans text-[0.4em] font-semibold leading-none" style={{ marginTop: '0.08em' }}>
      {units === 'cm' ? 'cm' : '″'}
    </span>
  );
}

const SIZES = {
  card: { num: '1.75rem', label: 'text-[10px] min-[360px]:text-[11px]', gap: 'gap-x-2.5' },
  featured: { num: 'clamp(2.25rem, 9vw, 3rem)', label: 'text-xs', gap: 'gap-x-4' },
  hero: { num: 'clamp(3rem, 12vw, 4.5rem)', label: 'text-sm', gap: 'gap-x-6' },
} as const;

/**
 * Actual (last 72h) and forecast (next 7 days) with equal weight: same size,
 * same position, same stake scale. Only the stake texture differs.
 */
export function SnowSplit({
  pastCm, nextCm, units, size = 'card', estimated = false, max,
}: {
  pastCm: number;
  nextCm: number;
  units: SnowUnits;
  size?: 'card' | 'featured' | 'hero';
  estimated?: boolean;
  /** Shared stake scale in cm. Omit to hide stakes. */
  max?: number;
}) {
  const s = SIZES[size];
  const estAfterNumber = size === 'card';
  return (
    <div
      className={`grid w-full min-w-0 grid-cols-2 ${s.gap}`}
      data-testid="snow-split"
      data-estimated={estimated ? '1' : '0'}
    >
      <div className="flex min-w-0 flex-col gap-1" data-testid="snow-actual-col">
        <div className={`truncate opacity-70 ${s.label}`} data-testid="snow-actual-label">
          Last 72h{estimated && !estAfterNumber ? <span className="opacity-75"> est.</span> : null}
        </div>
        <div className="flex min-w-0 items-baseline gap-1">
          <span className="font-display tabular shrink-0 whitespace-nowrap leading-[0.9]" style={{ fontSize: s.num }} data-testid="snow-actual">
            {statNum(pastCm, units)}<Unit units={units} />
          </span>
          {estimated && estAfterNumber ? <span className="shrink-0 text-[9px] opacity-60 min-[360px]:text-[10px]">est.</span> : null}
        </div>
        {max != null ? <SnowStake cm={pastCm} max={max} kind="actual" estimated={estimated} size={size} /> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1" data-testid="snow-forecast-col">
        <div className={`truncate opacity-70 ${s.label}`} data-testid="snow-forecast-label">
          Next 7 days
        </div>
        <div className="flex items-baseline">
          <span className="font-display tabular whitespace-nowrap leading-[0.9]" style={{ fontSize: s.num }} data-testid="snow-forecast">
            {statNum(nextCm, units)}<Unit units={units} />
          </span>
        </div>
        {max != null ? <SnowStake cm={nextCm} max={max} kind="forecast" size={size} /> : null}
      </div>
    </div>
  );
}
