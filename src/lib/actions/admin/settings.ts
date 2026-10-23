'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import { settingsSchemas, type SettingsKey } from '@/lib/settings-schema';
import { fieldErrors } from '@/lib/validation';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

/** Sayt sozlamalarini saqlash: har bir kalit zod sxemasi bilan tekshiriladi, keyin barcha sahifalar yangilanadi */
export async function saveSetting(key: SettingsKey, value: unknown): Promise<ActionResult> {
  return withPermission('settings.write', async (ctx) => {
    if (!(key in settingsSchemas)) return { ok: false, error: 'Noma’lum sozlama' };
    const parsed = settingsSchemas[key].safeParse(value);
    if (!parsed.success) return { ok: false, error: 'Qiymatlarda xato bor', fieldErrors: fieldErrors(parsed.error) };
    const supabase = await getServerSupabase();
    const { error } = await supabase.from('site_settings').upsert({ key, value: parsed.data, updated_by: ctx.userId, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidateTag(TAGS.settings);
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Sozlamalar saqlandi va saytda qo‘llandi' };
  });
}
