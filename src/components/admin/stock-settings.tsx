'use client';

import type { SiteSettings } from '@/lib/settings-schema';
import { Panel } from './ui';
import { NumField, SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

/** Ombor → Sozlamalar: kam qoldiq ogohlantirishi va “Kelganda xabar ber”. */
export function StockSettings({ initial, canEdit }: { initial: SiteSettings['stock_alerts']; canEdit: boolean }) {
  const s = useSection('stock_alerts', initial);
  const v = s.value;
  const set = (patch: Partial<typeof v>) => s.setValue({ ...v, ...patch });
  return (
    <Panel title="Ogohlantirishlar" subtitle="Admin botiga va mijozlarga avtomatik xabarlar">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Xodimlarga (admin bot)</p>
      <SwitchRow label="Kam qoldi" hint="Qoldiq mahsulotdagi “Kam qoldiq chegarasi”dan tushganda" checked={v.low_alert} onChange={(x) => set({ low_alert: x })} disabled={!canEdit} />
      <SwitchRow label="Tugadi" hint="Qoldiq 0 boʻlganda" checked={v.out_alert} onChange={(x) => set({ out_alert: x })} disabled={!canEdit} />
      <SwitchRow label="Variantlar ham (rang, oʻlcham)" checked={v.include_variants} onChange={(x) => set({ include_variants: x })} disabled={!canEdit} />
      <SwitchRow label="Kechki hisobotda kam qolganlar roʻyxati" checked={v.in_daily_report} onChange={(x) => set({ in_daily_report: x })} disabled={!canEdit} />
      <div className="py-3"><NumField label="Yangi mahsulot uchun standart chegara" value={v.default_threshold} onChange={(x) => set({ default_threshold: x })} max={100000} suffix="dona" /></div>
      <p className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Mijozlarga (doʻkon boti)</p>
      <SwitchRow label="“Kelganda xabar ber”" hint="Mahsulot qayta kelganda kutayotganlarga botdan xabar. Matni: Telegram → Xabarlar → Mijozga → “Mahsulot qayta keldi”" checked={v.restock_enabled} onChange={(x) => set({ restock_enabled: x })} disabled={!canEdit} />
      <SwitchRow label="Mahsulot sahifasida tugma" hint="Tugagan mahsulotda “Kelganda xabar ber” tugmasi chiqadi" checked={v.restock_button} onChange={(x) => set({ restock_button: x })} disabled={!canEdit} />
      <SwitchRow label="Sevimlilarga qoʻshganlarga ham" hint="Mahsulotni ♥ qilganlar ham xabar oladi (aksiya xabarlarini oʻchirmaganlar)" checked={v.restock_wishlist} onChange={(x) => set({ restock_wishlist: x })} disabled={!canEdit} />
      {canEdit ? <SaveBar pending={s.pending} onSave={() => s.save()} /> : <p className="mt-3 text-xs text-ink-3">Oʻzgartirish uchun “Sozlamalar” ruxsati kerak.</p>}
    </Panel>
  );
}
