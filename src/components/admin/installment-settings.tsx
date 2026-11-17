'use client';

import type { SiteSettings } from '@/lib/settings-schema';
import { Panel } from './ui';
import { SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

/** Yetkazish va toʻlov: boʻlib toʻlash mahsulot sahifasida koʻrinishi. Rejalar — toʻlov usulining oʻzida. */
export function InstallmentSettings({ initial, canEdit }: { initial: SiteSettings['installments']; canEdit: boolean }) {
  const s = useSection('installments', initial);
  return (
    <Panel title="Boʻlib toʻlash" subtitle="Toʻlov usulini tahrirlab “Boʻlib toʻlash usuli”ni yoqing va muddatlarni kiriting (Uzum Nasiya, Alif…)">
      <SwitchRow label="Mahsulot sahifasida “Oyiga …dan” koʻrsatish" checked={s.value.show_on_product} onChange={(x) => s.setValue({ show_on_product: x })} disabled={!canEdit} />
      {canEdit && <SaveBar pending={s.pending} onSave={() => s.save()} />}
    </Panel>
  );
}
