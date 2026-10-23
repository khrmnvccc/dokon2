'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import { parseCsv, parseXlsx, rowsToRecords } from '@/lib/admin/spreadsheet';
import { PRODUCT_HEADER_ALIASES } from '@/lib/admin/product-columns';
import { money, optMoney, slugSchema } from '@/lib/admin/schemas';
import { slugify } from '@/lib/format';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

const bool = z.preprocess((v) => {
  if (v === '' || v === undefined) return undefined;
  return ['1', 'true', 'ha', 'yes', 'да', '+'].includes(String(v).trim().toLowerCase());
}, z.boolean().optional());
const text = (max: number) => z.string().max(max).optional().transform((v) => (v ? v : undefined));

const rowSchema = z.object({
  sku: text(64),
  name: z.string().trim().min(2, 'name bo‘sh').max(200),
  slug: z.string().optional(),
  category: text(120),
  brand: text(80),
  price: money,
  compare_at_price: optMoney,
  cost_price: optMoney,
  stock: z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(String(v).replace(/\s/g, ''))), z.number().int().min(0).max(1_000_000).optional()),
  barcode: text(64),
  is_active: bool,
  is_featured: bool,
  is_bestseller: bool,
  is_new: bool,
  short_description: text(300),
  description: text(20000),
  image_url: z.string().max(1000).optional().refine((v) => !v || /^(https:\/\/|\/)/.test(v), 'image_url https:// yoki / bilan boshlansin'),
  seo_title: text(120),
  seo_description: text(300),
});

export interface ImportReport { total: number; created: number; updated: number; skipped: number; errors: { row: number; message: string }[]; dryRun: boolean }

const MAX_ROWS = 5000;

export async function importProducts(formData: FormData): Promise<ActionResult<ImportReport>> {
  return withPermission('products.write', async (ctx) => {
    const file = formData.get('file');
    const dryRun = formData.get('dryRun') === '1';
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Fayl tanlanmagan' };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'Fayl 5 MB dan oshmasin' };
    const isXlsx = /\.xlsx$/i.test(file.name);
    if (!isXlsx && !/\.csv$/i.test(file.name)) return { ok: false, error: 'Faqat .csv yoki .xlsx fayl' };

    let raw: string[][];
    try {
      raw = isXlsx ? await parseXlsx(await file.arrayBuffer()) : parseCsv(await file.text());
    } catch {
      return { ok: false, error: 'Faylni o‘qib bo‘lmadi. Formatni tekshiring' };
    }
    const records = rowsToRecords(raw, PRODUCT_HEADER_ALIASES);
    if (!records.length) return { ok: false, error: 'Faylda ma’lumot yo‘q (birinchi qator — sarlavhalar)' };
    if (records.length > MAX_ROWS) return { ok: false, error: `Bir martada ${MAX_ROWS} qatordan ko‘p bo‘lmasin` };

    const supabase = await getServerSupabase();
    const [{ data: categories }, { data: existing }] = await Promise.all([
      supabase.from('categories').select('id, slug, name'),
      supabase.from('products').select('id, sku, slug, stock, has_variants'),
    ]);
    const catBy = new Map<string, string>();
    for (const c of categories ?? []) {
      catBy.set(c.slug.toLowerCase(), c.id);
      catBy.set(c.name.toLowerCase(), c.id);
    }
    const bySku = new Map((existing ?? []).filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p]));
    const bySlug = new Map((existing ?? []).map((p) => [p.slug, p]));
    const canStock = ctx.permissions.has('inventory.write');

    const report: ImportReport = { total: records.length, created: 0, updated: 0, skipped: 0, errors: [], dryRun };
    const seen = new Set<string>();

    for (const [index, rec] of records.entries()) {
      const rowNo = index + 2;
      const parsed = rowSchema.safeParse(rec);
      if (!parsed.success) {
        report.errors.push({ row: rowNo, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
        continue;
      }
      const r = parsed.data;
      const slugParsed = slugSchema.safeParse(r.slug || slugify(r.name));
      if (!slugParsed.success) { report.errors.push({ row: rowNo, message: 'slug noto‘g‘ri' }); continue; }
      const slug = slugParsed.data;
      const key = (r.sku ?? slug).toLowerCase();
      if (seen.has(key)) { report.errors.push({ row: rowNo, message: 'Faylda takroriy SKU/slug' }); continue; }
      seen.add(key);
      if (r.compare_at_price !== null && r.compare_at_price <= r.price) { report.errors.push({ row: rowNo, message: 'compare_at_price narxdan katta bo‘lishi kerak' }); continue; }
      let categoryId: string | null | undefined;
      if (r.category) {
        categoryId = catBy.get(r.category.toLowerCase());
        if (!categoryId) { report.errors.push({ row: rowNo, message: `Kategoriya topilmadi: ${r.category}` }); continue; }
      }

      const match = (r.sku && bySku.get(r.sku.toLowerCase())) || bySlug.get(slug);
      const fields: Record<string, unknown> = {
        name: r.name, price: r.price, compare_at_price: r.compare_at_price,
        ...(r.sku !== undefined && { sku: r.sku }),
        ...(categoryId !== undefined && { category_id: categoryId }),
        ...(r.brand !== undefined && { brand: r.brand }),
        ...(r.cost_price !== null && { cost_price: r.cost_price }),
        ...(r.barcode !== undefined && { barcode: r.barcode }),
        ...(r.is_active !== undefined && { is_active: r.is_active }),
        ...(r.is_featured !== undefined && { is_featured: r.is_featured }),
        ...(r.is_bestseller !== undefined && { is_bestseller: r.is_bestseller }),
        ...(r.is_new !== undefined && { is_new: r.is_new }),
        ...(r.short_description !== undefined && { short_description: r.short_description }),
        ...(r.description !== undefined && { description: r.description }),
        ...(r.seo_title !== undefined && { seo_title: r.seo_title }),
        ...(r.seo_description !== undefined && { seo_description: r.seo_description }),
      };

      if (dryRun) {
        if (match) report.updated++; else report.created++;
        continue;
      }

      if (match) {
        const { error } = await supabase.from('products').update(fields).eq('id', match.id);
        if (error) { report.errors.push({ row: rowNo, message: dbErrorText(error) }); continue; }
        if (r.stock !== undefined && r.stock !== match.stock && !match.has_variants) {
          if (canStock) await supabase.rpc('adjust_stock', { p_product_id: match.id, p_variant_id: null, p_new_stock: r.stock, p_note: 'Import' });
          else report.errors.push({ row: rowNo, message: 'Qoldiq o‘zgarmadi: ombor huquqi kerak' });
        }
        report.updated++;
      } else {
        const { data, error } = await supabase.from('products').insert({ ...fields, slug, stock: r.stock ?? 0 }).select('id').single();
        if (error || !data) { report.errors.push({ row: rowNo, message: dbErrorText(error) }); continue; }
        if (r.image_url) await supabase.from('product_images').insert({ product_id: data.id, url: r.image_url, is_primary: true });
        bySlug.set(slug, { id: data.id, sku: r.sku ?? null, slug, stock: r.stock ?? 0, has_variants: false });
        report.created++;
      }
    }
    report.skipped = report.total - report.created - report.updated;
    if (!dryRun && (report.created || report.updated)) {
      revalidateTag(TAGS.products);
      revalidatePath('/admin/products');
    }
    return { ok: true, data: report };
  });
}
