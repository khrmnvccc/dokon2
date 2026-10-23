'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Plus, Trash2, Wand2 } from 'lucide-react';
import { productSchema, type ProductData, type ProductInput } from '@/lib/admin/schemas';
import { saveProduct, deleteProducts } from '@/lib/actions/admin/products';
import { slugify, formatPrice } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { GalleryField, type GalleryImage } from './upload';
import { Panel } from './ui';

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
  const form = useForm<ProductInput, unknown, ProductData>({ resolver: zodResolver(productSchema), defaultValues: defaults });
  const { register, handleSubmit, watch, setValue, setError, control, formState: { errors, isSubmitting, isDirty } } = form;
  const attrs = useFieldArray({ control, name: 'attributes' });
  const variants = useFieldArray({ control, name: 'variants', keyName: '_key' });
  const images = (watch('images') ?? []) as GalleryImage[];
  const price = Number(String(watch('price') ?? '').replace(/\s/g, '')) || 0;
  const cost = Number(String(watch('cost_price') ?? '').replace(/\s/g, '')) || 0;
  const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
  const hasVariants = variants.fields.length > 0;
  const err = (path: string) => (errors as Record<string, { message?: string }>)[path]?.message;

  const onSubmit = async (data: ProductData) => {
    const res = await saveProduct(id, data);
    if (!res.ok) {
      toast(res.error, 'error');
      for (const [k, m] of Object.entries(res.fieldErrors ?? {})) setError(k as 'name', { message: m });
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

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast('Formadagi xatolarni tuzating', 'error'))} noValidate className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
      <div className="space-y-4">
        <Panel title="Asosiy ma’lumotlar">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomi" required error={errors.name?.message} htmlFor="name" className="sm:col-span-2">
              <Input id="name" {...register('name', { onChange: (e) => !slugTouched && setValue('slug', slugify(e.target.value)) })} />
            </Field>
            <Field label="Slug (URL)" required error={errors.slug?.message} htmlFor="slug" hint="Sayt manzili: /product/slug">
              <div className="flex gap-2">
                <Input id="slug" {...register('slug', { onChange: () => setSlugTouched(true) })} />
                <Button type="button" variant="outline" size="icon" onClick={() => setValue('slug', slugify(watch('name') ?? ''), { shouldDirty: true })} aria-label="Nomdan yaratish"><Wand2 className="h-4 w-4" /></Button>
              </div>
            </Field>
            <Field label="Kategoriya" htmlFor="category_id">
              <Select id="category_id" {...register('category_id')}>
                <option value="">— tanlanmagan —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Brend" htmlFor="brand"><Input id="brand" {...register('brand')} /></Field>
            <Field label="Qisqa tavsif" htmlFor="short_description" hint="Kartada va qidiruvda ko‘rinadi" className="sm:col-span-2">
              <Input id="short_description" maxLength={300} {...register('short_description')} />
            </Field>
            <Field label="To‘liq tavsif" htmlFor="description" hint="Markdown: ## sarlavha, - ro‘yxat, **qalin**" className="sm:col-span-2">
              <Textarea id="description" rows={8} {...register('description')} />
            </Field>
          </div>
        </Panel>

        <Panel title="Rasmlar">
          <GalleryField images={images} onChange={(imgs) => setValue('images', imgs, { shouldDirty: true })} />
        </Panel>

        <Panel title="Narx va ombor">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Sotuv narxi (so‘m)" required error={errors.price?.message} htmlFor="price"><Input id="price" inputMode="numeric" {...register('price')} /></Field>
            <Field label="Eski narx" error={err('compare_at_price')} hint="Chegirma ko‘rsatish uchun" htmlFor="compare_at_price"><Input id="compare_at_price" inputMode="numeric" {...register('compare_at_price')} /></Field>
            {canSeeCost && (
              <Field label="Tannarx" htmlFor="cost_price" hint={margin !== null ? `Marja: ${margin}% (${formatPrice(price - cost)})` : 'Mijozlarga ko‘rinmaydi'} error={err('cost_price')}>
                <Input id="cost_price" inputMode="numeric" {...register('cost_price')} />
              </Field>
            )}
            <Field label="SKU (artikul)" error={err('sku')} htmlFor="sku"><Input id="sku" {...register('sku')} /></Field>
            <Field label="Shtrix-kod" htmlFor="barcode"><Input id="barcode" inputMode="numeric" {...register('barcode')} /></Field>
            <Field label="Og‘irlik (gramm)" htmlFor="weight_grams"><Input id="weight_grams" inputMode="numeric" {...register('weight_grams')} /></Field>
            {!hasVariants && (
              <Field label="Qoldiq (dona)" htmlFor="stock" error={errors.stock?.message} hint={id && !canStock ? 'O‘zgartirish uchun ombor huquqi kerak' : id ? 'O‘zgarish ombor tarixiga yoziladi' : undefined}>
                <Input id="stock" inputMode="numeric" disabled={Boolean(id) && !canStock} {...register('stock')} />
              </Field>
            )}
            <Field label="Kam qoldiq chegarasi" htmlFor="low_stock_threshold"><Input id="low_stock_threshold" inputMode="numeric" {...register('low_stock_threshold')} /></Field>
            <div className="flex items-end pb-2"><Checkbox label="Qoldiqni hisoblash" {...register('track_stock')} /></div>
          </div>
        </Panel>

        <Panel title={`Variantlar (${variants.fields.length})`} actions={
          <Button type="button" size="sm" variant="secondary" onClick={() => variants.append({ name: '', sku: '', color: '', color_hex: '', size: '', price: '' as unknown as number, compare_at_price: '' as unknown as number, stock: 0, is_active: true })}>
            <Plus className="h-4 w-4" /> Variant
          </Button>
        }>
          {variants.fields.length === 0 ? (
            <p className="text-sm text-muted">Rang/o‘lcham kabi variantlar bo‘lmasa, bo‘sh qoldiring. Variant qo‘shilsa, umumiy qoldiq variantlar yig‘indisidan hisoblanadi.</p>
          ) : (
            <div className="space-y-3">
              {variants.fields.map((f, i) => {
                const ve = (errors.variants?.[i] ?? {}) as Record<string, { message?: string }>;
                return (
                  <div key={f._key} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-4 lg:grid-cols-8">
                    <Field label="Nomi" error={ve.name?.message} className="col-span-2"><Input placeholder="Qora / M" {...register(`variants.${i}.name`)} /></Field>
                    <Field label="Rang"><Input {...register(`variants.${i}.color`)} /></Field>
                    <Field label="Rang kodi" error={ve.color_hex?.message}><Input placeholder="#000000" {...register(`variants.${i}.color_hex`)} /></Field>
                    <Field label="O‘lcham"><Input {...register(`variants.${i}.size`)} /></Field>
                    <Field label="Narx" hint="Bo‘sh = asosiy"><Input inputMode="numeric" {...register(`variants.${i}.price`)} /></Field>
                    <Field label="Qoldiq" error={ve.stock?.message}><Input inputMode="numeric" disabled={Boolean(watch(`variants.${i}.id`)) && !canStock} {...register(`variants.${i}.stock`)} /></Field>
                    <Field label="SKU"><Input {...register(`variants.${i}.sku`)} /></Field>
                    <div className="col-span-2 flex items-center justify-between sm:col-span-4 lg:col-span-8">
                      <Checkbox label="Faol" {...register(`variants.${i}.is_active`)} />
                      <button type="button" onClick={() => variants.remove(i)} className="flex items-center gap-1 text-sm text-red-600"><Trash2 className="h-4 w-4" /> O‘chirish</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Xususiyatlar" actions={<Button type="button" size="sm" variant="secondary" onClick={() => attrs.append({ name: '', value: '' })}><Plus className="h-4 w-4" /> Qo‘shish</Button>}>
          {attrs.fields.length === 0 && <p className="text-sm text-muted">Masalan: Material — Paxta, Kafolat — 12 oy.</p>}
          <div className="space-y-2">
            {attrs.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input placeholder="Nomi" aria-label="Xususiyat nomi" {...register(`attributes.${i}.name`)} />
                <Input placeholder="Qiymati" aria-label="Xususiyat qiymati" {...register(`attributes.${i}.value`)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => attrs.remove(i)} aria-label="O‘chirish"><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="SEO">
          <div className="grid gap-4">
            <Field label="SEO sarlavha" hint="Bo‘sh bo‘lsa — mahsulot nomi" htmlFor="seo_title"><Input id="seo_title" maxLength={120} {...register('seo_title')} /></Field>
            <Field label="SEO tavsif" hint="Qidiruv natijalarida ko‘rinadi, 160 belgigacha tavsiya etiladi" htmlFor="seo_description"><Textarea id="seo_description" rows={2} maxLength={300} {...register('seo_description')} /></Field>
          </div>
        </Panel>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20">
        <Panel title="Holat">
          <div className="space-y-3">
            <Checkbox label="Saytda ko‘rinadi (faol)" {...register('is_active')} />
            <Checkbox label="Tavsiya etilgan" {...register('is_featured')} />
            <Checkbox label="Xit (bestseller)" {...register('is_bestseller')} />
            <Checkbox label="Yangi" {...register('is_new')} />
          </div>
          <Button type="submit" className="mt-5 w-full" loading={isSubmitting} disabled={Boolean(id) && !isDirty}>{id ? 'O‘zgarishlarni saqlash' : 'Mahsulot yaratish'}</Button>
          {id && (
            <Link href={`/product/${watch('slug')}`} target="_blank" className="mt-2 flex items-center justify-center gap-1.5 text-sm text-brand hover:underline">
              Saytda ko‘rish <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </Panel>
        {id && canDelete && (
          <Button type="button" variant="outline" className="w-full text-red-600" onClick={async () => {
            if (!(await confirm({ title: 'Mahsulotni o‘chirish?', text: 'Buyurtmalar tarixida nomi saqlanib qoladi. Vaqtincha yashirish uchun “faol” belgisini olib tashlang.', danger: true, confirmText: 'O‘chirish' }))) return;
            const res = await deleteProducts([id]);
            toast(res.ok ? res.message ?? 'O‘chirildi' : res.error, res.ok ? 'success' : 'error');
            if (res.ok) router.replace('/admin/products');
          }}>
            <Trash2 className="h-4 w-4" /> Mahsulotni o‘chirish
          </Button>
        )}
      </aside>
    </form>
  );
}
