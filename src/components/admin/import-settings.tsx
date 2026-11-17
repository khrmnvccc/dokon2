'use client';

import Link from 'next/link';
import type { SiteSettings } from '@/lib/settings-schema';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Panel } from './ui';
import { NumField, SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

/** Savdo → Buyurtma asosida → Sozlamalar. */
export function ImportSettings({ initial, canEdit }: { initial: SiteSettings['import_requests']; canEdit: boolean }) {
  const s = useSection('import_requests', initial);
  const v = s.value;
  const set = (p: Partial<typeof v>) => s.setValue({ ...v, ...p });
  return (
    <Panel title="Sozlamalar" subtitle="Mijoz sahifasi: Profil → Xitoydan buyurtma (/account/requests)">
      <SwitchRow label="Xizmatni yoqish" hint="Oʻchirilsa mijozlar yangi soʻrov yubora olmaydi" checked={v.enabled} onChange={(x) => set({ enabled: x })} disabled={!canEdit} />
      <div className="grid gap-3 py-3">
        <Field label="Nomi"><Input value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={60} /></Field>
        <Field label="Mijozga tushuntirish"><Textarea rows={3} value={v.intro} onChange={(e) => set({ intro: e.target.value })} maxLength={600} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Yuan kursi" value={v.cny_rate} onChange={(x) => set({ cny_rate: x })} max={100000} suffix="soʻm" />
          <NumField label="Xizmat haqi" value={v.service_percent} onChange={(x) => set({ service_percent: x })} max={100} suffix="%" />
          <Field label="Kelish muddati"><Input value={v.default_days} onChange={(e) => set({ default_days: e.target.value })} maxLength={40} /></Field>
          <NumField label="Narx amal qiladi" value={v.quote_valid_days} onChange={(x) => set({ quote_valid_days: x })} min={1} max={30} suffix="kun" />
          <NumField label="Mijozda ochiq soʻrov" hint="koʻpi bilan" value={v.max_open} onChange={(x) => set({ max_open: x })} min={1} max={50} suffix="ta" />
        </div>
      </div>
      <p className="text-xs text-ink-3">Bot xabarlari: <Link href="/admin/messages" className="text-primary">Telegram → Xabarlar va Push</Link> → “Buyurtma asosida soʻrov” (xodimlarga) va “Narx tayyor” (mijozga).</p>
      {canEdit ? <SaveBar pending={s.pending} onSave={() => s.save()} /> : <p className="mt-3 text-xs text-ink-3">Oʻzgartirish uchun “Sozlamalar” ruxsati kerak.</p>}
    </Panel>
  );
}
