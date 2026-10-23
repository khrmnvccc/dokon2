import type { ReactNode } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

export function Badge({ children, tone = 'gray', className }: { children: ReactNode; tone?: 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'brand' | 'violet' | 'accent'; className?: string }) {
  const tones = {
    gray: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-800',
    blue: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
    brand: 'bg-brand-50 text-brand-700',
    accent: 'bg-accent text-white',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function Rating({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-muted', size === 'sm' ? 'text-xs' : 'text-sm')} aria-label={`Reyting ${value.toFixed(1)} / 5`}>
      <Star className={cn('fill-amber-400 text-amber-400', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden />
      <span className="font-semibold text-ink">{value > 0 ? value.toFixed(1) : '—'}</span>
      {count !== undefined && <span>({count})</span>}
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex', className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('h-4 w-4', i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} aria-hidden />
      ))}
    </span>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-14 text-center shadow-card animate-fade-in">
      {icon && <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon}</div>}
      <h2 className="text-lg font-bold">{title}</h2>
      {text && <p className="mt-1.5 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl bg-white p-4 shadow-card sm:p-6', className)}>{children}</div>;
}

export function SectionHeader({ title, href, linkText }: { title: string; href?: string; linkText?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
      <h2 className="text-lg font-bold tracking-tight sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-brand hover:underline">
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
          <span key={`e${idx}`} className="px-2 text-muted">…</span>
        ) : (
          <Link
            key={it}
            href={makeHref(it)}
            aria-current={it === page ? 'page' : undefined}
            className={cn('flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold', it === page ? 'bg-brand text-white' : 'bg-white text-ink shadow-card hover:bg-slate-50')}
          >
            {it}
          </Link>
        ),
      )}
    </nav>
  );
}
