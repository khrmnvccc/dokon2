'use client';

import type { ReactNode } from 'react';
import { Toggle } from '@/components/ui/kit';
import { Field, Input } from '@/components/ui/field';

/** Sozlama qatori: nomi, izohi va oʻng tomonda yoqish/oʻchirish. */
export function SwitchRow({ label, hint, checked, onChange, disabled }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      </div>
      <Toggle label={typeof label === 'string' ? label : 'Yoqish'} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** Butun son maydoni (soʻm, soat, dona). */
export function NumField({ label, hint, value, onChange, min = 0, max, suffix, error }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string; error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="relative">
        <Input inputMode="numeric" value={Number.isFinite(value) ? String(value) : ''}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^\d]/g, '') || 0);
            onChange(max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n));
          }}
          className={suffix ? 'pr-14' : undefined} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">{suffix}</span>}
      </div>
    </Field>
  );
}
