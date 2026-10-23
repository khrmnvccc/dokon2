'use client';

import { useMemo, useState } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { couponSchema, promotionSchema } from '@/lib/admin/schemas';
import { formatDateTime, formatPrice, slugify } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/misc';
import { RowActions, toLocalInput, Toggle, useCrud } from './crud-kit';
import { Table, EmptyRow } from './ui';
import type { Coupon, Promotion } from '@/lib/types';

type Opt = { id: string; name: string };
type Kind = 'promotions' | 'coupons';

function period(starts: string | null, ends: string | null) {
  if (!starts && !ends) return 'Muddatsiz';
  return `${starts ? formatDateTime(starts) : '…'} — ${ends ? formatDateTime(ends) : '…'}`;
}
function statusOf(x: { is_active: boolean; starts_at: string | null; ends_at: string | null }) {
  const now = Date.now();
  if (!x.is_active) return <Badge>O‘chiq</Badge>;
  if (x.starts_at && new Date(x.starts_at).getTime() > now) return <Badge tone="amber">Rejalashtirilgan</Badge>;
  if (x.ends_at && new Date(x.ends_at).getTime() <= now) return <Badge>Tugagan</Badge>;
  return <Badge tone="green">Amalda</Badge>;
}
const valueText = (x: { discount_type: string; value: number }) => (x.discount_type === 'percent' ? `${x.value}%` : formatPrice(x.value));
const scopeText = { all: 'Barcha mahsulotlar', category: 'Kategoriyalar', product: 'Tanlangan mahsulotlar' } as const;

export function DiscountsManager({ kind, items, categories, products }: { kind: Kind; items: (Promotion | Coupon)[]; categories: Opt[]; products: Opt[] }) {
  const crud = useCrud(kind);
  const [editing, setEditing] = useState<Promotion | Coupon | 'new' | null>(null);
  const isCoupon = kind === 'coupons';
  return (
    <div>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {isCoupon ? 'Promo-kod' : 'Aksiya'} qo‘shish</Button></div>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <Table>
          <thead><tr><th>{isCoupon ? 'Kod' : 'Nomi'}</th><th>Chegirma</th><th>Qamrov</th><th>Muddat</th>{isCoupon && <th>Ishlatilgan</th>}<th>Holat</th><th>Faol</th><th /></tr></thead>
          <tbody>
            {items.length === 0 && <EmptyRow cols={8} />}
            {items.map((x) => (
              <tr key={x.id}>
                <td className="font-semibold">{'code' in x ? <code className="rounded bg-slate-100 px-1.5 py-0.5">{x.code}</code> : x.title}</td>
                <td>{valueText(x)}{'max_discount' in x && x.max_discount ? <span className="text-xs text-muted"> (≤ {formatPrice(x.max_discount)})</span> : null}</td>
                <td className="text-muted">{scopeText[x.scope]}{'min_order_amount' in x && x.min_order_amount > 0 && <div className="text-xs">min {formatPrice(x.min_order_amount)}</div>}</td>
                <td className="text-xs text-muted">{period(x.starts_at, x.ends_at)}</td>
                {isCoupon && 'used_count' in x && <td className="tabular-nums">{x.used_count}{x.usage_limit ? ` / ${x.usage_limit}` : ''}</td>}
                <td>{statusOf(x)}</td>
                <td><Toggle checked={x.is_active} label="Faol" onChange={(v) => crud.toggle(x.id, v)} disabled={crud.pending} /></td>
                <td><RowActions onEdit={() => setEditing(x)} onDelete={() => crud.remove(x.id)} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Yangi' : 'Tahrirlash'} className="max-w-2xl">
        {editing !== null && <DiscountForm kind={kind} item={editing === 'new' ? null : editing} categories={categories} products={products} onDone={() => setEditing(null)} save={crud.save} />}
      </Modal>
    </div>
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
              <span key={o.id} className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                {o.name}<button type="button" onClick={() => field.onChange(value.filter((v) => v !== o.id))} aria-label="Olib tashlash"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirib qo‘shing…" />
          {found.length > 0 && (
            <ul className="mt-1 max-h-48 overflow-auto rounded-lg border border-line">
              {found.map((o) => <li key={o.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { field.onChange([...value, o.id]); setQ(''); }}>{o.name}</button></li>)}
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
        ? { code: '', discount_type: 'percent', value: 10, scope: 'all', category_ids: [], product_ids: [], min_order_amount: 0, max_discount: '', usage_limit: '', per_user_limit: 1, starts_at: '', ends_at: '', is_active: true }
        : { title: '', slug: '', discount_type: 'percent', value: 10, scope: 'all', category_ids: [], product_ids: [], sort_order: 0, starts_at: '', ends_at: '', is_active: true };
    }
    return Object.fromEntries(Object.entries({ ...item, starts_at: toLocalInput(item.starts_at), ends_at: toLocalInput(item.ends_at) }).map(([k, v]) => [k, Array.isArray(v) ? v : s(v)]));
  }, [item, isCoupon]);
  const { register, handleSubmit, control, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema as unknown as z.ZodType<Record<string, unknown>>),
    defaultValues: defaults,
  });
  const err = (k: string) => (errors[k]?.message as string | undefined);
  const scope = watch('scope');
  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (d) => { if (await save(item?.id ?? null, d, setError)) onDone(); })}>
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
      {!isCoupon && <input type="hidden" {...register('sort_order')} />}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" loading={isSubmitting}>Saqlash</Button>
      </div>
    </form>
  );
}
