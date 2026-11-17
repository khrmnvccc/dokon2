'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Send, X } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { formatPrice } from '@/lib/format';
import { quoteTotal, type ImportQuote, type ImportStatus } from '@/lib/import-requests';
import { quoteImportRequest, rejectImportRequest, saveImportNote } from '@/lib/actions/admin/import-requests';
import { Panel } from './ui';
import { NumField } from './growth-ui';

/** Xodim: yuan kalkulyatori bilan narx berish, rad etish, ichki izoh. */
export function ImportQuoteForm({ id, status, quantity, quote, staffNote, title, canEdit, rate, servicePercent, defaultDays }: {
  id: string; status: ImportStatus; quantity: number; quote: ImportQuote | null; staffNote: string; title: string;
  canEdit: boolean; rate: number; servicePercent: number; defaultDays: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cny, setCny] = useState(0);
  const [cnyRate, setCnyRate] = useState(rate);
  const [v, setV] = useState({
    name: quote?.name || title, item_price: quote?.item_price ?? 0, service_fee: quote?.service_fee ?? 0, cargo_fee: quote?.cargo_fee ?? 0,
    quantity, days: quote?.days || defaultDays, note: quote?.note ?? '', staff_note: staffNote,
  });
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const open = status === 'new' || status === 'quoted';
  const total = quoteTotal(v, v.quantity);

  const applyCny = () => {
    const item = Math.round(cny * cnyRate);
    set({ item_price: item, service_fee: Math.round((item * v.quantity * servicePercent) / 100) });
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const res = await fn();
    if (!res.ok) { toast(res.error ?? 'Xatolik', 'error'); return; }
    toast(res.message ?? 'Saqlandi');
    router.refresh();
  });

  if (!canEdit || !open) {
    return (
      <Panel title="Ichki izoh">
        <Textarea rows={3} value={v.staff_note} onChange={(e) => set({ staff_note: e.target.value })} disabled={!canEdit} />
        {canEdit && <Button size="sm" className="mt-2" loading={pending} onClick={() => run(() => saveImportNote(id, v.staff_note))}>Saqlash</Button>}
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel title={status === 'quoted' ? 'Narxni yangilash' : 'Narx berish'} subtitle="Mijozga doʻkon boti orqali “Narx tayyor” xabari ketadi">
        <div className="mb-3 rounded-xl bg-surface-2 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3"><Calculator className="size-3.5" />Yuan kalkulyatori</p>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <NumField label="Narx (¥, 1 dona)" value={cny} onChange={setCny} />
            <NumField label="Kurs (soʻm)" value={cnyRate} onChange={setCnyRate} />
            <Button size="sm" variant="secondary" onClick={applyCny} disabled={!cny}>Qoʻyish</Button>
          </div>
          <p className="mt-1.5 text-xs text-ink-3">Xizmat haqi avtomatik {servicePercent}% qoʻyiladi — pastda oʻzgartirishingiz mumkin.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mahsulot nomi (mijozga)" className="sm:col-span-2"><Input value={v.name} onChange={(e) => set({ name: e.target.value })} maxLength={160} /></Field>
          <NumField label="1 dona narxi" value={v.item_price} onChange={(x) => set({ item_price: x })} suffix="soʻm" />
          <NumField label="Soni" value={v.quantity} onChange={(x) => set({ quantity: x })} min={1} max={100000} suffix="dona" />
          <NumField label="Xizmat haqi" value={v.service_fee} onChange={(x) => set({ service_fee: x })} suffix="soʻm" />
          <NumField label="Kargo" hint="0 — keyin alohida" value={v.cargo_fee} onChange={(x) => set({ cargo_fee: x })} suffix="soʻm" />
          <Field label="Kelish muddati"><Input value={v.days} onChange={(e) => set({ days: e.target.value })} maxLength={40} /></Field>
          <Field label="Mijozga izoh" className="sm:col-span-2"><Textarea rows={2} value={v.note} onChange={(e) => set({ note: e.target.value })} maxLength={600} /></Field>
          <Field label="Ichki izoh (mijoz koʻrmaydi)" className="sm:col-span-2"><Textarea rows={2} value={v.staff_note} onChange={(e) => set({ staff_note: e.target.value })} maxLength={1000} /></Field>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm">Jami: <b className="num text-lg">{formatPrice(total)}</b></p>
          <Button loading={pending} disabled={total <= 0} onClick={() => run(() => quoteImportRequest(id, v))}><Send className="size-4" />Narxni yuborish</Button>
        </div>
      </Panel>
      <Panel title="Rad etish">
        {rejecting ? (
          <>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: bu mahsulot kargo orqali taqiqlangan" maxLength={500} />
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="danger" loading={pending} disabled={!reason.trim()} onClick={() => run(() => rejectImportRequest(id, reason))}>Rad etish</Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Bekor</Button>
            </div>
          </>
        ) : <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}><X className="size-4" />Olib kela olmaymiz</Button>}
      </Panel>
    </div>
  );
}
