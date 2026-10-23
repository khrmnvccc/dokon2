import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/components/ui/cn';

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-ink">← {back.label}</Link>}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn('rounded-xl border border-line bg-white', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={padded ? 'p-4 sm:p-5' : undefined}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums tracking-tight', tone === 'warn' && 'text-amber-600', tone === 'bad' && 'text-red-600')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Jadval: mobilda gorizontal scroll */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted [&_thead]:bg-slate-50 [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-slate-50/60">
        {children}
      </table>
    </div>
  );
}

export function EmptyRow({ cols, text = 'Ma’lumot topilmadi' }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-12 text-center text-muted">{text}</td>
    </tr>
  );
}

/** GET-forma asosidagi filtrlar paneli (URL'da saqlanadi, sahifani yangilasa ham qoladi) */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3 [&_input]:h-10 [&_select]:h-10">
      {children}
      <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">Filtrlash</button>
      <Link href={resetHref} className="flex h-10 items-center rounded-lg px-3 text-sm text-muted hover:bg-slate-100">Tozalash</Link>
    </form>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

export const inputSm = 'rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none';
