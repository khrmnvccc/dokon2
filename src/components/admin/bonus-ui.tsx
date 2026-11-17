'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SiteSettings } from '@/lib/settings-schema';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { adjustBonus } from '@/lib/actions/admin/bonus';
import { Panel } from './ui';
import { NumField, SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

export function BonusSettings({ initial, canEdit }: { initial: SiteSettings['bonus']; canEdit: boolean }) {
  const s = useSection('bonus', initial);
  const v = s.value;
  const set = (p: Partial<typeof v>) => s.setValue({ ...v, ...p });
  return (
    <Panel title="Sozlamalar" subtitle="Bonus buyurtma “Yetkazildi” boʻlganda tushadi; bekor yoki qaytarilsa avtomatik qaytariladi">
      <SwitchRow label="Keshbekni yoqish" checked={v.enabled} onChange={(x) => set({ enabled: x })} disabled={!canEdit} />
      <div className="grid grid-cols-2 gap-3 py-3">
        <Field label="Keshbek foizi">
          <div className="relative">
            <Input inputMode="decimal" value={String(v.earn_percent)} onChange={(e) => set({ earn_percent: Math.min(100, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) })} className="pr-10" />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">%</span>
          </div>
        </Field>
        <NumField label="Minimal buyurtma" hint="keshbek uchun" value={v.min_order} onChange={(x) => set({ min_order: x })} suffix="soʻm" />
      </div>
      <SwitchRow label="Bonus bilan toʻlash" hint="Checkout’da “Bonus bilan toʻlash” tugmasi" checked={v.spend_enabled} onChange={(x) => set({ spend_enabled: x })} disabled={!canEdit} />
      {v.spend_enabled && (
        <div className="grid grid-cols-2 gap-3 py-3">
          <NumField label="Buyurtmaning koʻpi bilan" value={v.max_spend_percent} onChange={(x) => set({ max_spend_percent: x })} min={1} max={100} suffix="%" />
          <NumField label="Kamida balans" value={v.min_balance} onChange={(x) => set({ min_balance: x })} suffix="soʻm" />
        </div>
      )}
      <SwitchRow label="Mahsulot sahifasida “+X soʻm keshbek”" checked={v.show_on_product} onChange={(x) => set({ show_on_product: x })} disabled={!canEdit} />
      <p className="mt-2 text-xs text-ink-3">Mijozga xabar: <Link href="/admin/messages" className="text-primary">Telegram → Xabarlar va Push → Mijozga</Link> → “Keshbek tushdi”. Mijoz balansni Profil → Bonuslarim’da koʻradi.</p>
      {canEdit ? <SaveBar pending={s.pending} onSave={() => s.save()} /> : <p className="mt-3 text-xs text-ink-3">Oʻzgartirish uchun “Sozlamalar” ruxsati kerak.</p>}
    </Panel>
  );
}

export function BonusAdjust() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [clientNo, setClientNo] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const submit = (sign: 1 | -1) => start(async () => {
    const res = await adjustBonus({ clientNo: Number(clientNo), amount: sign * Number(amount.replace(/\D/g, '')), note });
    if (!res.ok) { toast(res.error, 'error'); return; }
    toast(res.message ?? 'Saqlandi');
    setAmount(''); setNote('');
    router.refresh();
  });
  return (
    <Panel title="Qoʻlda bonus" subtitle="Mijoz ID raqami (profilidagi) boʻyicha">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mijoz ID"><Input inputMode="numeric" value={clientNo} onChange={(e) => setClientNo(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="Summa (soʻm)"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="Izoh" className="col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Masalan: tugʻilgan kun sovgʻasi" /></Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" loading={pending} disabled={!clientNo || !amount} onClick={() => submit(1)}>+ Qoʻshish</Button>
        <Button size="sm" variant="secondary" disabled={pending || !clientNo || !amount} onClick={() => submit(-1)}>− Ayirish</Button>
      </div>
    </Panel>
  );
}
