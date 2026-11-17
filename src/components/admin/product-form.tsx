'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ExternalLink, Plus, Trash2, Wand2 } from 'lucide-react';
import { productSchema, type ProductData, type ProductInput } from '@/lib/admin/schemas';
import { saveProduct, deleteProducts } from '@/lib/actions/admin/products';
import { slugify, formatPrice } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { GalleryField, type GalleryImage } from './upload';
import { Panel } from './ui';

/** Yig'iladigan bo'limlar va ulardagi maydonlar (xato bo'lsa bo'lim o'zi ochiladi) */
type SectionKey = 'variants' | 'extra' | 'stock' | 'seo';
const SECTION_FIELDS: Record<SectionKey, string[]> = {
  variants: ['variants'],
  extra: ['short_description', 'brand', 'attributes'],
  stock: ['cost_price', 'low_stock_threshold', 'track_stock', 'sku', 'barcode', 'weight_grams'],
  seo: ['slug', 'seo_title', 'seo_description'],
};
const sectionsWithErrors = (keys: string[]) =>
  (Object.keys(SECTION_FIELDS) as SectionKey[]).filter((s) => SECTION_FIELDS[s].some((f) => keys.includes(f)));

function Section({ title, hint, summary, open, onToggle, actions, children }: {
  title: string; hint: string; summary?: ReactNode; open: boolean; onToggle: () => void; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="anim-rise rounded-xl border border-line bg-surface shadow-soft">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>
        </div>
        {summary && <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2">{summary}</span>}
        <ChevronDown className={cn('size-5 shrink-0 text-ink-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line p-4 sm:p-5">
          {actions && <div className="mb-3 flex justify-end">{actions}</div>}
          {children}
        </div>
      )}
    </section>
  );
}

export function ProductForm({ id, defaults, categories, canStock, canDelete, canSeeCost }: {
  id: string | null;
  defaults: ProductInput;
  categories: { id: string; name: string; parent_id: string | null }[];
  canStock: boolean;
  canDelete: boolean;
  canSeeCost: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ variants: false, extra: false, stock: false, seo: false });
  const toggle = (s: SectionKey) => setOpen((o) => ({ ...o, [s]: !o[s] }));
  const openSections = (keys: string[]) => {
    const list = sectionsWithErrors(keys);
    if (list.length) setOpen((o) => ({ ...o, ...Object.fromEntries(list.map((s) => [s, true])) }));
  };
  const form = useForm<ProductInput, unknown, ProductData>({ resolver: zodResolver(productSchema), defaultValues: defaults });
  const { register, handleSubmit, watch, setValue, getValues, setError, control, formState: { errors, isSubmitting, isDirty } } = form;
  const attrs = useFieldArray({ control, name: 'attributes' });
  const variants = useFieldArray({ control, name: 'variants', keyName: '_key' });
  const images = (watch('images') ?? []) as GalleryImage[];
  const price = Number(String(watch('price') ?? '').replace(/\s/g, '')) || 0;
  const cost = Number(String(watch('cost_price') ?? '').replace(/\s/g, '')) || 0;
  const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
  const hasVariants = variants.fields.length > 0;
  const err = (path: string) => (errors as Record<string, { message?: string }>)[path]?.message;
  const extraCount = [watch('short_description'), watch('brand')].filter(Boolean).length + attrs.fields.length;

  const onSubmit = async (data: ProductData) => {
    const res = await saveProduct(id, data);
    if (!res.ok) {
      toast(res.error, 'error');
      const fe = Object.entries(res.fieldErrors ?? {});
      for (const [k, m] of fe) setError(k as 'name', { message: m });
      openSections(fe.map(([k]) => k));
      return;
    }
    toast(res.message ?? 'Saqlandi');
    res.data?.warnings.forEach((w) => toast(w, 'info'));
    if (!id) router.replace(`/admin/products/${res.data!.id}`);
    else {
      form.reset(data as unknown as ProductInput);
      router.refresh();
    }
  };
  const onInvalid = (e: FieldErrors<ProductInput>) => {
    openSections(Object.keys(e));
    toast('Formadagi xatolarni tuzating', 'error');
  };
  // Havola (slug) bo'sh bo'lsa — nomdan avtomatik yaratamiz, foydalanuvchi o'ylamasin
  const submit = (e: FormEvent<HTMLFormElement>) => {
    if (!String(getValues('slug') ?? '').trim()) {
      setValue('slug', slugify(String(getValues('name') ?? '')) || `tovar-${Date.now().toString(36)}`);
    }
    return handleSubmit(onSubmit, onInvalid)(e);
  };

  const saveLabel = id ? 'O‘zgarishlarni saqlash' : 'Mahsulotni joylash';
  const saveDisabled = Boolean(id) && !isDirty;

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
      <div className="space-y-4">
        {/* 1. Eng kerakli maydonlar — shular bilan tovar tayyor */}
        <Panel title="Asosiy" subtitle="Tovarni joylash uchun shu yetarli. * belgili maydonlar majburiy.">
          <div className="space-y-5">
            <Field label="Rasmlar">
              <GalleryField images={images} onChange={(imgs) => setValue('images', imgs, { shouldDirty: true })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nomi" required error={errors.name?.message} htmlFor="name" className="sm:col-span-2">
                <Input id="name" placeholder="Masalan: Erkaklar krossovkasi Nike Air" {...register('name', { onChange: (e) => !slugTouched && setValue('slug', slugify(e.target.value)) })} />
              </Field>
              <Field label="Narxi (so‘m)" required error={errors.price?.message} htmlFor="price">
                <Input id="price" inputMode="numeric" placeholder="150000" {...register('price')} />
              </Field>
              <Field label="Chegirmadan oldingi narx" error={err('compare_at_price')} hint="Ixtiyoriy. Toʻldirilsa, saytda chizilgan holda va chegirma foizi bilan koʻrinadi." htmlFor="compare_at_price">
                <Input id="compare_at_price" inputMode="numeric" placeholder="200000" {...register('compare_at_price')} />
              </Field>
              <Field label="Kategoriya" htmlFor="category_id" hint="Mijoz tovarni qaysi boʻlimdan topadi">
                <Select id="category_id" {...register('category_id')}>
                  <option value="">— tanlanmagan —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
                </Select>
              </Field>
              {hasVariants ? (
                <Field label="Nechta bor (dona)" hint="Variantlar qoʻshilgan — soni har bir variantda alohida yoziladi.">
                  <Input disabled value="Variantlarda" readOnly />
                </Field>
              ) : (
                <Field label="Nechta bor (dona)" htmlFor="stock" error={errors.stock?.message} hint={id && !canStock ? 'O‘zgartirish uchun ombor huquqi kerak' : 'Sotilgan sari avtomatik kamayadi'}>
                  <Input id="stock" inputMode="numeric" disabled={Boolean(id) && !canStock} {...register('stock')} />
                </Field>
              )}
              <Field label="Tavsif" htmlFor="description" hint="Mahsulot haqida: material, oʻlcham, kafolat va h.k." className="sm:col-span-2">
                <Textarea id="description" rows={5} {...register('description')} />
              </Field>
            </div>
          </div>
        </Panel>

        {/* 2. Kerak bo'lsagina ochiladigan bo'limlar */}
        <Section title="Rang va oʻlcham (variantlar)" hint="Bir tovarning bir nechta rangi yoki oʻlchami boʻlsa"
          summary={hasVariants ? `${variants.fields.length} ta` : 'Yoʻq'} open={open.variants} onToggle={() => toggle('variants')}
          actions={
            <Button type="button" size="sm" variant="secondary" onClick={() => variants.append({ name: '', sku: '', color: '', color_hex: '', size: '', price: '' as unknown as number, compare_at_price: '' as unknown as number, stock: 0, is_active: true })}>
              <Plus className="h-4 w-4" /> Variant qoʻshish
            </Button>
          }>
          {variants.fields.length === 0 ? (
            <p className="text-sm text-ink-3">Variant kerak boʻlmasa, tegmang. Qoʻshilsa, mijoz rang/oʻlchamni tanlab oladi va umumiy son variantlar yigʻindisidan hisoblanadi.</p>
          ) : (
            <div className="space-y-3">
              {variants.fields.map((f, i) => {
                const ve = (errors.variants?.[i] ?? {}) as Record<string, { message?: string }>;
                return (
                  <div key={f._key} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-4">
                    <Field label="Variant nomi" error={ve.name?.message} className="col-span-2"><Input placeholder="Qora / M" {...register(`variants.${i}.name`)} /></Field>
                    <Field label="Rang"><Input placeholder="Qora" {...register(`variants.${i}.color`)} /></Field>
                    <Field label="Oʻlcham"><Input placeholder="M yoki 42" {...register(`variants.${i}.size`)} /></Field>
                    <Field label="Narxi" hint="Boʻsh = asosiy narx"><Input inputMode="numeric" {...register(`variants.${i}.price`)} /></Field>
                    <Field label="Nechta bor" error={ve.stock?.message}><Input inputMode="numeric" disabled={Boolean(watch(`variants.${i}.id`)) && !canStock} {...register(`variants.${i}.stock`)} /></Field>
                    <Field label="Rang kodi" hint="Ixtiyoriy, doiracha uchun" error={ve.color_hex?.message}><Input placeholder="#000000" {...register(`variants.${i}.color_hex`)} /></Field>
                    <Field label="Artikul" hint="Ixtiyoriy"><Input {...register(`variants.${i}.sku`)} /></Field>
                    <div className="col-span-2 flex items-center justify-between sm:col-span-4">
                      <Checkbox label="Sotuvda" {...register(`variants.${i}.is_active`)} />
                      <button type="button" onClick={() => variants.remove(i)} className="flex items-center gap-1 text-sm text-danger"><Trash2 className="h-4 w-4" /> Oʻchirish</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Qoʻshimcha maʼlumot" hint="Brend, qisqa izoh, xususiyatlar jadvali"
          summary={extraCount ? `${extraCount} ta toʻldirilgan` : undefined} open={open.extra} onToggle={() => toggle('extra')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brend" htmlFor="brand"><Input id="brand" placeholder="Nike" {...register('brand')} /></Field>
            <Field label="Qisqa izoh" htmlFor="short_description" hint="Tovar kartasida nom ostida chiqadi">
              <Input id="short_description" maxLength={300} {...register('short_description')} />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-ink-2">Xususiyatlar</p>
                <Button type="button" size="sm" variant="secondary" onClick={() => attrs.append({ name: '', value: '' })}><Plus className="h-4 w-4" /> Qoʻshish</Button>
              </div>
              {attrs.fields.length === 0 && <p className="text-xs text-ink-3">Masalan: Material — Paxta, Kafolat — 12 oy. Tovar sahifasida jadval boʻlib chiqadi.</p>}
              {attrs.fields.map((f, i) => (
                <div key={f.id} className="flex gap-2">
                  <Input placeholder="Nomi" aria-label="Xususiyat nomi" {...register(`attributes.${i}.name`)} />
                  <Input placeholder="Qiymati" aria-label="Xususiyat qiymati" {...register(`attributes.${i}.value`)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => attrs.remove(i)} aria-label="Oʻchirish"><Trash2 className="h-4 w-4 text-danger" /></Button>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Ombor va hisob-kitob" hint="Tannarx, kam qolganda ogohlantirish, artikul, ogʻirlik"
          summary={margin !== null ? `Foyda ${margin}%` : undefined} open={open.stock} onToggle={() => toggle('stock')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {canSeeCost && (
              <Field label="Tannarx (oʻzingizga necha pul tushgan)" htmlFor="cost_price" hint={margin !== null ? `Foyda: ${margin}% (${formatPrice(price - cost)}). Mijozlarga koʻrinmaydi.` : 'Foydani hisoblash uchun. Mijozlarga koʻrinmaydi.'} error={err('cost_price')}>
                <Input id="cost_price" inputMode="numeric" {...register('cost_price')} />
              </Field>
            )}
            <Field label="Kam qolganda ogohlantirish" htmlFor="low_stock_threshold" hint="Soni shundan kamaysa, sizga xabar keladi">
              <Input id="low_stock_threshold" inputMode="numeric" {...register('low_stock_threshold')} />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox label="Sonini hisoblash (tugasa, “Sotuvda yoʻq” boʻladi)" {...register('track_stock')} />
              <p className="mt-1 pl-[26px] text-xs text-ink-3">Oʻchirilsa, tovar har doim sotuvda deb koʻrsatiladi (masalan, buyurtma asosida keltiriladigan tovar).</p>
            </div>
            <Field label="Artikul (SKU)" error={err('sku')} htmlFor="sku" hint="Ixtiyoriy, ichki kod"><Input id="sku" {...register('sku')} /></Field>
            <Field label="Shtrix-kod" htmlFor="barcode" hint="Ixtiyoriy"><Input id="barcode" inputMode="numeric" {...register('barcode')} /></Field>
            <Field label="Ogʻirligi (gramm)" htmlFor="weight_grams" hint="Ixtiyoriy, yetkazish narxi uchun"><Input id="weight_grams" inputMode="numeric" {...register('weight_grams')} /></Field>
          </div>
        </Section>

        <Section title="Havola va Google (SEO)" hint="Avtomatik toʻldiriladi, oʻzgartirish shart emas"
          open={open.seo} onToggle={() => toggle('seo')}>
          <div className="grid gap-4">
            <Field label="Sahifa havolasi" error={errors.slug?.message} htmlFor="slug" hint="Nomdan avtomatik yaratiladi: /product/…">
              <div className="flex gap-2">
                <Input id="slug" {...register('slug', { onChange: () => setSlugTouched(true) })} />
                <Button type="button" variant="outline" size="icon" onClick={() => setValue('slug', slugify(watch('name') ?? ''), { shouldDirty: true })} aria-label="Nomdan yaratish" title="Nomdan yaratish"><Wand2 className="h-4 w-4" /></Button>
              </div>
            </Field>
            <Field label="Google’dagi sarlavha" hint="Boʻsh boʻlsa — mahsulot nomi" htmlFor="seo_title"><Input id="seo_title" maxLength={120} {...register('seo_title')} /></Field>
            <Field label="Google’dagi tavsif" hint="Qidiruv natijalarida chiqadi, 160 belgigacha" htmlFor="seo_description"><Textarea id="seo_description" rows={2} maxLength={300} {...register('seo_description')} /></Field>
          </div>
        </Section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20">
        <Panel title="Saytda">
          <div className="space-y-3">
            <Checkbox label="Saytda koʻrinadi" {...register('is_active')} />
            <p className="-mt-1.5 pl-[26px] text-xs text-ink-3">Belgini olib tashlasangiz, tovar vaqtincha yashiriladi.</p>
            <div className="border-t border-line pt-3">
              <p className="mb-2 text-[13px] font-medium text-ink-2">Belgilar <span className="font-normal text-ink-3">(ixtiyoriy)</span></p>
              <div className="space-y-2.5">
                <Checkbox label="“Yangi” yorligʻi" {...register('is_new')} />
                <Checkbox label="“Xit” — koʻp sotiladigan" {...register('is_bestseller')} />
                <Checkbox label="Bosh sahifada tavsiya etilsin" {...register('is_featured')} />
              </div>
            </div>
          </div>
          <div className="mt-5 hidden xl:block"><Button type="submit" className="w-full" loading={isSubmitting} disabled={saveDisabled}>{saveLabel}</Button></div>
          {id && (
            <Link href={`/product/${watch('slug')}`} target="_blank" className="mt-3 flex items-center justify-center gap-1.5 text-sm text-primary hover:underline">
              Saytda koʻrish <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </Panel>
        {id && canDelete && (
          <Button type="button" variant="outline" className="w-full text-danger" onClick={async () => {
            if (!(await confirm({ title: 'Mahsulotni oʻchirish?', text: 'Buyurtmalar tarixida nomi saqlanib qoladi. Vaqtincha yashirish uchun “Saytda koʻrinadi” belgisini olib tashlang.', danger: true, confirmText: 'Oʻchirish' }))) return;
            const res = await deleteProducts([id]);
            toast(res.ok ? res.message ?? 'Oʻchirildi' : res.error, res.ok ? 'success' : 'error');
            if (res.ok) router.replace('/admin/products');
          }}>
            <Trash2 className="h-4 w-4" /> Mahsulotni oʻchirish
          </Button>
        )}
      </aside>

      {/* Telefon/planshet: saqlash tugmasi doim ko'rinib turadi */}
      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 -mx-1 rounded-2xl border border-line bg-[var(--panel)] p-2 shadow-pop lg:bottom-4 xl:hidden">
        <Button type="submit" className="w-full" loading={isSubmitting} disabled={saveDisabled}>{saveLabel}</Button>
      </div>
    </form>
  );
}
