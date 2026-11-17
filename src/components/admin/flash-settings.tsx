'use client';

import Link from 'next/link';
import type { SiteSettings } from '@/lib/settings-schema';
import { Field, Input } from '@/components/ui/field';
import { Panel } from './ui';
import { SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

/** Marketing → Aksiyalar: flash sale qayerda koʻrinishi va kimga xabar ketishi. */
export function FlashSettings({ initial, canEdit }: { initial: SiteSettings['flash_sale']; canEdit: boolean }) {
  const s = useSection('flash_sale', initial);
  const v = s.value;
  const set = (p: Partial<typeof v>) => s.setValue({ ...v, ...p });
  return (
    <Panel title="⚡ Flash sale" subtitle="Aksiyani tahrirlashda “Flash sale” belgisini qoʻying va tugash vaqtini kiriting" className="mt-4">
      <div className="grid gap-x-6 sm:grid-cols-2">
        <div>
          <SwitchRow label="Bosh sahifada taymer" checked={v.show_home} onChange={(x) => set({ show_home: x })} disabled={!canEdit} />
          <SwitchRow label="Mahsulot sahifasida taymer" checked={v.show_product} onChange={(x) => set({ show_product: x })} disabled={!canEdit} />
          <SwitchRow label="Boshlanganda botdan xabar" hint="Aksiya xabarlarini oʻchirmagan obunachilarga bir marta (tunda emas)" checked={v.notify_bot} onChange={(x) => set({ notify_bot: x })} disabled={!canEdit} />
        </div>
        <div>
          <Field label="Taymer sarlavhasi"><Input value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={40} /></Field>
          <p className="mt-3 text-xs text-ink-3">
            Bot xabari: <Link href="/admin/messages" className="text-primary">Xabarlar va Push → Mijozga → “Flash sale boshlandi”</Link>.
            Kanalga post: <Link href="/admin/channel" className="text-primary">Telegram → Kanalga post</Link>.
          </p>
        </div>
      </div>
      {canEdit ? <SaveBar pending={s.pending} onSave={() => s.save()} /> : <p className="mt-3 text-xs text-ink-3">Oʻzgartirish uchun “Sozlamalar” ruxsati kerak.</p>}
    </Panel>
  );
}
