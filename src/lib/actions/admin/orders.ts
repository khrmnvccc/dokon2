'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { onOrderUpdate } from '@/lib/telegram/events';
import { notifyReceiptDecision } from '@/lib/telegram/shop-bot';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getStaffContext } from '@/lib/auth';
import { dbErrorText } from '@/lib/admin/action';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

const schema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']).nullable().optional(),
  note: z.string().trim().max(500).optional().nullable(),
  tracking_number: z.string().trim().max(80).optional().nullable(),
  admin_note: z.string().trim().max(2000).optional().nullable(),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']).nullable().optional(),
});

/** Buyurtmani yangilash. Ruxsatlar va holat o'tishlari bazadagi admin_update_order ichida tekshiriladi. */
export async function updateOrder(input: z.input<typeof schema>): Promise<ActionResult> {
  const ctx = await getStaffContext();
  if (!ctx || !(ctx.permissions.has('orders.write') || ctx.permissions.has('orders.fulfill'))) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ma’lumotlar noto‘g‘ri' };
  const d = parsed.data;
  if (d.status === 'cancelled' && !d.note) return { ok: false, error: 'Bekor qilish sababini yozing', fieldErrors: { note: 'Sababni yozing' } };
  const supabase = await getServerSupabase();
  if (d.status) {
    const { data: cur } = await supabase.from('orders').select('status').eq('id', d.orderId).maybeSingle();
    if (cur?.status === d.status) return { ok: false, error: 'Buyurtma allaqachon shu holatda. Sahifani yangilang.' };
  }
  const { error } = await supabase.rpc('admin_update_order', {
    p_order_id: d.orderId,
    p_status: d.status ?? null,
    p_note: d.note ?? null,
    p_tracking_number: d.tracking_number ?? null,
    p_admin_note: ctx.permissions.has('orders.write') ? d.admin_note ?? null : null,
    p_payment_status: ctx.permissions.has('orders.write') ? d.payment_status ?? null : null,
  });
  if (error) return { ok: false, error: dbErrorText(error, 'Yangilab bo‘lmadi') };
  revalidatePath(`/admin/orders/${d.orderId}`);
  revalidatePath('/admin/orders');
  if (d.status === 'cancelled' || d.status === 'returned') revalidateTag(TAGS.products);
  if (d.status || d.payment_status) {
    const { data: me } = await supabase.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle();
    const by = me?.full_name || ctx.email || 'Xodim';
    after(() => onOrderUpdate(d.orderId, { status: d.status, payment: ctx.permissions.has('orders.write') ? d.payment_status : null, note: d.note, by }));
  }
  return { ok: true, message: 'Buyurtma yangilandi' };
}

const reviewSchema = z.object({ receiptId: z.string().uuid(), orderId: z.string().uuid(), approve: z.boolean(), note: z.string().trim().max(500).optional().nullable() });

/** Kartaga toʻlov chekini tasdiqlash (buyurtma “Toʻlangan”) yoki rad etish (mijoz qayta yuklaydi). */
export async function reviewReceipt(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.permissions.has('orders.write')) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ma’lumotlar noto‘g‘ri' };
  const d = parsed.data;
  if (!d.approve && !d.note) return { ok: false, error: 'Rad etish sababini yozing', fieldErrors: { note: 'Sababni yozing' } };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc('admin_review_receipt', { p_receipt: d.receiptId, p_approve: d.approve, p_note: d.note ?? null });
  if (error) return { ok: false, error: dbErrorText(error, 'Saqlab bo‘lmadi') };
  revalidatePath(`/admin/orders/${d.orderId}`);
  revalidatePath('/admin/orders');
  revalidatePath(`/account/orders/${d.orderId}`);
  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle();
  const by = me?.full_name || ctx.email || 'Xodim';
  after(async () => {
    await notifyReceiptDecision(d.orderId, d.approve, d.note ?? null);
    if (d.approve) await onOrderUpdate(d.orderId, { payment: 'paid', by });
  });
  return { ok: true, message: d.approve ? 'Toʻlov va buyurtma tasdiqlandi — endi joʻnatish mumkin' : 'Chek rad etildi, mijozga xabar berildi' };
}
