'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import { bannerSchema, categorySchema, couponSchema, pageSchema, paymentMethodSchema, promotionSchema, shippingMethodSchema } from '@/lib/admin/schemas';
import { fieldErrors } from '@/lib/validation';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

// Oddiy CRUD bo'limlari uchun yagona konfiguratsiya: jadval, sxema, ruxsat, kesh teglari
const ENTITIES = {
  categories: { table: 'categories', schema: categorySchema, perm: 'categories.write', tags: [TAGS.categories, TAGS.products], path: '/admin/categories' },
  banners: { table: 'banners', schema: bannerSchema, perm: 'banners.write', tags: [TAGS.banners], path: '/admin/banners' },
  promotions: { table: 'promotions', schema: promotionSchema, perm: 'promotions.write', tags: [TAGS.promotions, TAGS.products], path: '/admin/promotions' },
  coupons: { table: 'coupons', schema: couponSchema, perm: 'coupons.write', tags: [], path: '/admin/coupons' },
  pages: { table: 'pages', schema: pageSchema, perm: 'pages.write', tags: [TAGS.pages], path: '/admin/pages' },
  shipping_methods: { table: 'shipping_methods', schema: shippingMethodSchema, perm: 'payments.write', tags: [TAGS.methods], path: '/admin/methods' },
  payment_methods: { table: 'payment_methods', schema: paymentMethodSchema, perm: 'payments.write', tags: [TAGS.methods], path: '/admin/methods' },
} as const;

export type EntityName = keyof typeof ENTITIES;
const entityName = z.enum(Object.keys(ENTITIES) as [EntityName, ...EntityName[]]);
const uuid = z.string().uuid();

function refresh(name: EntityName) {
  const cfg = ENTITIES[name];
  cfg.tags.forEach((t) => revalidateTag(t));
  revalidatePath(cfg.path);
}

export async function saveEntity(name: EntityName, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const n = entityName.parse(name);
  const cfg = ENTITIES[n];
  return withPermission(cfg.perm, async () => {
    if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: 'Noto‘g‘ri ID' };
    const parsed = (cfg.schema as z.ZodTypeAny).safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Formadagi xatolarni tuzating', fieldErrors: fieldErrors(parsed.error) };
    const data = parsed.data as Record<string, unknown>;
    if (n === 'categories' && id && data.parent_id === id) return { ok: false, error: 'Kategoriya o‘ziga ota bo‘la olmaydi', fieldErrors: { parent_id: 'Boshqasini tanlang' } };
    const supabase = await getServerSupabase();
    const res = id
      ? await supabase.from(cfg.table).update(data).eq('id', id).select('id').single()
      : await supabase.from(cfg.table).insert(data).select('id').single();
    if (res.error || !res.data) return { ok: false, error: dbErrorText(res.error) };
    refresh(n);
    return { ok: true, data: { id: res.data.id as string }, message: 'Saqlandi' };
  });
}

export async function deleteEntity(name: EntityName, id: string): Promise<ActionResult> {
  const n = entityName.parse(name);
  const cfg = ENTITIES[n];
  return withPermission(cfg.perm, async () => {
    if (!uuid.safeParse(id).success) return { ok: false, error: 'Noto‘g‘ri ID' };
    const supabase = await getServerSupabase();
    const { error } = await supabase.from(cfg.table).delete().eq('id', id);
    if (error) return { ok: false, error: dbErrorText(error, 'O‘chirib bo‘lmadi') };
    refresh(n);
    return { ok: true, message: 'O‘chirildi' };
  });
}

/** Faol/nofaol tugmasi */
export async function toggleEntity(name: EntityName, id: string, field: 'is_active' | 'is_published', value: boolean): Promise<ActionResult> {
  const n = entityName.parse(name);
  const cfg = ENTITIES[n];
  return withPermission(cfg.perm, async () => {
    if (!uuid.safeParse(id).success) return { ok: false, error: 'Noto‘g‘ri ID' };
    if (field === 'is_published' && n !== 'pages') return { ok: false, error: 'Noto‘g‘ri maydon' };
    const supabase = await getServerSupabase();
    const { error } = await supabase.from(cfg.table).update({ [field]: Boolean(value) }).eq('id', id);
    if (error) return { ok: false, error: dbErrorText(error) };
    refresh(n);
    return { ok: true, message: value ? 'Yoqildi' : 'O‘chirildi' };
  });
}

/** Tartibni o'zgartirish (yuqoriga/pastga) */
export async function reorderEntity(name: 'categories' | 'banners' | 'shipping_methods' | 'payment_methods' | 'promotions', ids: string[]): Promise<ActionResult> {
  const n = entityName.parse(name);
  const cfg = ENTITIES[n];
  return withPermission(cfg.perm, async () => {
    const parsed = z.array(uuid).max(500).safeParse(ids);
    if (!parsed.success) return { ok: false, error: 'Noto‘g‘ri so‘rov' };
    const supabase = await getServerSupabase();
    for (const [i, id] of parsed.data.entries()) {
      const { error } = await supabase.from(cfg.table).update({ sort_order: i * 10 }).eq('id', id);
      if (error) return { ok: false, error: dbErrorText(error) };
    }
    refresh(n);
    return { ok: true, message: 'Tartib saqlandi' };
  });
}
