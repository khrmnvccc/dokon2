'use client';

import { useMemo, useState, useTransition } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ChevronLeft, ChevronsUpDown, PartyPopper, Plus, Search, Send, TicketPercent, X } from 'lucide-react';
import { sendCoupon } from '@/lib/actions/admin/telegram';
import { useToast } from '@/components/ui/toast';
import { COUPON_THEMES, COUPON_THEME_KEYS, cleanDesign, couponCardProps, type CouponTheme } from '@/lib/coupon-design';
import { CouponCard } from '@/components/coupon/coupon-card';
import { cn } from '@/components/ui/cn';
import { couponSchema, promotionSchema } from '@/lib/admin/schemas';
import { formatPrice, slugify } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/misc';
import { RowActions, toLocalInput, Toggle, useCrud } from './crud-kit';
import { Table, EmptyRow } from './ui';
import type { Coupon, Promotion } from '@/lib/types';

type Opt = { id: string; name: string };
type Kind = 'promotions' | 'coupons';

function statusOf(x: { is_active: boolean; starts_at: string | null; ends_at: string | null }) {
  const now = Date.now();
  if (!x.is_active) return <Badge>O‘chiq</Badge>;
  if (x.starts_at && new Date(x.starts_at).getTime() > now) return <Badge tone="amber">Rejalashtirilgan</Badge>;
  if (x.ends_at && new Date(x.ends_at).getTime() <= now) return <Badge>Tugagan</Badge>;
  return <Badge tone="green">Amalda</Badge>;
}
const valueText = (x: { discount_type: string; value: number }) => (x.discount_type === 'percent' ? `${x.value}%` : formatPrice(x.value));
const scopeText = { all: 'Barcha mahsulotlar', category: 'Kategoriyalar', product: 'Tanlangan mahsulotlar' } as const;

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '…');
type Item = Promotion | Coupon;
type DesignInput = { theme: CouponTheme; badge: string };

export function DiscountsManager({ kind, items, categories, products }: { kind: Kind; items: Item[]; categories: Opt[]; products: Opt[] }) {
  const crud = useCrud(kind);
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [sending, setSending] = useState<Coupon | null>(null);
  const [q, setQ] = useState('');
  const [onlyCurrent, setOnlyCurrent] = useState(true);
  const isCoupon = kind === 'coupons';
  const now = Date.now();
  const current = (x: Item) => x.is_active && !(x.ends_at && new Date(x.ends_at).getTime() <= now);
  const shown = items.filter((x) => (!onlyCurrent || current(x)) && (!q || ('code' in x ? x.code : x.title).toLowerCase().includes(q.toLowerCase()) || (x.description ?? '').toLowerCase().includes(q.toLowerCase())));
  const currentCount = items.filter(current).length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative">
          <select value={onlyCurrent ? 'cur' : 'all'} onChange={(e) => setOnlyCurrent(e.target.value === 'cur')} aria-label="Filtr"
            className="h-10 appearance-none rounded-xl border border-line bg-surface-solid pl-3 pr-8 text-sm font-semibold text-ink">
            <option value="cur">Joriy · {currentCount}</option>
            <option value="all">Hammasi · {items.length}</option>
          </select>
          <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        </label>
        <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish" aria-label="Qidirish"
            className="h-10 w-full rounded-xl border border-line bg-surface-solid pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-line-strong" />
        </label>
        <Button className="ml-auto" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {isCoupon ? 'Promo-kod' : 'Aksiya'} qoʻshish</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
        <Table>
          <thead><tr>
            <th className="w-[150px]">Kupon</th><th>{isCoupon ? 'Kod' : 'Nomi'}</th><th className="hidden xl:table-cell">Kimga</th><th>Davr</th>
            {isCoupon && <th>Ishlatildi</th>}<th>Holat</th><th className="text-right">Amal</th>
          </tr></thead>
          <tbody>
            {shown.length === 0 && <EmptyRow cols={isCoupon ? 7 : 6} />}
            {shown.map((x) => {
              const card = couponCardProps(x, isCoupon ? 'Kupon' : 'Aksiya');
              const used = 'used_count' in x ? x.used_count : 0;
              const limit = 'usage_limit' in x ? x.usage_limit : null;
              return (
                <tr key={x.id}>
                  <td><button type="button" onClick={() => setEditing(x)} className="block w-[132px]" aria-label="Dizaynni ochish"><CouponCard {...card} size="sm" /></button></td>
                  <td>
                    <div className="font-semibold text-ink">{'code' in x ? <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">{x.code}</code> : x.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-3">
                      {isCoupon ? <TicketPercent className="size-3.5" /> : <PartyPopper className="size-3.5" />}
                      {valueText(x)}
                      {'is_public' in x && x.is_public && <Badge tone="card">saytda</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3 xl:hidden">{scopeText[x.scope]}
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap text-ink-2 xl:table-cell">{scopeText[x.scope]}{'min_order_amount' in x && x.min_order_amount > 0 && <div className="text-xs text-ink-3">min {formatPrice(x.min_order_amount)}</div>}</td>
                  <td className="whitespace-nowrap text-ink-2 num">{!x.starts_at && !x.ends_at ? 'Doimiy' : `${shortDate(x.starts_at)} — ${shortDate(x.ends_at)}`}</td>
                  {isCoupon && (
                    <td className="min-w-[120px]">
                      <div className="font-mono text-sm text-ink">{used}{limit ? ` / ${limit}` : ''}</div>
                      {limit ? <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-[#1d4f80] dark:bg-white/70" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div> : null}
                    </td>
                  )}
                  <td>{statusOf(x)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <Toggle checked={x.is_active} label="Faol" onChange={(v) => crud.toggle(x.id, v)} disabled={crud.pending} />
                      {isCoupon && (
                        <button type="button" onClick={() => setSending(x as Coupon)} disabled={!current(x)} title={current(x) ? 'Botda yuborish' : 'Faol emas'}
                          className="rounded-lg p-1.5 text-ink-3 hover:bg-primary-soft hover:text-primary disabled:opacity-40" aria-label="Botda yuborish"><Send className="h-4 w-4" /></button>
                      )}
                      <RowActions onEdit={() => setEditing(x)} onDelete={() => crud.remove(x.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div className="border-t border-line px-4 py-2.5 text-xs text-ink-3 num">{shown.length} / {items.length}</div>
      </div>
      <Modal open={sending !== null} onClose={() => setSending(null)} title="Kuponni botda yuborish" size="md">
        {sending && <SendCouponForm coupon={sending} onDone={() => setSending(null)} />}
      </Modal>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? (isCoupon ? 'Yangi promo-kod' : 'Yangi aksiya') : 'Tahrirlash'} size="xl" className="max-w-5xl">
        {editing !== null && <DiscountForm kind={kind} item={editing === 'new' ? null : editing} categories={categories} products={products} onDone={() => setEditing(null)} save={crud.save} />}
      </Modal>
    </div>
  );
}

/** Kuponni doʻkon boti orqali yuborish: hamma obunachilarga yoki bitta mijozga (Mijoz ID boʻyicha). */
function SendCouponForm({ coupon, onDone }: { coupon: Coupon; onDone: () => void }) {
  const [who, setWho] = useState<'all' | 'one'>('all');
  const [id, setId] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const clientNo = who === 'one' ? Number(id) : null;
  const valid = who === 'all' || (Number.isInteger(clientNo) && (clientNo ?? 0) > 0);
  const submit = () => start(async () => {
    const r = await sendCoupon(coupon.id, clientNo);
    if (r.ok) { toast(r.message ?? 'Yuborildi', 'success'); onDone(); } else toast(r.error, 'error');
  });
  return (
    <div className="space-y-4">
      <div className="w-56"><CouponCard {...couponCardProps(coupon, 'Kupon')} size="sm" /></div>
      <p className="text-sm text-ink-2">
        Xaridorga doʻkon boti orqali <b>“Sizga kupon berildi”</b> xabari keladi: kupon rasmi, kod <code className="rounded bg-surface-2 px-1 font-mono">{coupon.code}</code> va “Kupon markazi” tugmasi.
        Matn va rasmni <a href="/admin/messages" className="font-medium text-primary underline">Xabarlar va Push → Mijozga</a> boʻlimida oʻzgartirasiz.
      </p>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={who === 'all'} onChange={() => setWho('all')} /> Botga obuna boʻlgan hamma xaridorlarga</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={who === 'one'} onChange={() => setWho('one')} /> Bitta mijozga (Mijoz ID)</label>
        {who === 'one' && <Input inputMode="numeric" autoFocus value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="Masalan: 1001" aria-label="Mijoz ID" className="max-w-[200px]" />}
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onDone}>Bekor qilish</Button>
        <Button loading={pending} disabled={!valid} onClick={submit}><Send className="h-4 w-4" /> Yuborish</Button>
      </div>
    </div>
  );
}

/** Dizayn: rang toʻplami, chiptadagi yozuv va jonli koʻrinish (kartochka + telefon). */
function DesignPanel({ control, watchAll, isCoupon }: { control: Control<Record<string, unknown>>; watchAll: Record<string, unknown>; isCoupon: boolean }) {
  const card = couponCardProps({
    discount_type: String(watchAll.discount_type ?? 'percent'), value: Number(watchAll.value) || 0, scope: String(watchAll.scope ?? 'all'),
    ends_at: watchAll.ends_at ? new Date(String(watchAll.ends_at)).toISOString() : null,
    min_order_amount: isCoupon ? Number(watchAll.min_order_amount) || 0 : 0, design: watchAll.design,
  }, isCoupon ? 'Kupon' : 'Aksiya');
  return (
    <Controller control={control} name="design" render={({ field }) => {
      const d = cleanDesign(field.value) as DesignInput;
      const set = (patch: Partial<DesignInput>) => field.onChange({ ...d, ...patch });
      return (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-2">Ranglar</div>
            <div className="grid grid-cols-5 gap-2">
              {COUPON_THEME_KEYS.map((k) => {
                const t = COUPON_THEMES[k];
                return (
                  <button key={k} type="button" onClick={() => set({ theme: k })} aria-pressed={d.theme === k} title={t.label}
                    className={cn('overflow-hidden rounded-xl border-2 text-left transition', d.theme === k ? 'border-[#1d4f80] dark:border-white' : 'border-transparent hover:border-line-strong')}>
                    <span className="flex h-9">
                      <span className="w-1/3" style={{ background: `linear-gradient(160deg, ${t.stub[0]}, ${t.stub[1]})` }} />
                      <span className="flex-1" style={{ background: `linear-gradient(135deg, ${t.main[0]}, ${t.main[1]})` }} />
                    </span>
                    <span className="block truncate px-1.5 py-1 text-[11px] font-medium text-ink-2">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Chiptadagi yozuv" hint="Masalan 11.11, YANGI, VIP — koʻpi bilan 6 belgi" htmlFor="d-badge">
            <Input id="d-badge" maxLength={6} value={d.badge} onChange={(e) => set({ badge: e.target.value })} placeholder={card.unit === '%' ? '%' : '★'} />
          </Field>
          <div>
            <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-2">Saytda koʻrinishi</div>
            <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-[#14253b] bg-[var(--panel)] p-3 shadow-pop">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><ChevronLeft className="size-4" /> Chegirma</div>
              <CouponCard {...card} action={isCoupon ? 'Nusxalash' : 'Koʻrish'} />
              <div className="h-16" />
            </div>
          </div>
        </div>
      );
    }} />
  );
}

function MultiPicker({ control, name, options, label, error }: { control: Control<Record<string, unknown>>; name: string; options: Opt[]; label: string; error?: string }) {
  const [q, setQ] = useState('');
  return (
    <Controller control={control} name={name} render={({ field }) => {
      const value = (field.value as string[]) ?? [];
      const selected = options.filter((o) => value.includes(o.id));
      const found = q ? options.filter((o) => !value.includes(o.id) && o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
      return (
        <Field label={label} error={error} className="sm:col-span-2">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selected.map((o) => (
              <span key={o.id} className="flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                {o.name}<button type="button" onClick={() => field.onChange(value.filter((v) => v !== o.id))} aria-label="Olib tashlash"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirib qo‘shing…" />
          {found.length > 0 && (
            <ul className="mt-1 max-h-48 overflow-auto rounded-lg border border-line">
              {found.map((o) => <li key={o.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { field.onChange([...value, o.id]); setQ(''); }}>{o.name}</button></li>)}
            </ul>
          )}
        </Field>
      );
    }} />
  );
}

function DiscountForm({ kind, item, categories, products, onDone, save }: { kind: Kind; item: Promotion | Coupon | null; categories: Opt[]; products: Opt[]; onDone: () => void; save: ReturnType<typeof useCrud>['save'] }) {
  const isCoupon = kind === 'coupons';
  const schema = isCoupon ? couponSchema : promotionSchema;
  const s = (v: unknown) => (v === null || v === undefined ? '' : v);
  const defaults = useMemo(() => {
    if (!item) {
      return isCoupon
        ? { code: '', discount_type: 'percent', value: 10, scope: 'all', category_ids: [], product_ids: [], min_order_amount: 0, max_discount: '', usage_limit: '', per_user_limit: 1, starts_at: '', ends_at: '', is_active: true, is_public: false, design: { theme: 'red', badge: '' } }
        : { title: '', slug: '', discount_type: 'percent', value: 10, scope: 'all', category_ids: [], product_ids: [], sort_order: 0, starts_at: '', ends_at: '', is_active: true, design: { theme: 'red', badge: '' } };
    }
    return Object.fromEntries(Object.entries({ ...item, starts_at: toLocalInput(item.starts_at), ends_at: toLocalInput(item.ends_at), design: cleanDesign(item.design), ...(isCoupon ? { is_public: Boolean((item as Coupon).is_public) } : {}) }).map(([k, v]) => [k, Array.isArray(v) || (v && typeof v === 'object') || typeof v === 'boolean' ? v : s(v)]));
  }, [item, isCoupon]);
  const { register, handleSubmit, control, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema as unknown as z.ZodType<Record<string, unknown>>),
    defaultValues: defaults,
  });
  const err = (k: string) => (errors[k]?.message as string | undefined);
  const scope = watch('scope');
  const all = watch();
  return (
    <form className="grid gap-6 lg:grid-cols-[1fr_320px]" noValidate onSubmit={handleSubmit(async (d) => { if (await save(item?.id ?? null, d, setError)) onDone(); })}>
    <div className="grid content-start gap-4 sm:grid-cols-2">
      {isCoupon ? (
        <Field label="Kod" required error={err('code')} htmlFor="d-code" hint="Mijoz checkout’da kiritadi"><Input id="d-code" className="uppercase" {...register('code')} /></Field>
      ) : (
        <>
          <Field label="Nomi" required error={err('title')} htmlFor="d-title"><Input id="d-title" {...register('title', { onChange: (e) => !item && setValue('slug', slugify(e.target.value)) })} /></Field>
          <Field label="Slug" required error={err('slug')} htmlFor="d-slug"><Input id="d-slug" {...register('slug')} /></Field>
        </>
      )}
      <Field label="Tavsif" htmlFor="d-desc" className={isCoupon ? '' : 'sm:col-span-2'}>
        {isCoupon ? <Input id="d-desc" {...register('description')} /> : <Textarea id="d-desc" rows={2} {...register('description')} />}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Turi" htmlFor="d-type"><Select id="d-type" {...register('discount_type')}><option value="percent">Foiz (%)</option><option value="fixed">Summa (so‘m)</option></Select></Field>
        <Field label="Qiymati" required error={err('value')} htmlFor="d-val"><Input id="d-val" inputMode="numeric" {...register('value')} /></Field>
      </div>
      <Field label="Qamrov" htmlFor="d-scope">
        <Select id="d-scope" {...register('scope')}><option value="all">Barcha mahsulotlar</option><option value="category">Kategoriyalar</option><option value="product">Tanlangan mahsulotlar</option></Select>
      </Field>
      {scope === 'category' && <MultiPicker control={control} name="category_ids" options={categories} label="Kategoriyalar (ichki kategoriyalar ham kiradi)" error={err('category_ids')} />}
      {scope === 'product' && <MultiPicker control={control} name="product_ids" options={products} label="Mahsulotlar" error={err('product_ids')} />}
      {isCoupon && (
        <>
          <Field label="Minimal buyurtma (so‘m)" error={err('min_order_amount')} htmlFor="d-min"><Input id="d-min" inputMode="numeric" {...register('min_order_amount')} /></Field>
          <Field label="Maksimal chegirma (so‘m)" hint="Foizli kupon uchun chegara" htmlFor="d-max"><Input id="d-max" inputMode="numeric" {...register('max_discount')} /></Field>
          <Field label="Umumiy limit" hint="Bo‘sh — cheksiz" htmlFor="d-lim"><Input id="d-lim" inputMode="numeric" {...register('usage_limit')} /></Field>
          <Field label="Bir mijozga limit" hint="Telefon yoki hisob bo‘yicha" htmlFor="d-pul"><Input id="d-pul" inputMode="numeric" {...register('per_user_limit')} /></Field>
        </>
      )}
      <Field label="Boshlanish" htmlFor="d-start"><Input id="d-start" type="datetime-local" {...register('starts_at')} /></Field>
      <Field label="Tugash" error={err('ends_at')} htmlFor="d-end"><Input id="d-end" type="datetime-local" {...register('ends_at')} /></Field>
      <Checkbox label="Faol" {...register('is_active')} />
      {isCoupon && <Checkbox label="Saytda “Kuponlar” boʻlimida koʻrsatish (kod hammaga koʻrinadi)" {...register('is_public')} />}
      {!isCoupon && <input type="hidden" {...register('sort_order')} />}
    </div>
    <DesignPanel control={control} watchAll={all} isCoupon={isCoupon} />
      <div className="flex justify-end gap-2 lg:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" loading={isSubmitting}>Saqlash</Button>
      </div>
    </form>
  );
}
