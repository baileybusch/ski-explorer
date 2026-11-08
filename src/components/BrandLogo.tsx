import { LogoMark } from '@/components/LogoMark';
import { BRAND, WORDMARK, type Brand, type WordmarkVariant } from '@/lib/brand';
import { cn } from '@/lib/utils';

type Size = 'header' | 'page' | 'footer';

const MARK: Record<Size, string> = { header: 'size-8', page: 'size-7', footer: 'size-6' };
const CAPS: Record<Size, string> = { header: 'text-xl', page: 'text-xl', footer: 'text-lg' };
const MIXED: Record<Size, string> = { header: 'text-[19px]', page: 'text-[19px]', footer: 'text-base' };

/**
 * caps: Barlow Condensed 800, the board's display face.
 * mixed: Sora, heavy prefix + medium suffix, for places the condensed caps feel shouty.
 * Brands with wordmarkSplit > 0 dim the suffix so the prefix carries the name.
 */
export function Wordmark({
  brand = BRAND, variant = WORDMARK, size = 'header', className,
}: { brand?: Brand; variant?: WordmarkVariant; size?: Size; className?: string }) {
  const text = brand.wordmark[variant];
  const split = brand.wordmarkSplit;
  const head = split ? text.slice(0, split) : text;
  const tail = split ? text.slice(split) : '';
  return (
    <span
      className={cn(
        'truncate leading-none',
        variant === 'caps' ? cn('font-display tracking-wide', CAPS[size]) : cn('font-sans tracking-[-0.02em]', MIXED[size]),
        className,
      )}
      data-testid="wordmark"
      data-brand={brand.id}
      data-variant={variant}
    >
      <span className={variant === 'mixed' ? 'font-bold' : undefined}>{head}</span>
      {tail ? <span className={cn('text-foreground/60', variant === 'mixed' && 'font-medium')}>{tail}</span> : null}
    </span>
  );
}

export function BrandLogo({
  brand = BRAND, variant = WORDMARK, size = 'header', className,
}: { brand?: Brand; variant?: WordmarkVariant; size?: Size; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)} data-testid="brand-logo" data-brand={brand.id}>
      <LogoMark brand={brand} className={cn(MARK[size], 'shrink-0')} />
      <Wordmark brand={brand} variant={variant} size={size} />
    </span>
  );
}
