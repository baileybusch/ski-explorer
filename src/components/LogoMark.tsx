import { BRAND, type Brand } from '@/lib/brand';

type MarkProps = { className?: string };

/** Minimal monochrome mountain mark. Slate via currentColor. */
export function ScopeMark({ className = 'size-7' }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M3.5 24.5 16 6.5l12.5 18H3.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M10 24.5 16 14l6 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M16 3.5v3.2M16 9.8v1.4M12.6 7.2l1.3 1.3M18.1 8.5l1.3-1.3M12.6 11.6l1.3-1.3M18.1 10.3l1.3 1.3"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Same geometry as public/brand/powtracker.svg (favicon) and powtracker-mark.svg. */
const POW_BODIES = 'M4.5 19.9H10.5V26.5Q10.5 27.5 9.5 27.5H5.5Q4.5 27.5 4.5 26.5Z M13 14.4H19V26.5Q19 27.5 18 27.5H14Q13 27.5 13 26.5Z M21.5 8.4H27.5V26.5Q27.5 27.5 26.5 27.5H22.5Q21.5 27.5 21.5 26.5Z';
const POW_CAPS = 'M3.7 19.9C3.7 16.9 5.1 16 7.5 16S11.3 16.9 11.3 19.9Z M12.2 14.4C12.2 11.4 13.6 10.5 16 10.5S19.8 11.4 19.8 14.4Z M20.7 8.4C20.7 5.4 22.1 4.5 24.5 4.5S28.3 5.4 28.3 8.4Z';
const POW_FLAKE = 'M7.5 4.7L7.5 12.1M10.7 6.55L4.3 10.25M10.7 10.25L4.3 6.55';
const POW_FLAKE_TICKS = 'M7.5 10.55L8.53 11.41M7.5 10.55L6.47 11.41M5.64 9.47L5.41 10.8M5.64 9.47L4.37 9.01M5.64 7.33L4.37 7.79M5.64 7.33L5.41 6M7.5 6.25L6.47 5.39M7.5 6.25L8.53 5.39M9.36 7.33L9.59 6M9.36 7.33L10.63 7.79M9.36 9.47L10.63 9.01M9.36 9.47L9.59 10.8';

/**
 * PowTracker: three ranked bars (the leaderboard), each wearing a pillow of new snow,
 * plus a snowflake in the open corner. Bars and caps carry it at 16px; the flake's ticks
 * only resolve from ~32px up.
 */
export function PowMark({ className = 'size-7' }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d={POW_BODIES} fill="currentColor" fillOpacity="0.4" />
      <path d={POW_CAPS} fill="currentColor" />
      <path d={POW_FLAKE} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d={POW_FLAKE_TICKS} stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

export function LogoMark({ className = 'size-7', brand = BRAND }: MarkProps & { brand?: Brand }) {
  return brand.mark === 'pow' ? <PowMark className={className} /> : <ScopeMark className={className} />;
}
