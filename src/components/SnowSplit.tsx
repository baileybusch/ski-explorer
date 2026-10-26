import { fmtIn } from '../../lib/util.js';
import { snowAmount, type SnowUnits } from '@/lib/format';

export function dumpAria(name: string, pastCm: number, nextCm: number, units: SnowUnits) {
  return `${name}, ${snowAmount(pastCm, units)} last 72 hours, plus ${snowAmount(nextCm, units)} forecast next 7 days`;
}

export function SnowSplit({
  pastCm, nextCm, units, size = 'card',
}: {
  pastCm: number;
  nextCm: number;
  units: SnowUnits;
  size?: 'card' | 'featured' | 'hero';
}) {
  const num = units === 'cm' ? Math.round(pastCm) : fmtIn(pastCm);
  const unit = units === 'cm' ? 'cm' : '″';
  const forecast = snowAmount(nextCm, units);
  const font = size === 'hero'
    ? 'clamp(4.6rem, 22vw, 7.2rem)'
    : size === 'featured'
      ? 'clamp(3rem, 11vw, 4.8rem)'
      : '1.75rem';
  return (
    <div className="min-w-0" data-testid="snow-split">
      <div className={`flex min-w-0 ${size === 'card' ? 'flex-col items-stretch gap-1.5' : 'flex-wrap items-end gap-2'}`}>
        <div className="min-w-0">
          <div className="font-display leading-none" style={{ fontSize: font }} data-testid="snow-actual">
            {num}<span className="text-[0.38em]">{unit}</span>
          </div>
          <div
            className={`mt-1 uppercase tracking-wide opacity-60 ${size === 'hero' ? 'text-sm' : 'text-[10px]'}`}
            data-testid="snow-actual-label"
          >
            last 72h
          </div>
        </div>
        <div
          className="w-fit rounded-full bg-accent px-2 py-1 leading-none text-accent-foreground"
          data-testid="snow-forecast"
        >
          <span className={`${size === 'hero' ? 'text-sm' : 'text-[11px]'} font-semibold`}>+{forecast} coming</span>
        </div>
      </div>
    </div>
  );
}
