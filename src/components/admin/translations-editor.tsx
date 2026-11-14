'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { ChevronDown, Languages, Search } from 'lucide-react';
import {
  loadSettingsTexts, loadTranslations, saveSettingsTexts, saveTranslation, type TranslationRow,
} from '@/lib/actions/admin/translations';
import type { SettingText } from '@/lib/i18n/settings-texts';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Textarea } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/misc';
import { Alert, Segmented } from '@/components/ui/kit';
import { cn } from '@/components/ui/cn';

type Section = 'settings' | 'categories' | 'products' | 'banners' | 'pages' | 'promotions' | 'shipping_methods' | 'payment_methods';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'settings', label: 'Sayt matnlari' },
  { value: 'categories', label: 'Kategoriyalar' },
  { value: 'products', label: 'Mahsulotlar' },
  { value: 'banners', label: 'Bannerlar' },
  { value: 'promotions', label: 'Aksiyalar' },
  { value: 'pages', label: 'Sahifalar' },
  { value: 'shipping_methods', label: 'Yetkazish' },
  { value: 'payment_methods', label: 'Toʻlov' },
];

const FIELD_LABELS: Record<string, string> = {
  name: 'Nomi', title: 'Sarlavha', subtitle: 'Kichik matn', button_text: 'Tugma matni', short_description: 'Qisqa tavsif',
  description: 'Tavsif', content: 'Matn', seo_title: 'SEO sarlavha', seo_description: 'SEO tavsif', eta: 'Muddat', instructions: 'Koʻrsatma',
};
const LONG = new Set(['description', 'content', 'short_description', 'seo_description', 'instructions']);

type RowStatus = 'done' | 'partial' | 'none';
function statusOf(uz: Record<string, string>, ru: Record<string, string>): RowStatus {
  const keys = Object.keys(uz).filter((k) => uz[k]?.trim());
  const done = keys.filter((k) => ru[k]?.trim()).length;
  return done === 0 ? 'none' : done === keys.length ? 'done' : 'partial';
}
const STATUS: Record<RowStatus, { label: string; tone: 'success' | 'warn' | 'neutral' }> = {
  done: { label: 'Tarjima qilingan', tone: 'success' }, partial: { label: 'Qisman', tone: 'warn' }, none: { label: 'Ruschasi yoʻq', tone: 'neutral' },
};

export function TranslationsEditor() {
  const [section, setSection] = useState<Section>('settings');
  return (
    <div className="space-y-4">
      <Alert tone="info">
        Saytda til <b>RU</b> tanlanganda shu yerdagi ruscha matnlar koʻrinadi. Ruschasi yozilmagan joyda oʻzbekchasi qoladi.
        Tugma, menyu va sahifa yozuvlari (savatcha, rasmiylashtirish va h.k.) oʻzi ruschaga oʻgiriladi — bu yerda faqat oʻzingiz kiritgan matnlar.
      </Alert>
      <Segmented<Section> label="Boʻlim" value={section} onChange={setSection} className="no-scrollbar max-w-full overflow-x-auto" options={SECTIONS} />
      {section === 'settings' ? <SettingsTexts key="settings" /> : <TableTexts key={section} table={section} />}
    </div>
  );
}

// ---------- Sayt matnlari (sozlamalar) ----------
function SettingsTexts() {
  const [rows, setRows] = useState<(SettingText & { group: string })[] | null>(null);
  const [ru, setRu] = useState<Record<string, string>>({});
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    loadSettingsTexts().then((r) => {
      if (!r.ok) { toast(r.error, 'error'); setRows([]); return; }
      setRows(r.data!.rows);
      setRu(Object.fromEntries(r.data!.rows.map((x) => [x.path, x.ru])));
    });
  }, [toast]);

  const groups = useMemo(() => {
    const m = new Map<string, (SettingText & { group: string })[]>();
    for (const r of rows ?? []) {
      if (onlyMissing && r.ru.trim()) continue;
      m.set(r.group, [...(m.get(r.group) ?? []), r]);
    }
    return [...m];
  }, [rows, onlyMissing]);

  if (!rows) return <p className="py-10 text-center text-sm text-ink-3">Yuklanmoqda…</p>;
  if (!rows.length) return <EmptyState plain title="Matn yoʻq" text="Sozlamalarda hali matn kiritilmagan." />;
  const done = rows.filter((r) => ru[r.path]?.trim()).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
        <span className="num">{done} / {rows.length} tarjima qilingan</span>
        <Checkbox label="Faqat ruschasi yoʻqlar" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
      </div>
      {groups.map(([group, items]) => (
        <section key={group} className="rounded-2xl border border-line bg-surface-solid">
          <h3 className="border-b border-line px-4 py-3 text-[13px] font-bold uppercase tracking-wide text-ink-2">{group}</h3>
          <div className="divide-y divide-line">
            {items.map((t) => (
              <PairField key={t.path} label={t.label} uz={t.uz} long={t.long} value={ru[t.path] ?? ''} onChange={(v) => setRu((x) => ({ ...x, [t.path]: v }))} />
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+76px)] z-10 flex justify-end lg:bottom-4">
        <Button loading={pending} className="shadow-pop" onClick={() => start(async () => {
          const r = await saveSettingsTexts(ru);
          toast(r.ok ? r.message ?? 'Saqlandi' : r.error, r.ok ? 'success' : 'error');
        })}>Saqlash</Button>
      </div>
    </div>
  );
}

/** Chapda oʻzbekchasi, oʻngda ruscha maydon (telefonda ustma-ust). */
function PairField({ label, uz, value, onChange, long }: { label: string; uz: string; value: string; onChange: (v: string) => void; long?: boolean }) {
  return (
    <div className="grid gap-2 px-4 py-3 md:grid-cols-2 md:gap-4">
      <div className="min-w-0">
        <div className="mb-1 text-xs font-medium text-ink-3">{label} · <span className="font-semibold">UZ</span></div>
        <p className={cn('whitespace-pre-wrap break-words rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2', long && 'max-h-40 overflow-y-auto')}>{uz}</p>
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-xs font-medium text-ink-3">{label} · <span className="font-semibold text-primary">RU</span></div>
        {long || uz.length > 90
          ? <Textarea rows={Math.min(10, Math.max(3, Math.ceil(uz.length / 70)))} value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} (ruscha)`} placeholder="Ruscha matn" />
          : <Input value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} (ruscha)`} placeholder="Ruscha matn" />}
      </div>
    </div>
  );
}

// ---------- Jadval yozuvlari ----------
function TableTexts({ table }: { table: Exclude<Section, 'settings'> }) {
  const [rows, setRows] = useState<TranslationRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const toast = useToast();

  const load = useCallback(async (offset: number) => {
    const r = await loadTranslations(table, query, offset);
    if (!r.ok) { toast(r.error, 'error'); setRows((x) => x ?? []); return; }
    setTotal(r.data!.total);
    setRows((x) => (offset ? [...(x ?? []), ...r.data!.rows] : r.data!.rows));
  }, [table, query, toast]);

  useEffect(() => { setRows(null); load(0); }, [load]);

  const shown = (rows ?? []).filter((r) => !onlyMissing || statusOf(r.uz, r.ru) !== 'done');
  const done = (rows ?? []).filter((r) => statusOf(r.uz, r.ru) === 'done').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {table === 'products' && (
          <form className="relative min-w-[220px] flex-1 sm:max-w-xs" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mahsulot nomi" aria-label="Qidirish"
              className="h-10 w-full rounded-xl border border-line bg-surface-solid pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-line-strong" />
          </form>
        )}
        <Checkbox label="Faqat tarjima qilinmaganlar" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
        {rows && <span className="text-sm text-ink-3 num">{table === 'products' ? `${done} / ${rows.length} (jami ${total})` : `${done} / ${rows.length}`} tarjima qilingan</span>}
      </div>
      {!rows ? <p className="py-10 text-center text-sm text-ink-3">Yuklanmoqda…</p> : !shown.length ? (
        <EmptyState plain title={rows.length ? 'Hammasi tarjima qilingan 🎉' : 'Hali yozuv yoʻq'} text="" />
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <RowEditor key={r.id} table={table} row={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)}
              onSaved={(ru, attributes) => setRows((x) => (x ?? []).map((y) => (y.id === r.id ? { ...y, ru, attributes: attributes && y.attributes ? { ...y.attributes, ru: attributes } : y.attributes } : y)))} />
          ))}
        </div>
      )}
      {table === 'products' && rows && rows.length < total && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loadingMore} onClick={async () => { setLoadingMore(true); await load(rows.length); setLoadingMore(false); }}>Yana koʻrsatish</Button>
        </div>
      )}
    </div>
  );
}

function RowEditor({ table, row, open, onToggle, onSaved }: {
  table: string; row: TranslationRow; open: boolean; onToggle: () => void; onSaved: (ru: Record<string, string>, attributes?: { name: string; value: string }[]) => void;
}) {
  const [ru, setRu] = useState(row.ru);
  const [attrs, setAttrs] = useState(row.attributes?.ru ?? []);
  const [pending, start] = useTransition();
  const toast = useToast();
  const st = statusOf(row.uz, row.ru);
  const fields = Object.keys(row.uz).filter((f) => row.uz[f]?.trim());

  return (
    <div className="rounded-2xl border border-line bg-surface-solid">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <Languages className="size-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{row.label || '—'}</span>
          {row.ru.name || row.ru.title ? <span className="block truncate text-xs text-ink-3">{row.ru.name || row.ru.title}</span> : null}
        </span>
        <Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge>
        <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line">
          <div className="divide-y divide-line">
            {fields.map((f) => (
              <PairField key={f} label={FIELD_LABELS[f] ?? f} uz={row.uz[f]} long={LONG.has(f)} value={ru[f] ?? ''} onChange={(v) => setRu((x) => ({ ...x, [f]: v }))} />
            ))}
            {row.attributes && row.attributes.uz.length > 0 && (
              <div className="px-4 py-3">
                <div className="mb-2 text-xs font-medium text-ink-3">Xususiyatlar (nomi va qiymati)</div>
                <div className="space-y-2">
                  {row.attributes.uz.map((a, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr] sm:items-center">
                      <span className="truncate text-sm text-ink-2">{a.name}</span>
                      <span className="truncate text-sm text-ink-2">{a.value}</span>
                      <Input aria-label={`${a.name} (ruscha nomi)`} placeholder="Nomi (RU)" value={attrs[i]?.name ?? ''} onChange={(e) => setAttrs((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                      <Input aria-label={`${a.value} (ruscha qiymati)`} placeholder="Qiymati (RU)" value={attrs[i]?.value ?? ''} onChange={(e) => setAttrs((x) => x.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-3">Hammasini toʻldiring — aks holda oʻzbekchasi koʻrinadi.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="ghost" onClick={onToggle}>Yopish</Button>
            <Button loading={pending} onClick={() => start(async () => {
              const fullAttrs = row.attributes && attrs.every((a) => a.name.trim() && a.value.trim()) ? attrs : row.attributes ? [] : undefined;
              const r = await saveTranslation(table, row.id, ru, fullAttrs);
              if (r.ok) { toast('Saqlandi', 'success'); onSaved(ru, fullAttrs); } else toast(r.error, 'error');
            })}>Saqlash</Button>
          </div>
        </div>
      )}
    </div>
  );
}
