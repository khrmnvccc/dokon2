import type { ReactNode } from 'react';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-8 lg:!border-0 lg:!bg-transparent lg:!p-0 lg:!shadow-none">
      <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      <div className="mt-6">{children}</div>
      {footer && <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-3">{footer}</div>}
    </div>
  );
}
