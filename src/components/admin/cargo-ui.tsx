'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { updateCargo } from '@/lib/actions/admin/cargo';
import type { SiteSettings } from '@/lib/settings-schema';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Panel } from './ui';
import { SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

type Stage = SiteSettings['cargo']['stages'][number];
export const CARGO_ICON_LABEL: Record<Stage['icon'], string> = {
  warehouse: '🏭 Ombor', plane: '✈️ Samolyot', truck: '🚚 Mashina', border: '🛂 Chegara', customs: '📋 Bojxona', pin: '📍 Manzil', box: '📦 Quti', check: '✅ Tayyor',
};
const STATUS_LABEL = { none: 'Holat oʻzgarmaydi', shipped: '→ “Yoʻlda”', arrived: '→ “Oʻzbekistonda”' } as const;

/** Trek raqamlari roʻyxati boʻyicha ommaviy yangilash (bir partiya yuk). */
export function CargoBulkForm({ stages }: { stages: Stage[] }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stage, setStage] = useState(stages[0]?.key ?? '');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const tracks = [...new Set(text.split(/[\s,;]+/).map((t) => t.trim()).filter((t) => t.length >= 3))];
  return (
    <Panel title="Partiyani yangilash" subtitle="Trek raqamlarini qatorma-qator yoki vergul bilan kiriting (Excel’dan nusxalash mumkin)">
      <div className="grid gap-3">
        <Field label={`Trek raqamlari (${tracks.length} ta)`}>
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'YT1234567890\nYT1234567891'} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Yangi bosqich">
            <Select value={stage} onChange={(e) => setStage(e.target.value)}>
              {stages.map((s) => <option key={s.key} value={s.key}>{s.label}{s.status !== 'none' ? ` (${STATUS_LABEL[s.status]})` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Izoh (mijozga koʻrinadi)" hint="Ixtiyoriy. Masalan: 3–5 kunda Toshkentda"><Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        {missing.length > 0 && <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">Topilmadi: {missing.slice(0, 30).join(', ')}{missing.length > 30 ? ' …' : ''}</p>}
        <div className="flex justify-end">
          <Button loading={pending} disabled={!tracks.length || !stage} onClick={() => start(async () => {
            const res = await updateCargo({ tracks, stage, note: note || null });
            if (res.ok) { toast(res.message ?? 'Saqlandi'); setMissing(res.data?.missing ?? []); if (!res.data?.missing.length) setText(''); router.refresh(); }
            else toast(res.error, 'error');
          })}>Yangilash</Button>
        </div>
      </div>
    </Panel>
  );
}

/** Buyurtma sahifasida: shu buyurtma bosqichi. */
export function CargoOrderControl({ orderId, stages, current }: { orderId: string; stages: Stage[]; current: string | null }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const idx = stages.findIndex((s) => s.key === current);
  const [stage, setStage] = useState(stages[idx + 1]?.key ?? stages[idx]?.key ?? stages[0]?.key ?? '');
  const [note, setNote] = useState('');
  return (
    <div className="grid gap-2">
      <p className="text-sm">Hozir: <b>{idx >= 0 ? stages[idx].label : 'belgilanmagan'}</b></p>
      <div className="flex gap-2">
        <Select value={stage} onChange={(e) => setStage(e.target.value)} className="min-w-0 flex-1">
          {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
        <Button size="sm" loading={pending} onClick={() => start(async () => {
          const res = await updateCargo({ orderIds: [orderId], stage, note: note || null });
          if (res.ok) { toast(res.message ?? 'Saqlandi'); setNote(''); router.refresh(); } else toast(res.error, 'error');
        })}>Saqlash</Button>
      </div>
      <Input value={note} maxLength={300} placeholder="Izoh (ixtiyoriy, mijozga koʻrinadi)" onChange={(e) => setNote(e.target.value)} />
    </div>
  );
}

/** Kargo sozlamalari: bosqichlar, xabar, kuzatish havolasi. */
export function CargoSettings({ initial }: { initial: SiteSettings['cargo'] }) {
  const s = useSection('cargo', initial);
  const v = s.value;
  const set = (patch: Partial<typeof v>) => s.setValue({ ...v, ...patch });
  const setStage = (i: number, patch: Partial<Stage>) => set({ stages: v.stages.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, d: number) => {
    const next = [...v.stages];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    set({ stages: next });
  };
  const addStage = () => {
    let n = v.stages.length + 1;
    while (v.stages.some((x) => x.key === `stage_${n}`)) n++;
    set({ stages: [...v.stages, { key: `stage_${n}`, label: 'Yangi bosqich', icon: 'box', status: 'none' }] });
  };
  return (
    <Panel title="Sozlamalar">
      <SwitchRow label="Kargo bosqichlarini mijozga koʻrsatish" hint="Buyurtma sahifasida va “Buyurtmani kuzatish”da yuk yoʻli chiqadi" checked={v.enabled} onChange={(x) => set({ enabled: x })} />
      <SwitchRow label="Har bosqichda botdan xabar" hint="Matni: Telegram → Xabarlar → Mijozga → “Yuk qayerda”" checked={v.notify} onChange={(x) => set({ notify: x })} />
      <SwitchRow label="Faqat trek raqami bilan kuzatish" hint="“Buyurtmani kuzatish” sahifasida telefonsiz, trek raqami bilan (shaxsiy maʼlumot koʻrsatilmaydi)" checked={v.track_by_number} onChange={(x) => set({ track_by_number: x })} />
      <div className="py-3">
        <Field label="Tashuvchi saytidagi kuzatish havolasi" hint="Ixtiyoriy. {{trek}} oʻrniga trek raqami qoʻyiladi, masalan https://t.17track.net/uz#nums={{trek}}">
          <Input value={v.carrier_url} maxLength={300} onChange={(e) => set({ carrier_url: e.target.value })} placeholder="https://…{{trek}}" />
        </Field>
      </div>
      <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Bosqichlar (tartib bilan)</p>
      <ul className="space-y-2">
        {v.stages.map((st, i) => (
          <li key={i} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[auto_1fr_150px_170px_auto] sm:items-center">
            <div className="flex gap-1">
              <Button type="button" size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yuqoriga"><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="ghost" disabled={i === v.stages.length - 1} onClick={() => move(i, 1)} aria-label="Pastga"><ArrowDown className="h-4 w-4" /></Button>
            </div>
            <Input value={st.label} maxLength={60} onChange={(e) => setStage(i, { label: e.target.value })} aria-label="Nomi" />
            <Select value={st.icon} onChange={(e) => setStage(i, { icon: e.target.value as Stage['icon'] })} aria-label="Belgi">
              {Object.entries(CARGO_ICON_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Select value={st.status} onChange={(e) => setStage(i, { status: e.target.value as Stage['status'] })} aria-label="Buyurtma holati">
              {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Button type="button" size="icon" variant="ghost" disabled={v.stages.length <= 1} onClick={() => set({ stages: v.stages.filter((_, j) => j !== i) })} aria-label="Oʻchirish"><Trash2 className="h-4 w-4 text-danger" /></Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={v.stages.length >= 15} onClick={addStage}><Plus className="h-4 w-4" /> Bosqich qoʻshish</Button>
      <SaveBar pending={s.pending} onSave={() => s.save()} />
    </Panel>
  );
}
