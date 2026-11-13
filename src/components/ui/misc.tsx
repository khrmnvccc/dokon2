import type { ReactNode } from 'react';
import Link from 'next/link';
import { Inbox, Star } from 'lucide-react';
import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

// Kassa Badge tonlari: neutral | cash | card | yandex | pochta | danger | success | warn.
// Eski nomlar (gray, green, red, amber, blue, brand, violet, accent) shu tonlarga bog'langan.
export type BadgeTone = 'neutral' | 'cash' | 'card' | 'yandex' | 'pochta' | 'danger' | 'success' | 'warn'
  | 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'brand' | 'violet' | 'accent';

const mix = (v: string, bg: number, border: number) =>
  `bg-[color-mix(in_srgb,var(--${v})_${bg}%,transparent)] text-ink border-[color-mix(in_srgb,var(--${v})_${border}%,transparent)]`;

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  cash: mix('cash', 10, 30),
  card: mix('card', 10, 30),
  yandex: mix('yandex', 12, 35),
  pochta: mix('pochta', 10, 30),
  danger: 'bg-danger-soft text-danger border-[color-mix(in_srgb,var(--danger)_25%,transparent)]',
  success: 'bg-success-soft text-success border-[color-mix(in_srgb,var(--success)_25%,transparent)]',
  warn: 'bg-warn-soft text-warn border-[color-mix(in_srgb,var(--warn)_25%,transparent)]',
  gray: '', green: '', red: '', amber: '', blue: '', brand: '', violet: '',
  accent: 'bg-primary text-primary-fg border-transparent',
};
const ALIAS: Partial<Record<BadgeTone, BadgeTone>> = { gray: 'neutral', green: 'success', red: 'danger', amber: 'warn', blue: 'card', brand: 'card', violet: 'pochta' };

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  const t = ALIAS[tone] ?? tone;
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[t], className)}>{children}</span>;
}

export function Rating({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-ink-3', size === 'sm' ? 'text-xs' : 'text-sm')} aria-label={`Reyting ${value.toFixed(1)} / 5`}>
      <Star className={cn('fill-[var(--yandex)] text-[var(--yandex)]', size === 'sm' ? 'size-3.5' : 'size-4')} aria-hidden />
      <span className="font-semibold text-ink num">{value > 0 ? value.toFixed(1) : '—'}</span>
      {count !== undefined && <span className="num">({count})</span>}
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex', className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('size-4', i <= Math.round(value) ? 'fill-[var(--yandex)] text-[var(--yandex)]' : 'text-ink-3')} aria-hidden />
      ))}
    </span>
  );
}

/** Kassa EmptyState: ikon + matn + amal. */
export function EmptyState({ icon, title, text, action, plain }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode; plain?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center anim-fade', !plain && 'rounded-xl border border-line bg-surface shadow-soft')}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3 [&_svg]:size-5">
        {icon || <Inbox />}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[13px] text-ink-3">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Kassa Card: rounded-xl, border-line, bg-surface (shisha), shadow-soft, p-4 sm:p-5. */
export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn('rounded-xl border border-line bg-surface shadow-soft print-plain', padded && 'p-4 sm:p-5', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionHeader({ title, href, linkText }: { title: string; href?: string; linkText?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
      <h2 className="text-[19px] font-semibold tracking-tight text-ink sm:text-[22px]">{title}</h2>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-medium text-primary hover:underline">
          {linkText ?? 'Barchasi'} →
        </Link>
      )}
    </div>
  );
}

export function Pagination({ page, total, pageSize, makeHref }: { page: number; total: number; pageSize: number; makeHref: (page: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const items: (number | '…')[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) items.push(i);
    else if (items[items.length - 1] !== '…') items.push('…');
  }
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Sahifalar">
      {items.map((it, idx) =>
        it === '…' ? (
          <span key={`e${idx}`} className="px-2 text-ink-3">…</span>
        ) : (
          <Link
            key={it}
            href={makeHref(it)}
            aria-current={it === page ? 'page' : undefined}
            className={cn('flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium num transition-colors',
              it === page ? 'bg-primary text-primary-fg shadow-soft' : 'border border-line bg-surface text-ink shadow-soft hover:bg-surface-2')}
          >
            {it}
          </Link>
        ),
      )}
    </nav>
  );
}
