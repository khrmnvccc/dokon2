'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Eye, Lightbulb, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { saveTours } from '@/lib/actions/admin/tours';
import { DEFAULT_TOURS, TOUR_PAGES, TOUR_PLACES, type TourScope, type TourStep, type Tours } from '@/lib/tours';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Segmented, Toggle } from '@/components/ui/kit';
import { cn } from '@/components/ui/cn';
import { Panel } from './ui';

const newId = () => Math.random().toString(36).slice(2, 10);
const pageLabel = (scope: TourScope, page: string) => TOUR_PAGES[scope].find((p) => p.value === page)?.label ?? page;
const placeLabel = (scope: TourScope, target: string) => TOUR_PLACES[scope].find((p) => p.value === target)?.label ?? target;

/** Yoʻl-yoʻriq muharriri: qaysi sahifada, qaysi joyni yoritib, oʻzbek va rus tilida nima deyilsin. */
export function ToursEditor({ initial, siteUrl }: { initial: Tours; siteUrl: string }) {
  const [tours, setTours] = useState<Tours>(initial);
  const [scope, setScope] = useState<TourScope>('shop');
  const [editing, setEditing] = useState<string | null>(null);
  const [again, setAgain] = useState(true);
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const steps = tours[scope];
  const dirty = JSON.stringify(tours) !== JSON.stringify(initial);

  const setSteps = (fn: (list: TourStep[]) => TourStep[]) => setTours((t) => ({ ...t, [scope]: fn(t[scope]) }));
  const update = (id: string, patch: Partial<TourStep>) => setSteps((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => setSteps((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const add = () => {
    const id = newId();
    setSteps((l) => [...l, { id, page: scope === 'shop' ? '/' : '/admin', target: '', title: '', text: '', title_ru: '', text_ru: '' }]);
    setEditing(id);
  };
  const save = () => start(async () => {
    const empty = [...tours.shop, ...tours.admin].find((s) => !s.title.trim() && !s.text.trim());
    if (empty) { toast('Boʻsh qadam bor: sarlavha yoki matn yozing yoki oʻchiring', 'error'); setEditing(empty.id); return; }
    const res = await saveTours(tours, again);
    if (res.ok) { toast(res.message ?? 'Saqlandi', 'success'); router.refresh(); } else toast(res.error, 'error');
  });

  // Sahifalar boʻyicha guruh (tartib saqlanadi)
  const groups = useMemo(() => {
    const out: Array<{ page: string; items: Array<{ step: TourStep; index: number }> }> = [];
    steps.forEach((step, index) => {
      const g = out.find((x) => x.page === step.page);
      if (g) g.items.push({ step, index }); else out.push({ page: step.page, items: [{ step, index }] });
    });
    return out;
  }, [steps]);

  const previewHref = (page: string) => {
    if (page.includes('*')) return null;
    return scope === 'shop' ? `${siteUrl}${page}?tour=1` : `${page}?tour=1`;
  };

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Yoʻl-yoʻriq — xaridor yoki xodim sahifaga <b>birinchi marta</b> kirganda chiqadigan tushuntirish oynalari. Har bir qadam uchun sahifani,
        yoritiladigan joyni va matnni (oʻzbekcha va ruscha) tanlaysiz. Rus tilini tanlagan foydalanuvchi ruscha matnni koʻradi.
      </Alert>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<TourScope> label="Qayerda" value={scope} onChange={(v) => { setScope(v); setEditing(null); }}
          options={[{ value: 'shop', label: `Doʻkon (ilova) · ${tours.shop.length}` }, { value: 'admin', label: `Admin panel · ${tours.admin.length}` }]} />
        <div className="flex items-center gap-2 text-sm">
          <Toggle label="Yoqilgan" checked={tours.enabled[scope]} onChange={(on) => setTours((t) => ({ ...t, enabled: { ...t.enabled, [scope]: on } }))} />
          <span className="text-ink-2">{tours.enabled[scope] ? 'Koʻrsatiladi' : 'Oʻchirilgan'}</span>
        </div>
      </div>

      <div className="space-y-4">
        {groups.length === 0 && <Panel title="Qadamlar yoʻq"><p className="text-sm text-ink-3">“Qadam qoʻshish” ni bosing.</p></Panel>}
        {groups.map((g) => {
          const href = previewHref(g.page);
          return (
            <Panel key={g.page} padded={false} title={pageLabel(scope, g.page)} subtitle={<span className="num">{g.page}</span>}
              actions={href ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2"><Eye className="size-3.5" /> Koʻrib chiqish</a> : null}>
              <ol>
                {g.items.map(({ step, index }) => (
                  <li key={step.id} className="border-t border-line first:border-t-0">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="num mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{step.title || <span className="text-ink-3">Sarlavhasiz</span>}</p>
                        <p className="line-clamp-2 text-sm text-ink-3">{step.text}</p>
                        <p className="mt-1 text-xs text-ink-3">📍 {placeLabel(scope, step.target)}{!step.title_ru && !step.text_ru && <span className="ml-2 text-warn">· ruscha yoʻq</span>}</p>
                      </div>
                      <div className="grid shrink-0 grid-cols-2 gap-1 sm:flex">
                        <IconBtn label="Yuqoriga" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp className="size-4" /></IconBtn>
                        <IconBtn label="Pastga" onClick={() => move(index, 1)} disabled={index === steps.length - 1}><ArrowDown className="size-4" /></IconBtn>
                        <IconBtn label="Tahrirlash" onClick={() => setEditing(editing === step.id ? null : step.id)}><Pencil className="size-4" /></IconBtn>
                        <IconBtn label="Oʻchirish" onClick={() => setSteps((l) => l.filter((s) => s.id !== step.id))}><Trash2 className="size-4" /></IconBtn>
                      </div>
                    </div>
                    {editing === step.id && <StepForm scope={scope} step={step} onChange={(p) => update(step.id, p)} onClose={() => setEditing(null)} />}
                  </li>
                ))}
              </ol>
            </Panel>
          );
        })}
      </div>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-[var(--r-lg)] border border-line bg-surface-solid p-3 shadow-pop lg:bottom-4">
        <Button variant="secondary" onClick={add} disabled={steps.length >= 40}><Plus className="size-4" /> Qadam qoʻshish</Button>
        <Checkbox label="Hammaga yana bir marta koʻrsatish" checked={again} onChange={(e) => setAgain(e.target.checked)} />
        <div className="flex-1" />
        <Button variant="ghost" onClick={async () => {
          if (await confirm({ title: 'Standart matnlarga qaytarish?', text: 'Bu boʻlimdagi qadamlar standart matnlar bilan almashtiriladi (saqlaguningizcha hech narsa oʻzgarmaydi).', confirmText: 'Qaytarish' })) {
            setSteps(() => DEFAULT_TOURS[scope]);
            setEditing(null);
          }
        }}><RotateCcw className="size-4" /> Standart</Button>
        <Button onClick={save} loading={pending} disabled={!dirty && !again}>Saqlash</Button>
      </div>
    </div>
  );
}

function IconBtn({ label, children, onClick, disabled }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className="flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30">{children}</button>
  );
}

function StepForm({ scope, step, onChange, onClose }: { scope: TourScope; step: TourStep; onChange: (p: Partial<TourStep>) => void; onClose: () => void }) {
  const known = TOUR_PAGES[scope].some((p) => p.value === step.page);
  const [custom, setCustom] = useState(!known);
  const [lang, setLang] = useState<'uz' | 'ru'>('uz');
  const title = lang === 'uz' ? step.title : step.title_ru;
  const text = lang === 'uz' ? step.text : step.text_ru;
  return (
    <div className="grid gap-4 border-t border-dashed border-line bg-surface-2/40 px-4 py-4 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sahifa" htmlFor={`pg-${step.id}`} hint={custom ? 'Masalan /about yoki /product/* (hamma mahsulotlar)' : undefined}>
          {custom ? (
            <div className="flex gap-2">
              <Input id={`pg-${step.id}`} value={step.page} onChange={(e) => onChange({ page: e.target.value.trim() || '/' })} placeholder="/catalog" />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCustom(false); onChange({ page: TOUR_PAGES[scope][0].value }); }}>Roʻyxat</Button>
            </div>
          ) : (
            <Select id={`pg-${step.id}`} value={step.page} onChange={(e) => { if (e.target.value === '__custom') setCustom(true); else onChange({ page: e.target.value }); }}>
              {TOUR_PAGES[scope].map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              <option value="__custom">Boshqa manzil…</option>
            </Select>
          )}
        </Field>
        <Field label="Qaysi joyni yoritish" htmlFor={`pl-${step.id}`} hint="Joy shu sahifada boʻlmasa, oyna ekran oʻrtasida chiqadi">
          <Select id={`pl-${step.id}`} value={step.target} onChange={(e) => onChange({ target: e.target.value })}>
            {TOUR_PLACES[scope].map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Segmented<'uz' | 'ru'> label="Til" value={lang} onChange={setLang} options={[{ value: 'uz', label: 'Oʻzbekcha' }, { value: 'ru', label: 'Русский' }]} />
        </div>
        <Field label={lang === 'uz' ? 'Sarlavha' : 'Заголовок'} htmlFor={`t-${step.id}`} className="sm:col-span-2">
          <Input id={`t-${step.id}`} maxLength={80} value={title} onChange={(e) => onChange(lang === 'uz' ? { title: e.target.value } : { title_ru: e.target.value })} />
        </Field>
        <Field label={lang === 'uz' ? 'Matn' : 'Текст'} htmlFor={`x-${step.id}`} className="sm:col-span-2" hint={`${text.length}/400`}>
          <Textarea id={`x-${step.id}`} rows={4} maxLength={400} value={text} onChange={(e) => onChange(lang === 'uz' ? { text: e.target.value } : { text_ru: e.target.value })} />
        </Field>
        <div className="sm:col-span-2"><Button type="button" size="sm" variant="secondary" onClick={onClose}><X className="size-4" /> Yopish</Button></div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Koʻrinishi</p>
        <div className={cn('rounded-2xl bg-surface-solid p-4 shadow-pop')}>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Lightbulb className="size-5" /></span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">{title || (lang === 'ru' ? step.title : '') || 'Sarlavha'}</div>
              <div className="mt-1 whitespace-pre-line text-sm text-ink-2">{text || (lang === 'ru' ? step.text : '') || 'Matn…'}</div>
            </div>
          </div>
          <div className="mt-4 flex justify-end"><span className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">{lang === 'ru' ? 'Далее' : 'Keyingi'}</span></div>
        </div>
        {lang === 'ru' && !step.title_ru && <p className="mt-2 text-xs text-ink-3">Ruscha yozilmasa, oʻzbekcha matn koʻrsatiladi.</p>}
      </div>
    </div>
  );
}
