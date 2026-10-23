'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
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
  return { ok: true, message: 'Buyurtma yangilandi' };
}
