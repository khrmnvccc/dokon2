'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getStaffContext } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/format';
import type { ActionResult } from '@/lib/types';

const schema = z.object({
  clientNo: z.coerce.number().int().min(1),
  amount: z.coerce.number().int().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000_000),
  note: z.string().trim().max(300).optional().default(''),
});

/** Xodim: mijoz ID raqami boʻyicha bonus qoʻshish (+) yoki ayirish (−). */
export async function adjustBonus(input: z.input<typeof schema>): Promise<ActionResult<{ balance: number }>> {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('coupons.write')) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Mijoz ID va summani toʻgʻri kiriting' };
  const supabase = await getServerSupabase();
  const { data: p } = await supabase.from('profiles').select('id, full_name').eq('client_no', parsed.data.clientNo).maybeSingle();
  if (!p) return { ok: false, error: `ID ${parsed.data.clientNo} boʻlgan mijoz topilmadi` };
  const { data, error } = await supabase.rpc('admin_bonus_adjust', { p_user: p.id, p_amount: parsed.data.amount, p_note: parsed.data.note || null });
  if (error) return { ok: false, error: error.message.includes('BALANCE') ? 'Mijozda buncha bonus yoʻq' : 'Saqlab boʻlmadi' };
  revalidatePath('/admin/bonus');
  return { ok: true, data: { balance: Number(data) }, message: `${p.full_name ?? 'Mijoz'}: balans ${formatPrice(Number(data))}` };
}
