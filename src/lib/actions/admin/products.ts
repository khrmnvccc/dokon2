'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import { productSchema } from '@/lib/admin/schemas';
import { fieldErrors } from '@/lib/validation';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

function refresh() {
  revalidateTag(TAGS.products);
  revalidatePath('/admin/products');
}

export async function saveProduct(id: string | null, input: unknown): Promise<ActionResult<{ id: string; warnings: string[] }>> {
  return withPermission('products.write', async (ctx) => {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Formadagi xatolarni tuzating', fieldErrors: fieldErrors(parsed.error) };
    const { images, variants, stock, ...fields } = parsed.data;
    const supabase = await getServerSupabase();
    const warnings: string[] = [];
    const canStock = ctx.permissions.has('inventory.write');
    const hasVariants = variants.length > 0;
    const row = { ...fields, has_variants: hasVariants };

    let productId = id;
    let oldStock: number | null = null;
    if (id) {
      const { data: existing } = await supabase.from('products').select('id, stock, has_variants').eq('id', id).maybeSingle();
      if (!existing) return { ok: false, error: 'Mahsulot topilmadi' };
      oldStock = existing.stock;
      const { error } = await supabase.from('products').update(row).eq('id', id);
      if (error) return { ok: false, error: dbErrorText(error) };
    } else {
      const { data, error } = await supabase.from('products').insert({ ...row, stock: hasVariants ? 0 : stock }).select('id').single();
      if (error || !data) return { ok: false, error: dbErrorText(error) };
      productId = data.id;
    }
    const pid = productId!;

    // ---- Rasmlar ----
    const { data: oldImages } = await supabase.from('product_images').select('id, storage_path').eq('product_id', pid);
    const keep = new Set(images.map((i) => i.id).filter(Boolean));
    const removed = (oldImages ?? []).filter((i) => !keep.has(i.id));
    if (removed.length) {
      await supabase.from('product_images').delete().in('id', removed.map((i) => i.id));
      const paths = removed.map((i) => i.storage_path).filter((p): p is string => Boolean(p));
      if (paths.length) await supabase.storage.from('media').remove(paths);
    }
    if (images.length) {
      await supabase.from('product_images').update({ is_primary: false }).eq('product_id', pid);
      const primaryIndex = Math.max(0, images.findIndex((i) => i.is_primary));
      for (const [index, img] of images.entries()) {
        const data = { product_id: pid, url: img.url, storage_path: img.storage_path, alt: img.alt, sort_order: index, is_primary: index === primaryIndex };
        const { error } = img.id
          ? await supabase.from('product_images').update(data).eq('id', img.id).eq('product_id', pid)
          : await supabase.from('product_images').insert(data);
        if (error) warnings.push(`Rasm saqlanmadi: ${dbErrorText(error)}`);
      }
    }

    // ---- Variantlar ----
    const { data: oldVariants } = await supabase.from('product_variants').select('id, stock').eq('product_id', pid);
    const oldVariantStock = new Map((oldVariants ?? []).map((v) => [v.id, v.stock as number]));
    const keepVariants = new Set(variants.map((v) => v.id).filter(Boolean));
    const removedVariants = (oldVariants ?? []).filter((v) => !keepVariants.has(v.id)).map((v) => v.id);
    if (removedVariants.length) await supabase.from('product_variants').delete().in('id', removedVariants);
    for (const [index, v] of variants.entries()) {
      const { id: vid, stock: vStock, ...vFields } = v;
      if (vid && oldVariantStock.has(vid)) {
        const { error } = await supabase.from('product_variants').update({ ...vFields, sort_order: index }).eq('id', vid);
        if (error) warnings.push(`${v.name}: ${dbErrorText(error)}`);
        if (vStock !== oldVariantStock.get(vid)) {
          if (canStock) {
            const { error: e } = await supabase.rpc('adjust_stock', { p_product_id: pid, p_variant_id: vid, p_new_stock: vStock, p_note: 'Mahsulot formasi' });
            if (e) warnings.push(`${v.name} qoldig‘i: ${dbErrorText(e)}`);
          } else warnings.push(`${v.name}: qoldiqni o‘zgartirish uchun ombor huquqi kerak`);
        }
      } else {
        const { error } = await supabase.from('product_variants').insert({ ...vFields, product_id: pid, sort_order: index, stock: canStock || !id ? vStock : 0 });
        if (error) warnings.push(`${v.name}: ${dbErrorText(error)}`);
      }
    }

    // ---- Oddiy mahsulot qoldig'i (tarix bilan) ----
    if (id && !hasVariants && oldStock !== null && stock !== oldStock) {
      if (canStock) {
        const { error } = await supabase.rpc('adjust_stock', { p_product_id: pid, p_variant_id: null, p_new_stock: stock, p_note: 'Mahsulot formasi' });
        if (error) warnings.push(`Qoldiq: ${dbErrorText(error)}`);
      } else warnings.push('Qoldiqni o‘zgartirish uchun ombor huquqi kerak');
    }

    refresh();
    revalidatePath(`/admin/products/${pid}`);
    return { ok: true, data: { id: pid, warnings }, message: id ? 'Mahsulot saqlandi' : 'Mahsulot yaratildi' };
  });
}

const idsSchema = z.array(z.string().uuid()).min(1).max(500);

export async function deleteProducts(ids: string[]): Promise<ActionResult> {
  return withPermission('products.delete', async () => {
    const parsed = idsSchema.safeParse(ids);
    if (!parsed.success) return { ok: false, error: 'Mahsulot tanlanmagan' };
    const supabase = await getServerSupabase();
    const { data: imgs } = await supabase.from('product_images').select('storage_path').in('product_id', parsed.data);
    const { error } = await supabase.from('products').delete().in('id', parsed.data);
    if (error) return { ok: false, error: dbErrorText(error, 'O‘chirib bo‘lmadi') };
    const paths = (imgs ?? []).map((i) => i.storage_path).filter((p): p is string => Boolean(p));
    if (paths.length) await supabase.storage.from('media').remove(paths);
    refresh();
    return { ok: true, message: `${parsed.data.length} ta mahsulot o‘chirildi` };
  });
}

const bulkSchema = z.object({
  ids: idsSchema,
  action: z.enum(['activate', 'deactivate', 'category', 'price_percent', 'flag_on', 'flag_off']),
  category_id: z.string().uuid().nullable().optional(),
  percent: z.number().min(-90).max(500).optional(),
  flag: z.enum(['is_featured', 'is_bestseller', 'is_new']).optional(),
});

/** Ommaviy tahrirlash */
export async function bulkUpdateProducts(input: z.input<typeof bulkSchema>): Promise<ActionResult> {
  return withPermission('products.write', async () => {
    const parsed = bulkSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Noto‘g‘ri so‘rov' };
    const { ids, action } = parsed.data;
    const supabase = await getServerSupabase();
    let error: { code?: string; message?: string } | null = null;
    if (action === 'activate' || action === 'deactivate') {
      ({ error } = await supabase.from('products').update({ is_active: action === 'activate' }).in('id', ids));
    } else if (action === 'category') {
      ({ error } = await supabase.from('products').update({ category_id: parsed.data.category_id ?? null }).in('id', ids));
    } else if ((action === 'flag_on' || action === 'flag_off') && parsed.data.flag) {
      ({ error } = await supabase.from('products').update({ [parsed.data.flag]: action === 'flag_on' }).in('id', ids));
    } else if (action === 'price_percent' && parsed.data.percent) {
      const { data: rows } = await supabase.from('products').select('id, price, compare_at_price').in('id', ids);
      const k = 1 + parsed.data.percent / 100;
      for (const r of rows ?? []) {
        // 100 so'mgacha yaxlitlash
        const price = Math.max(0, Math.round((r.price * k) / 100) * 100);
        const compare = r.compare_at_price && r.compare_at_price > price ? r.compare_at_price : null;
        const res = await supabase.from('products').update({ price, compare_at_price: compare }).eq('id', r.id);
        if (res.error) error = res.error;
      }
    } else return { ok: false, error: 'Noto‘g‘ri so‘rov' };
    if (error) return { ok: false, error: dbErrorText(error) };
    refresh();
    return { ok: true, message: `${ids.length} ta mahsulot yangilandi` };
  });
}

export async function adjustStock(productId: string, variantId: string | null, newStock: number, note?: string): Promise<ActionResult> {
  return withPermission('inventory.write', async () => {
    const parsed = z.object({ p: z.string().uuid(), v: z.string().uuid().nullable(), s: z.number().int().min(0).max(1_000_000), n: z.string().max(200).optional() })
      .safeParse({ p: productId, v: variantId, s: newStock, n: note });
    if (!parsed.success) return { ok: false, error: 'Qoldiq noto‘g‘ri' };
    const supabase = await getServerSupabase();
    const { error } = await supabase.rpc('adjust_stock', { p_product_id: productId, p_variant_id: variantId, p_new_stock: newStock, p_note: note || null });
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidateTag(TAGS.products);
    revalidatePath('/admin/inventory');
    return { ok: true, message: 'Qoldiq yangilandi' };
  });
}
