'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { withPermission } from '@/lib/admin/action';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { DEFAULT_TOURS, toursSchema, type Tours } from '@/lib/tours';
import type { ActionResult } from '@/lib/types';

/** Yoʻl-yoʻriqni saqlash. again=true — hamma (eski koʻrganlar ham) yangi matnni yana bir marta koʻradi. */
export async function saveTours(input: Tours, again: boolean): Promise<ActionResult> {
  return withPermission('settings.write', async (ctx) => {
    const parsed = toursSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Maʼlumot notoʻgʻri' };
    const db = getServiceSupabase();
    const { data: cur } = await db.from('app_meta').select('value').eq('key', 'tours').maybeSingle();
    const prevVersion = Number((cur?.value as Tours | undefined)?.version ?? DEFAULT_TOURS.version);
    const value: Tours = { ...parsed.data, version: again ? prevVersion + 1 : prevVersion };
    const { error } = await db.from('app_meta').upsert({ key: 'tours', value, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
    await db.from('audit_logs').insert({ actor_id: ctx.userId, actor_email: ctx.email, action: 'tours_save', entity: 'settings', new_data: { shop: value.shop.length, admin: value.admin.length, again } });
    revalidateTag('tours');
    revalidatePath('/', 'layout');
    return { ok: true, message: again ? 'Saqlandi — hammaga yana bir marta koʻrsatiladi' : 'Saqlandi' };
  });
}
