'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

// Saytning oʻzida (tahrir rejimi) sahifa matnini — masalan Savol-javobni — oʻzbekcha va ruscha tahrirlash.

const slugOk = (s: unknown) => typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s);
export interface InlinePage { uz: { title: string; content: string }; ru: { title: string; content: string } }

export async function loadPageForEdit(slug: string): Promise<ActionResult<InlinePage>> {
  if (!slugOk(slug)) return { ok: false, error: 'Topilmadi' };
  return withPermission('pages.write', async () => {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('pages').select('title, content, i18n').eq('slug', slug).maybeSingle();
    if (error) return { ok: false, error: dbErrorText(error) };
    if (!data) return { ok: false, error: 'Sahifa topilmadi' };
    const ru = ((data.i18n as { ru?: Record<string, string> } | null)?.ru ?? {});
    return { ok: true, data: { uz: { title: data.title as string, content: (data.content as string) ?? '' }, ru: { title: ru.title ?? '', content: ru.content ?? '' } } };
  });
}

const schema = z.object({
  uz: z.object({ title: z.string().trim().min(1, 'Sarlavha kiriting').max(160), content: z.string().max(50000) }),
  ru: z.object({ title: z.string().trim().max(160), content: z.string().max(50000) }),
});

export async function savePageInline(slug: string, input: unknown): Promise<ActionResult> {
  if (!slugOk(slug)) return { ok: false, error: 'Topilmadi' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Xato' };
  return withPermission('pages.write', async () => {
    const supabase = await getServerSupabase();
    const { data: cur, error: readErr } = await supabase.from('pages').select('id, i18n').eq('slug', slug).maybeSingle();
    if (readErr) return { ok: false, error: dbErrorText(readErr) };
    if (!cur) return { ok: false, error: 'Sahifa topilmadi' };
    const i18n = (cur.i18n as Record<string, unknown>) ?? {};
    const oldRu = (i18n.ru as Record<string, string>) ?? {};
    const ru: Record<string, string> = { ...oldRu };
    const { ru: r, uz } = parsed.data;
    if (r.title) ru.title = r.title; else delete ru.title;
    if (r.content.trim()) ru.content = r.content.replace(/\r\n/g, '\n').trim(); else delete ru.content;
    const { error } = await supabase.from('pages')
      .update({ title: uz.title, content: uz.content.replace(/\r\n/g, '\n').trim(), i18n: { ...i18n, ru }, updated_at: new Date().toISOString() })
      .eq('id', cur.id);
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidateTag(TAGS.pages);
    revalidatePath(`/${slug}`);
    return { ok: true, message: 'Saqlandi' };
  });
}
