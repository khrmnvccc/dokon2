'use client';

// Kassa dizayn tizimining qolgan komponentlari (khrmnvccc/laylak-cargo-kassa src/components/ui.tsx dan).
import { useState, type ReactNode } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown, Minus, MoreHorizontal, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { cn } from './cn';
import { formatPrice } from '@/lib/format';

/** Server komponentdan funksiya uzatib boʻlmaydi — shuning uchun 'money' / 'number' satri ham qabul qilinadi. */
export type NumberFormat = 'money' | 'number' | ((n: number) => string);
export const applyFormat = (f: NumberFormat | undefined, n: number) =>
  typeof f === 'function' ? f(n) : f === 'money' ? formatPrice(n) : n.toLocaleString('ru-RU').replace(/\s/g, ' ');

export { Card, CardHeader, EmptyState, Badge, Skeleton } from './misc';

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** ↑12% / ↓5% oldingi davrga nisbatan. */
export function Delta({ current, previous, className }: { current: number; previous: number; className?: string }) {
  const change = percentChange(current, previous);
  if (change === null) return <span className={cn('text-xs font-medium text-ink-3', className)}>Yangi</span>;
  const rounded = Math.round(change * 10) / 10;
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium num', rounded > 0 ? 'text-up' : rounded < 0 ? 'text-down' : 'text-ink-3', className)}>
      <Icon className="size-3.5" />
      {Math.abs(rounded).toString().replace('.', ',')}%
    </span>
  );
}

/**
 * Sarlavha + izoh + o'ngda tugmalar/filtrlar. `collapse` bo'lsa telefonda tugmalar bitta "Amallar ⋯" menyusiga yig'iladi;
 * tugmalar DOMdan o'chmaydi (ular ochgan oynalar ishlashda davom etadi). Filtrlar doim ko'rinadi.
 */
export function PageHeader({ title, subtitle, description, actions, collapse, filters, back }: {
  title: string; subtitle?: ReactNode; description?: ReactNode; actions?: ReactNode; collapse?: boolean; filters?: ReactNode;
  back?: { href: string; label: string };
}) {
  const [open, setOpen] = useState(false);
  const menu = Boolean(collapse && actions);
  const sub = subtitle ?? description;
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className={cn('min-w-0', menu && 'flex items-start justify-between gap-3 sm:block')}>
        <div className="min-w-0">
          {back && <a href={back.href} className="mb-1 inline-block text-[13px] text-ink-3 hover:text-ink">← {back.label}</a>}
          <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
        </div>
        {menu && (
          <button type="button" aria-expanded={open} aria-label="Amallar" onClick={() => setOpen((v) => !v)}
            className={cn('no-print relative z-40 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium transition-colors sm:hidden',
              open ? 'bg-surface-2 text-ink' : 'bg-surface text-ink-2')}>
            Amallar<MoreHorizontal className="size-4" />
          </button>
        )}
      </div>
      {(actions || filters) && <div className="flex flex-wrap items-center gap-2">
        {filters && <div className="no-print flex flex-wrap items-center gap-2">{filters}</div>}
        {actions && (menu ? (
          <div className="relative max-sm:order-first max-sm:w-full sm:static">
            {open && <div className="fixed inset-0 z-30 sm:hidden" onClick={() => setOpen(false)} />}
            <div onClick={(e) => { if ((e.target as HTMLElement).closest('button, a')) setOpen(false); }}
              className={cn('no-print flex flex-wrap items-center gap-2',
                'max-sm:absolute max-sm:right-0 max-sm:-top-2 max-sm:z-40 max-sm:w-64 max-sm:flex-col max-sm:items-stretch max-sm:gap-1 max-sm:rounded-xl max-sm:border max-sm:border-line max-sm:bg-[var(--bg)] max-sm:p-1.5 max-sm:shadow-pop',
                'max-sm:[&_button]:w-full max-sm:[&_button]:justify-start max-sm:[&_a]:w-full max-sm:[&_a]:justify-start',
                !open && 'max-sm:hidden')}>
              {actions}
            </div>
          </div>
        ) : <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>)}
      </div>}
    </div>
  );
}

/** Katta raqam, ↑/↓ foiz, skeleton yuklanish. href bo'lsa butun karta havola. */
export function StatCard({ label, value, previous, hint, accent, loading, format, href, tone }: {
  label: string; value: number | ReactNode; previous?: number; hint?: ReactNode; accent?: string; loading?: boolean;
  format?: NumberFormat; href?: string; tone?: 'warn' | 'bad';
}) {
  const shown = typeof value === 'number' ? applyFormat(format, value) : value;
  const body = (
    <>
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        {accent && <span className="size-2 rounded-full" style={{ background: accent }} />}
        <span className="line-clamp-2">{label}</span>
        {href && <ChevronDown className="ml-auto size-4 -rotate-90 text-ink-3" />}
      </div>
      {loading ? <div className="skeleton mt-3 h-7 w-3/4" /> : (
        <div className={cn('mt-2 text-lg font-semibold tracking-tight num sm:text-2xl', tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-danger' : 'text-ink')}>{shown}</div>
      )}
      <div className="mt-1.5 flex min-h-5 items-center gap-2 text-xs text-ink-3">
        {!loading && previous !== undefined && typeof value === 'number' && <Delta current={value} previous={previous} />}
        {hint && <span className="line-clamp-2">{hint}</span>}
      </div>
    </>
  );
  const cls = 'anim-rise block min-w-0 rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-5';
  if (href) return <a href={href} className={cn(cls, 'transition-colors hover:bg-surface-2')}>{body}</a>;
  return <div className={cls}>{body}</div>;
}

/** iOS segment-control. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, label }: {
  value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; size?: 'md' | 'lg'; className?: string; label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 font-medium transition-all duration-150',
            size === 'lg' ? 'h-10 text-sm' : 'h-8 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-soft' : 'text-ink-3 hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** iOS switch 48×28: yoqilganda bg-success, oq dumaloq 20px siljiydi. */
export function Toggle({ checked, onChange, label, disabled, name }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean; name?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50',
        checked ? 'bg-success' : 'bg-surface-3')}>
      {name && <input type="hidden" name={name} value={checked ? 'on' : ''} />}
      <span className={cn('inline-block size-5 rounded-full bg-white shadow-soft transition-transform duration-200', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

export function Alert({ tone = 'danger', className, children }: { tone?: 'danger' | 'success' | 'warn'; className?: string; children: ReactNode }) {
  const map = { danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success', warn: 'bg-warn-soft text-warn' };
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={cn('flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] anim-fade', map[tone], className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="mt-px size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center anim-fade">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger"><AlertCircle className="size-5" /></div>
      <p className="text-sm font-medium text-ink">Maʼlumotni yuklab boʻlmadi</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-3">{message}</p>
      {onRetry && <Button className="mt-4" size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} onClick={onRetry}>Qayta urinish</Button>}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-3.5" style={{ width: `${c === 0 ? 18 : 100 / cols}%`, opacity: 1 - r * 0.12 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-semibold text-ink-2', size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-xs')}>
      {initials}
    </span>
  );
}
