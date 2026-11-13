'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import type { ActionResult } from '@/lib/types';

const branchSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, 'Nomini kiriting').max(60),
  is_active: z.boolean().default(true),
});

/**
 * Filial qoʻshish yoki nomini oʻzgartirish (kassa 3.4). Faqat Ega: bazadagi RLS ham shuni tekshiradi.
 * Filial oʻchirilmaydi (eski buyurtmalar unga bogʻlangan) — faqat faolsizlantiriladi.
 */
export async function saveBranch(input: z.input<typeof branchSchema>): Promise<ActionResult> {
  return withPermission('settings.write', async (ctx) => {
    if (!ctx.roles.includes('super_admin')) return { ok: false, error: 'Filiallarni faqat Ega boshqaradi' };
    const parsed = branchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Notoʻgʻri soʻrov' };
    const { id, ...row } = parsed.data;
    const supabase = await getServerSupabase();
    if (id === 1 && !row.is_active) return { ok: false, error: 'Asosiy filialni oʻchirib boʻlmaydi' };
    const { error } = id
      ? await supabase.from('branches').update(row).eq('id', id)
      : await supabase.from('branches').insert(row);
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidatePath('/admin', 'layout');
    return { ok: true, message: id ? 'Filial saqlandi' : 'Filial qoʻshildi' };
  });
}
