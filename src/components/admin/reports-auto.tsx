'use client';

import type { SiteSettings } from '@/lib/settings-schema';
import { Panel } from './ui';
import { NumField, SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

/** Hisobotlar → Avtomatik hisobot: admin botiga kunlik / haftalik / oylik hisobot. */
export function ReportsAutoSettings({ initial }: { initial: SiteSettings['reports_auto'] }) {
  const s = useSection('reports_auto', initial);
  const v = s.value;
  const set = (patch: Partial<typeof v>) => s.setValue({ ...v, ...patch });
  return (
    <Panel title="Avtomatik hisobot (Telegram)" subtitle="Admin botida faqat sizga keladi. Matni: Telegram → Xabarlar va Push">
      <SwitchRow label="Kunlik (kechki) hisobot" hint="Bugungi savdo, foyda, eng koʻp sotilganlar, kam qolganlar" checked={v.daily} onChange={(x) => set({ daily: x })} />
      <SwitchRow label="Haftalik hisobot" hint="Har dushanba — oʻtgan hafta, oldingi haftaga nisbatan" checked={v.weekly} onChange={(x) => set({ weekly: x })} />
      <SwitchRow label="Oylik hisobot" hint="Oyning 1-kuni — oʻtgan oy, oldingi oyga nisbatan" checked={v.monthly} onChange={(x) => set({ monthly: x })} />
      <div className="grid gap-3 pt-3 sm:grid-cols-2">
        <NumField label="Yuborish vaqti (Toshkent)" value={v.daily_hour} onChange={(x) => set({ daily_hour: x })} max={23} suffix=":00" />
        <NumField label="Eng koʻp sotilganlar" hint="0 — koʻrsatilmaydi" value={v.top_count} onChange={(x) => set({ top_count: x })} max={10} suffix="ta" />
      </div>
      <SaveBar pending={s.pending} onSave={() => s.save()} />
    </Panel>
  );
}
