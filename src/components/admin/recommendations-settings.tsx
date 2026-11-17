'use client';

import type { SiteSettings } from '@/lib/settings-schema';
import { Field, Input } from '@/components/ui/field';
import { Panel } from './ui';
import { NumField, SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

/** Sozlamalar → Tavsiyalar: mahsulot sahifasi va savatchadagi tavsiya bloklari. */
export function RecommendationsTab({ initial }: { initial: SiteSettings['recommendations'] }) {
  const s = useSection('recommendations', initial);
  const v = s.value;
  const set = (patch: Partial<typeof v>) => s.setValue({ ...v, ...patch });
  return (
    <Panel title="Tavsiyalar" subtitle="Mijozga yana nima olish mumkinligini koʻrsatadi — oʻrtacha chekni oshiradi">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Mahsulot sahifasi</p>
      <SwitchRow label="“Bunga oʻxshash”" hint="Shu kategoriyadagi eng koʻp sotilganlar" checked={v.similar_enabled} onChange={(x) => set({ similar_enabled: x })} />
      {v.similar_enabled && (
        <div className="grid gap-3 pb-3 sm:grid-cols-[1fr_160px]">
          <Field label="Sarlavha"><Input value={v.similar_title} maxLength={60} onChange={(e) => set({ similar_title: e.target.value })} /></Field>
          <NumField label="Nechta" value={v.similar_limit} onChange={(x) => set({ similar_limit: x })} min={2} max={20} suffix="ta" />
        </div>
      )}
      <SwitchRow label="“Birga olinadi”" hint="Shu mahsulot bilan bitta buyurtmada koʻp olinganlar (oxirgi 1 yil savdosi). Kamida 2 ta boʻlsa chiqadi" checked={v.together_enabled} onChange={(x) => set({ together_enabled: x })} />
      {v.together_enabled && (
        <div className="grid gap-3 pb-3 sm:grid-cols-[1fr_160px]">
          <Field label="Sarlavha"><Input value={v.together_title} maxLength={60} onChange={(e) => set({ together_title: e.target.value })} /></Field>
          <NumField label="Nechta" value={v.together_limit} onChange={(x) => set({ together_limit: x })} min={2} max={20} suffix="ta" />
        </div>
      )}
      <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Savatcha</p>
      <SwitchRow label="“Bunga qoʻshib oling”" hint="Savatdagi mahsulotlar bilan birga olinadiganlar" checked={v.cart_enabled} onChange={(x) => set({ cart_enabled: x })} />
      {v.cart_enabled && (
        <div className="pb-3"><Field label="Sarlavha"><Input value={v.cart_title} maxLength={60} onChange={(e) => set({ cart_title: e.target.value })} /></Field></div>
      )}
      <SwitchRow label="Savdo kam boʻlsa — xitlar bilan toʻldirish" hint="Hali yetarli buyurtma boʻlmasa, savatchada eng koʻp sotilganlar chiqadi" checked={v.fill_with_popular} onChange={(x) => set({ fill_with_popular: x })} />
      <p className="mt-2 text-xs text-ink-3">Ruscha sarlavhalar: Sozlamalar → Tarjimalar (ruscha).</p>
      <SaveBar pending={s.pending} onSave={() => s.save()} />
    </Panel>
  );
}
