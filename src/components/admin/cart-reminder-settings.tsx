'use client';

import Link from 'next/link';
import type { SiteSettings } from '@/lib/settings-schema';
import { Field, Select } from '@/components/ui/field';
import { Panel } from './ui';
import { NumField, SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

/** Marketing → Savat eslatmasi: qachon, necha marta va qanday kupon bilan. */
export function CartReminderSettings({ initial, canEdit }: { initial: SiteSettings['cart_reminder']; canEdit: boolean }) {
  const s = useSection('cart_reminder', initial);
  const v = s.value;
  const set = (patch: Partial<typeof v>) => s.setValue({ ...v, ...patch });
  const c = v.coupon;
  const setC = (patch: Partial<typeof c>) => set({ coupon: { ...c, ...patch } });
  return (
    <Panel title="Sozlamalar" subtitle="Mijoz savatga qoʻshib, buyurtma bermasa — doʻkon botidan eslatma">
      <SwitchRow label="Savat eslatmasini yoqish" hint="Faqat doʻkon botiga ulangan va aksiya xabarlarini oʻchirmagan mijozlarga yuboriladi" checked={v.enabled} onChange={(x) => set({ enabled: x })} disabled={!canEdit} />
      <div className="grid gap-3 py-3 sm:grid-cols-2">
        <NumField label="1-eslatma: savatdan keyin" value={v.delay_hours} onChange={(x) => set({ delay_hours: x })} min={1} max={168} suffix="soat" />
        <NumField label="2-eslatma: 1-sidan keyin" hint="0 — ikkinchi eslatma yoʻq" value={v.second_after_hours} onChange={(x) => set({ second_after_hours: x })} max={336} suffix="soat" />
        <NumField label="Savat summasi kamida" hint="0 — har qanday savat" value={v.min_cart_total} onChange={(x) => set({ min_cart_total: x })} suffix="soʻm" />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Tunda yozmaslik: dan" value={v.quiet_from} onChange={(x) => set({ quiet_from: x })} max={23} suffix=":00" />
          <NumField label="gacha" value={v.quiet_to} onChange={(x) => set({ quiet_to: x })} max={23} suffix=":00" />
        </div>
      </div>
      <p className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Shaxsiy kupon</p>
      <SwitchRow label="Eslatma bilan kupon berish" hint="Har mijozga alohida, bir martalik kod. Faqat shu mijoz ishlata oladi" checked={c.enabled} onChange={(x) => setC({ enabled: x })} disabled={!canEdit} />
      {c.enabled && (
        <div className="grid gap-3 py-3 sm:grid-cols-2">
          <Field label="Qaysi eslatmada">
            <Select value={String(c.on_step)} onChange={(e) => setC({ on_step: Number(e.target.value) })}>
              <option value="1">1-eslatmada</option><option value="2">2-eslatmada (avval kuponsiz eslatamiz)</option>
            </Select>
          </Field>
          <Field label="Chegirma turi">
            <Select value={c.type} onChange={(e) => setC({ type: e.target.value as 'percent' | 'fixed', value: e.target.value === 'percent' ? Math.min(c.value, 100) : c.value })}>
              <option value="percent">Foiz (%)</option><option value="fixed">Summa (soʻm)</option>
            </Select>
          </Field>
          <NumField label="Chegirma" value={c.value} onChange={(x) => setC({ value: x })} min={1} max={c.type === 'percent' ? 100 : 100_000_000} suffix={c.type === 'percent' ? '%' : 'soʻm'} />
          {c.type === 'percent' && <NumField label="Eng koʻpi bilan" hint="0 — cheklovsiz" value={c.max_discount} onChange={(x) => setC({ max_discount: x })} suffix="soʻm" />}
          <NumField label="Minimal buyurtma" value={c.min_order} onChange={(x) => setC({ min_order: x })} suffix="soʻm" />
          <NumField label="Amal qilish muddati" value={c.days} onChange={(x) => setC({ days: x })} min={1} max={90} suffix="kun" />
        </div>
      )}
      <p className="mt-2 text-xs text-ink-3">
        Xabar matni, rasmi va tugmasi: <Link href="/admin/messages" className="text-primary">Telegram → Xabarlar va Push → Mijozga</Link> → “Savatda mahsulot qoldi” va “Savat eslatmasi + kupon”.
        Bir mijozga 2 kunda bittadan ortiq yangi eslatma ketmaydi. Fon ishi har 10 daqiqada tekshiradi.
      </p>
      {canEdit ? <SaveBar pending={s.pending} onSave={() => s.save()} /> : <p className="mt-3 text-xs text-ink-3">Oʻzgartirish uchun “Sozlamalar” ruxsati kerak.</p>}
    </Panel>
  );
}
