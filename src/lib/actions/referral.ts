'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { referralErrorText } from '@/lib/referral';
import type { ActionResult } from '@/lib/types';

// Mijoz: doʻst taklifi sahifasidagi amallar. Hamma tekshiruv bazada (security definer funksiyalar).

export async function trackReferral(kind: 'share' | 'copy' | 'view'): Promise<void> {
  if (!['share', 'copy', 'view'].includes(kind)) return;
  if (!(await getCurrentUser())) return;
  const supabase = await getServerSupabase();
  await supabase.rpc('referral_track', { p_kind: kind });
}

export async function applyPartner(): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, error: 'Avval tizimga kiring' };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('partner_apply');
  if (error) return { ok: false, error: referralErrorText(error.message) };
  revalidatePath('/account/referral');
  return { ok: true, message: data === 'active' ? 'Siz hamkorsiz!' : 'Arizangiz qabul qilindi. Tez orada koʻrib chiqamiz' };
}

const payoutSchema = z.object({
  amount: z.coerce.number().int().positive('Summani yozing').max(1_000_000_000),
  card: z.string().trim().min(16, 'Karta raqamini toʻliq yozing').max(23),
});

export async function requestPayout(input: unknown): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, error: 'Avval tizimga kiring' };
  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Maʼlumotlar notoʻgʻri' };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc('partner_request_payout', { p_amount: parsed.data.amount, p_card: parsed.data.card });
  if (error) return { ok: false, error: referralErrorText(error.message) };
  revalidatePath('/account/referral');
  return { ok: true, message: 'Soʻrov yuborildi. Pul kartangizga oʻtkazilgach xabar beramiz' };
}

/** Savat va rasmiylashtirishda “Kuponlarim”: mijozning ishlatilmagan shaxsiy kuponlari. */
export async function myActiveCoupons(): Promise<{ code: string; value: number; min_order_amount: number; ends_at: string | null }[]> {
  if (!(await getCurrentUser())) return [];
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('my_referral');
  const list = ((data as { coupons?: { code: string; value: number; min_order_amount: number; ends_at: string | null; used: boolean }[] } | null)?.coupons ?? []);
  const now = Date.now();
  return list.filter((c) => !c.used && (!c.ends_at || new Date(c.ends_at).getTime() > now))
    .map(({ code, value, min_order_amount, ends_at }) => ({ code, value: Number(value), min_order_amount: Number(min_order_amount), ends_at }))
    .slice(0, 6);
}
