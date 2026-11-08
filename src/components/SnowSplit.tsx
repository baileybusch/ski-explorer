import { fmtIn } from '../../lib/util.js';
import { snowAmount, type SnowUnits } from '@/lib/format';

export function dumpAria(name: string, pastCm: number, nextCm: number, units: SnowUnits, estimated = false) {
  const est = estimated ? ' estimated' : '';
  return `${name}, ${snowAmount(pastCm, units)}${est} last 72 hours, ${snowAmount(nextCm, units)} forecast next 7 days`;
}

function statNum(cm: number, units: SnowUnits) {
  if (units === 'cm') return Math.round(cm);
  return fmtIn(cm);
}

export function SnowSplit({
  pastCm, nextCm, units, size = 'card', estimated = false,
}: {
  pastCm: number;
  nextCm: number;
  units: SnowUnits;
  size?: 'card' | 'featured' | 'hero';
  estimated?: boolean;
}) {
  const unit = units === 'cm' ? 'cm' : '″';
  const past = statNum(pastCm, units);
  const next = statNum(nextCm, units);
  const font = size === 'hero'
    ? 'clamp(2.6rem, 9vw, 4.2rem)'
    : size === 'featured'
      ? 'clamp(2rem, 6vw, 3.1rem)'
      : '1.65rem';
  const label = size === 'hero'
    ? 'text-xs tracking-wide'
    : size === 'featured'
      ? 'text-[10px] tracking-wide'
      : 'text-[9px] tracking-normal';
  return (
    <div
      className="grid w-full min-w-0 grid-cols-2 gap-x-3"
      data-testid="snow-split"
      data-estimated={estimated ? '1' : '0'}
    >
      <div className="min-w-0" data-testid="snow-actual-col">
        <div className={`whitespace-nowrap uppercase opacity-60 ${label}`} data-testid="snow-actual-label">
          Last 72h{estimated ? <span className="normal-case tracking-normal opacity-80"> est.</span> : null}
        </div>
        <div
          className={`font-display tabular-nums leading-none ${estimated ? 'opacity-90' : ''}`}
          style={{ fontSize: font }}
          data-testid="snow-actual"
        >
          {past}<span className="text-[0.38em]">{unit}</span>
        </div>
      </div>
      <div className="min-w-0 border-l border-current/15 pl-3" data-testid="snow-forecast-col">
        <div className={`whitespace-nowrap uppercase opacity-60 ${label}`} data-testid="snow-forecast-label">
          Next 7 days
        </div>
        <div className="font-display tabular-nums leading-none" style={{ fontSize: font }} data-testid="snow-forecast">
          {next}<span className="text-[0.38em]">{unit}</span>
        </div>
      </div>
    </div>
  );
}
