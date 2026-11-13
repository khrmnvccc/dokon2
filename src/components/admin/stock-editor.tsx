'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { adjustStock } from '@/lib/actions/admin/products';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/components/ui/cn';

export function StockEditor({ productId, variantId, stock, low }: { productId: string; variantId: string | null; stock: number; low: boolean }) {
  const [value, setValue] = useState(String(stock));
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const changed = value !== String(stock) && /^\d+$/.test(value);
  return (
    <form className="flex items-center gap-1.5" onSubmit={(e) => {
      e.preventDefault();
      if (!changed) return;
      start(async () => {
        const res = await adjustStock(productId, variantId, Number(value), 'Ombor sahifasi');
        toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
        router.refresh();
      });
    }}>
      <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} inputMode="numeric" aria-label="Qoldiq"
        className={cn('h-9 w-20 rounded-lg border px-2 text-right tabular-nums', low ? 'border-warn/40 bg-warn-soft font-semibold text-warn' : 'border-line', stock === 0 && 'border-danger/40 bg-danger-soft text-danger')} />
      <button type="submit" disabled={!changed || pending} className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-fg disabled:opacity-30" aria-label="Saqlash"><Check className="h-4 w-4" /></button>
    </form>
  );
}
