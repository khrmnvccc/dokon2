'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getStaffContext } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { clearSmsCreds, saveSmsCreds, sendSms, smsBalance } from '@/lib/sms/eskiz';
import type { ActionResult } from '@/lib/types';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Xatolik');

async function owner() {
  const ctx = await getStaffContext();
  return ctx?.roles.includes('super_admin') ? ctx : null;
}

const credsSchema = z.object({
  email: z.string().trim().email('Email notoʻgʻri').max(120),
  password: z.string().max(200).default(''),
  from: z.string().trim().max(11).regex(/^[A-Za-z0-9 ._-]*$/, 'Joʻnatuvchi nomi notoʻgʻri').default('4546'),
});

/** Faqat Ega: Eskiz login/parol (boʻsh parol — eskisi qoladi). Saqlashdan oldin Eskiz’ga kirib tekshiriladi. */
export async function saveSmsCredsAction(input: z.input<typeof credsSchema>): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { ok: false, error: 'Faqat doʻkon egasi kiritadi' };
  const parsed = credsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Maʼlumot notoʻgʻri' };
  try {
    await saveSmsCreds(parsed.data);
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
  await getServiceSupabase().from('audit_logs').insert({ actor_id: ctx.userId, actor_email: ctx.email, action: 'sms_creds_save', entity: 'settings', new_data: { from: parsed.data.from } });
  revalidatePath('/admin/sms');
  return { ok: true, message: 'Eskiz ulandi' };
}

export async function clearSmsCredsAction(): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return { ok: false, error: 'Faqat doʻkon egasi' };
  await clearSmsCreds();
  await getServiceSupabase().from('audit_logs').insert({ actor_id: ctx.userId, actor_email: ctx.email, action: 'sms_creds_clear', entity: 'settings' });
  revalidatePath('/admin/sms');
  return { ok: true, message: 'Eskiz uzildi' };
}

export async function testSmsAction(phone: string, text: string): Promise<ActionResult> {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('messages.manage')) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const body = text.trim().slice(0, 900);
  if (!body) return { ok: false, error: 'Matnni kiriting' };
  try {
    await sendSms(phone, body, { event: 'test' });
    revalidatePath('/admin/sms');
    return { ok: true, message: 'SMS yuborildi' };
  } catch (e) {
    revalidatePath('/admin/sms');
    return { ok: false, error: errText(e) };
  }
}

export async function smsBalanceAction(): Promise<ActionResult<{ balance: number | null }>> {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('messages.manage')) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  try {
    return { ok: true, data: { balance: await smsBalance() } };
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
}
