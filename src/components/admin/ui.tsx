import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { controlBase } from '@/components/ui/field';

// Admin sahifalari uchun umumiy bloklar — kassa dizayn tizimi asosida.
export { PageHeader, StatCard } from '@/components/ui/kit';

export function Panel({ title, subtitle, actions, children, className, padded = true }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={cn('anim-rise rounded-xl border border-line bg-surface shadow-soft print-plain', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'p-4 sm:p-5' : (title || actions) ? 'pt-3' : undefined}>{children}</div>
    </section>
  );
}

/** Jadval: th 12px text-ink-3; td 14px py-3; telefonda gorizontal aylantirish faqat jadval ichida. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-3 [&_td]:py-3 [&_td]:text-ink sm:[&_td]:px-4 [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-ink-3 sm:[&_th]:px-4 [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-surface-2">
        {children}
      </table>
    </div>
  );
}

export function EmptyRow({ cols, text = 'Maʼlumot topilmadi' }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-12 text-center text-[13px] text-ink-3">{text}</td>
    </tr>
  );
}

/** GET-forma asosidagi filtrlar paneli (URL'da saqlanadi). */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <form method="get" className="no-print mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface p-3 shadow-soft [&_input]:h-9 [&_select]:h-9">
      {children}
      <button type="submit" className="h-9 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-fg shadow-soft hover:opacity-90">Filtrlash</button>
      <Link href={resetHref} className="flex h-9 items-center rounded-lg px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">Tozalash</Link>
    </form>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-ink-3">
      {label}
      {children}
    </label>
  );
}

export const inputSm = cn(controlBase, 'w-auto');
