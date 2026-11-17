'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';

/** Mijoz: narxga rozi — toʻlov usulini tanlab buyurtma beradi; yoki soʻrovni bekor qiladi. */
export function ImportAccept({ id, canAccept, expired, methods }: { id: string; canAccept: boolean; expired: boolean; methods: { id: string; name: string; description: string | null }[] }) {
  const L = useL();
  const toast = useToast();
  const router = useRouter();
  const [method, setMethod] = useState(methods[0]?.id ?? '');
  const [busy, setBusy] = useState<'accept' | 'cancel' | null>(null);

  const act = async (action: 'accept' | 'cancel') => {
    if (action === 'cancel' && !window.confirm(L('Soʻrovni bekor qilasizmi?'))) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/import-requests/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action === 'accept' ? { action, paymentMethodId: method } : { action }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? L('Xatolik'));
      if (action === 'accept') {
        toast(L('Buyurtma qabul qilindi'));
        if (json.payUrl) { window.location.href = json.payUrl; return; }
        router.push(`/account/orders/${json.orderId}`);
      } else {
        toast(L('Soʻrov bekor qilindi'));
        router.refresh();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      {expired && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm">{L('Narx muddati tugagan. Doʻkon bilan bogʻlaning — yangilab beramiz.')}</p>}
      {canAccept && (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <p className="mb-2 font-semibold">{L('Toʻlov usuli')}</p>
          <div className="space-y-2">
            {methods.map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                className={cn('flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left', method === m.id ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2')}>
                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border', method === m.id ? 'border-primary bg-primary text-primary-fg' : 'border-line-strong')}>{method === m.id && <Check className="size-3.5" />}</span>
                <span className="min-w-0"><span className="block text-sm font-medium">{m.name}</span>{m.description && <span className="block text-xs text-ink-3">{m.description}</span>}</span>
              </button>
            ))}
          </div>
          <Button className="mt-3 w-full" loading={busy === 'accept'} disabled={!method || busy !== null} onClick={() => act('accept')}>{L('Roziman, buyurtma berish')}</Button>
        </div>
      )}
      <button type="button" disabled={busy !== null} onClick={() => act('cancel')} className="w-full rounded-xl py-2.5 text-sm font-medium text-danger hover:bg-danger-soft">{L('Soʻrovni bekor qilish')}</button>
    </section>
  );
}
