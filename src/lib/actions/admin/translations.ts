'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import { getRawSettings } from '@/lib/data/public';
import { I18N_FIELDS, type I18nTable } from '@/lib/i18n/content';
import { settingKeyLabel, settingsTexts, type SettingText } from '@/lib/i18n/settings-texts';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

// Tarjimalar: Ega har bir matnning ruschasini kiritadi. Oʻzbekcha asl matn oʻzgarmaydi;
// ruscha i18n ustuniga (jadvallar) yoki site_settings 'translations' ga (sayt matnlari) yoziladi.

const PERM: Record<I18nTable, string> = {
  products: 'products.write', categories: 'categories.write', banners: 'banners.write', pages: 'pages.write',
  promotions: 'promotions.write', shipping_methods: 'payments.write', payment_methods: 'payments.write',
};
const TAG: Record<I18nTable, string> = {
  products: TAGS.products, categories: TAGS.categories, banners: TAGS.banners, pages: TAGS.pages,
  promotions: TAGS.promotions, shipping_methods: TAGS.methods, payment_methods: TAGS.methods,
};
const LABEL_FIELD: Record<I18nTable, string> = {
  products: 'name', categories: 'name', banners: 'title', pages: 'title', promotions: 'title', shipping_methods: 'name', payment_methods: 'name',
};
const MAX: Record<string, number> = { description: 20000, content: 50000, instructions: 2000 };
const isTable = (t: unknown): t is I18nTable => typeof t === 'string' && t in I18N_FIELDS;

export interface TranslationRow {
  id: string;
  label: string;
  uz: Record<string, string>;
  ru: Record<string, string>;
  attributes?: { uz: { name: string; value: string }[]; ru: { name: string; value: string }[] };
}

/** Bitta boʻlim yozuvlari (mahsulotlar — qidiruv va sahifalash bilan). */
export async function loadTranslations(table: string, q = '', offset = 0): Promise<ActionResult<{ rows: TranslationRow[]; total: number }>> {
  if (!isTable(table)) return { ok: false, error: 'Notoʻgʻri boʻlim' };
  return withPermission(PERM[table], async () => {
    const fields = I18N_FIELDS[table] as readonly string[];
    const supabase = await getServerSupabase();
    const cols = ['id', ...fields, 'i18n', ...(table === 'products' ? ['attributes'] : [])].join(', ');
    let query = supabase.from(table).select(cols, { count: 'exact' });
    const term = q.trim().slice(0, 80).replace(/[%_,()]/g, ' ');
    if (term) query = query.ilike(LABEL_FIELD[table], `%${term}%`);
    if (table === 'products') query = query.order('name').range(Math.max(0, offset), Math.max(0, offset) + 29);
    else query = query.order(LABEL_FIELD[table]).limit(500);
    const { data, error, count } = await query;
    if (error) return { ok: false, error: dbErrorText(error, 'Yuklab boʻlmadi') };
    const rows: TranslationRow[] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
      const ru = ((r.i18n as { ru?: Record<string, unknown> } | null)?.ru ?? {}) as Record<string, unknown>;
      const row: TranslationRow = {
        id: String(r.id),
        label: String(r[LABEL_FIELD[table]] ?? ''),
        uz: Object.fromEntries(fields.map((f) => [f, String(r[f] ?? '')])),
        ru: Object.fromEntries(fields.map((f) => [f, typeof ru[f] === 'string' ? (ru[f] as string) : ''])),
      };
      if (table === 'products') {
        const uzAttrs = Array.isArray(r.attributes) ? (r.attributes as { name: string; value: string }[]) : [];
        const ruAttrs = Array.isArray(ru.attributes) ? (ru.attributes as { name: string; value: string }[]) : [];
        row.attributes = { uz: uzAttrs, ru: uzAttrs.map((_, i) => ({ name: ruAttrs[i]?.name ?? '', value: ruAttrs[i]?.value ?? '' })) };
      }
      return row;
    });
    return { ok: true, data: { rows, total: count ?? rows.length } };
  });
}

const attrSchema = z.array(z.object({ name: z.string().trim().max(120), value: z.string().trim().max(500) })).max(60);

/** Bitta yozuvning ruschasini saqlaydi (boʻsh maydon — oʻzbekchasi koʻrinadi). */
export async function saveTranslation(table: string, id: string, ru: Record<string, string>, attributes?: { name: string; value: string }[]): Promise<ActionResult> {
  if (!isTable(table)) return { ok: false, error: 'Notoʻgʻri boʻlim' };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Topilmadi' };
  return withPermission(PERM[table], async () => {
    const fields = I18N_FIELDS[table] as readonly string[];
    const clean: Record<string, unknown> = {};
    for (const f of fields) {
      const v = String(ru?.[f] ?? '').replace(/\r\n/g, '\n').trim();
      if (v.length > (MAX[f] ?? 500)) return { ok: false, error: 'Matn juda uzun' };
      if (v) clean[f] = v;
    }
    if (table === 'products' && attributes) {
      const a = attrSchema.safeParse(attributes);
      if (!a.success) return { ok: false, error: 'Xususiyatlarda xato' };
      if (a.data.some((x) => x.name || x.value)) clean.attributes = a.data;
    }
    const supabase = await getServerSupabase();
    const { data: cur, error: readErr } = await supabase.from(table).select('i18n').eq('id', id).maybeSingle();
    if (readErr) return { ok: false, error: dbErrorText(readErr) };
    if (!cur) return { ok: false, error: 'Topilmadi' };
    const i18n = { ...((cur.i18n as Record<string, unknown>) ?? {}), ru: clean };
    const { error } = await supabase.from(table).update({ i18n }).eq('id', id);
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidateTag(TAG[table]);
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Saqlandi' };
  });
}

/** Sayt matnlari (eʼlon qatori, footer, menyu, afzalliklar…): oʻzbekchasi va ruschasi. */
export async function loadSettingsTexts(): Promise<ActionResult<{ rows: (SettingText & { group: string })[] }>> {
  return withPermission('settings.write', async () => {
    const settings = await getRawSettings();
    const rows = settingsTexts(settings).map((t) => ({ ...t, group: settingKeyLabel(t.path) }));
    return { ok: true, data: { rows } };
  });
}

export async function saveSettingsTexts(ru: Record<string, string>): Promise<ActionResult> {
  return withPermission('settings.write', async (ctx) => {
    const settings = await getRawSettings();
    const allowed = new Set(settingsTexts(settings).map((t) => t.path));
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(ru ?? {})) {
      const val = String(v ?? '').trim();
      if (!allowed.has(k) || !val) continue;
      if (val.length > 2000) return { ok: false, error: 'Matn juda uzun' };
      clean[k] = val;
    }
    const supabase = await getServerSupabase();
    const { error } = await supabase.from('site_settings').upsert({ key: 'translations', value: { ru: clean }, updated_by: ctx.userId, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidateTag(TAGS.settings);
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Saqlandi' };
  });
}
