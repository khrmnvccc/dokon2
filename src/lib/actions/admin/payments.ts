'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { withPermission } from '@/lib/admin/action';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { cleanKeys, getPaymentKeys, savePaymentKeys } from '@/lib/payments/config';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

// Click / Payme kalitlari: faqat Ega. Boʻsh qoldirilgan maxfiy maydon — oldingi qiymat saqlanadi.
const secret = z.string().trim().max(200).optional();
const clickInput = z.object({
  enabled: z.boolean(),
  service_id: z.string().trim().regex(/^\d{0,20}$/, 'Faqat raqam'),
  merchant_id: z.string().trim().regex(/^\d{0,20}$/, 'Faqat raqam'),
  merchant_user_id: z.string().trim().regex(/^\d{0,20}$/, 'Faqat raqam'),
  secret_key: secret,
});
const paymeInput = z.object({
  enabled: z.boolean(),
  merchant_id: z.string().trim().regex(/^[a-f0-9]{0,40}$/i, 'Merchant ID — 24 belgili kod (kabinetdan nusxalang)'),
  key: secret,
  test_key: secret,
  test_mode: z.boolean(),
  account_field: z.string().trim().regex(/^[a-z_]{2,30}$/, 'Faqat lotin kichik harf va _'),
});

/** Yoqilgan provayder uchun toʻlov usuli (checkout'dagi qator) yoʻq boʻlsa — yaratiladi. */
async function ensureMethod(provider: 'click' | 'payme') {
  const db = getServiceSupabase();
  const { data } = await db.from('payment_methods').select('id').eq('kind', 'online').eq('provider', provider).limit(1);
  if (data?.length) return;
  const { count } = await db.from('payment_methods').select('id', { count: 'exact', head: true });
  await db.from('payment_methods').insert({
    code: provider, name: provider === 'click' ? 'Click' : 'Payme', kind: 'online', provider, is_active: true,
    description: provider === 'click' ? 'Click ilovasi yoki karta orqali' : 'Payme ilovasi yoki karta orqali (Uzcard, Humo)',
    sort_order: ((count ?? 0) + 1) * 10,
  });
}

export async function savePaymentProvider(provider: 'click' | 'payme', input: unknown): Promise<ActionResult> {
  return withPermission('payments.write', async (ctx) => {
    if (!ctx.roles.includes('super_admin')) return { ok: false, error: 'Toʻlov kalitlarini faqat Ega kiritadi' };
    const keys = await getPaymentKeys();
    if (provider === 'click') {
      const r = clickInput.safeParse(input);
      if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Qiymatlarda xato bor' };
      const d = r.data;
      keys.click = { ...keys.click, enabled: d.enabled, service_id: d.service_id, merchant_id: d.merchant_id, merchant_user_id: d.merchant_user_id, secret_key: d.secret_key || keys.click.secret_key };
      if (d.enabled && !(keys.click.service_id && keys.click.merchant_id && keys.click.secret_key)) return { ok: false, error: 'Yoqish uchun Service ID, Merchant ID va Secret key kerak' };
    } else if (provider === 'payme') {
      const r = paymeInput.safeParse(input);
      if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Qiymatlarda xato bor' };
      const d = r.data;
      keys.payme = { ...keys.payme, enabled: d.enabled, merchant_id: d.merchant_id, test_mode: d.test_mode, account_field: d.account_field, key: d.key || keys.payme.key, test_key: d.test_key || keys.payme.test_key };
      const active = keys.payme.test_mode ? keys.payme.test_key : keys.payme.key;
      if (d.enabled && !(keys.payme.merchant_id && active)) return { ok: false, error: `Yoqish uchun Merchant ID va ${keys.payme.test_mode ? 'test kaliti' : 'kalit'} kerak` };
    } else return { ok: false, error: 'Nomaʼlum provayder' };
    await savePaymentKeys(cleanKeys(keys));
    if (keys[provider].enabled) await ensureMethod(provider);
    revalidateTag(TAGS.methods);
    revalidatePath('/admin/methods');
    revalidatePath('/checkout');
    return { ok: true, message: keys[provider].enabled ? 'Saqlandi. Checkout’da koʻrinadi' : 'Saqlandi (oʻchiq)' };
  });
}

/** Maxfiy kalitni oʻchirish (masalan, almashtirishdan oldin). */
export async function clearPaymentSecret(provider: 'click' | 'payme', field: 'secret_key' | 'key' | 'test_key'): Promise<ActionResult> {
  return withPermission('payments.write', async (ctx) => {
    if (!ctx.roles.includes('super_admin')) return { ok: false, error: 'Faqat Ega' };
    const keys = await getPaymentKeys();
    if (provider === 'click' && field === 'secret_key') keys.click = { ...keys.click, secret_key: '', enabled: false };
    else if (provider === 'payme' && (field === 'key' || field === 'test_key')) keys.payme = { ...keys.payme, [field]: '', enabled: false };
    else return { ok: false, error: 'Notoʻgʻri maydon' };
    await savePaymentKeys(keys);
    revalidatePath('/admin/methods');
    return { ok: true, message: 'Kalit oʻchirildi, provayder oʻchirildi' };
  });
}
