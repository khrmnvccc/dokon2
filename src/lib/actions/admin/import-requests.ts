'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { getStaffContext } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getRawSettings } from '@/lib/data/public';
import { quoteTotal } from '@/lib/import-requests';
import { loadImportRequest, notifyImportCustomer } from '@/lib/import-requests-server';
import type { ActionResult } from '@/lib/types';

const quoteSchema = z.object({
  name: z.string().trim().max(160).optional().default(''),
  item_price: z.coerce.number().int().min(0).max(10_000_000_000),
  service_fee: z.coerce.number().int().min(0).max(10_000_000_000),
  cargo_fee: z.coerce.number().int().min(0).max(10_000_000_000),
  quantity: z.coerce.number().int().min(1).max(100_000),
  days: z.string().trim().max(40).optional().default(''),
  note: z.string().trim().max(600).optional().default(''),
  staff_note: z.string().trim().max(1000).optional().default(''),
});

async function staff() {
  const ctx = await getStaffContext();
  return ctx?.permissions.has('orders.write') ? ctx : null;
}

/** Xodim: soʻrovga narx beradi (mijozga botdan xabar ketadi). Qayta berish ham mumkin (yangilangan narx). */
export async function quoteImportRequest(id: string, input: z.input<typeof quoteSchema>): Promise<ActionResult> {
  const ctx = await staff();
  if (!ctx) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Narxlarni toʻgʻri kiriting' };
  const d = parsed.data;
  const r = await loadImportRequest(id);
  if (!r) return { ok: false, error: 'Soʻrov topilmadi' };
  if (r.status !== 'new' && r.status !== 'quoted') return { ok: false, error: 'Bu soʻrov yopilgan' };
  const total = quoteTotal(d, d.quantity);
  if (total <= 0) return { ok: false, error: 'Narxni kiriting' };
  const cfg = (await getRawSettings()).import_requests;
  const quote = {
    name: d.name, item_price: d.item_price, service_fee: d.service_fee, cargo_fee: d.cargo_fee, total,
    days: d.days || cfg.default_days, note: d.note, valid_until: new Date(Date.now() + cfg.quote_valid_days * 86_400_000).toISOString(),
  };
  const { error } = await getServiceSupabase().from('import_requests').update({
    status: 'quoted', quote, quantity: d.quantity, quoted_at: new Date().toISOString(), quoted_by: ctx.userId,
    staff_note: d.staff_note || null, updated_at: new Date().toISOString(),
  }).eq('id', id).in('status', ['new', 'quoted']);
  if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
  after(() => notifyImportCustomer(id));
  revalidatePath(`/admin/import-requests/${id}`);
  revalidatePath('/admin/import-requests');
  return { ok: true, message: 'Narx yuborildi' };
}

export async function rejectImportRequest(id: string, reason: string): Promise<ActionResult> {
  const ctx = await staff();
  if (!ctx) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const why = reason.trim().slice(0, 500);
  if (!why) return { ok: false, error: 'Sababini yozing' };
  const { data, error } = await getServiceSupabase().from('import_requests')
    .update({ status: 'rejected', reject_reason: why, updated_at: new Date().toISOString() })
    .eq('id', id).in('status', ['new', 'quoted']).select('id');
  if (error || !data?.length) return { ok: false, error: 'Soʻrov yopilgan yoki topilmadi' };
  after(() => notifyImportCustomer(id));
  revalidatePath(`/admin/import-requests/${id}`);
  revalidatePath('/admin/import-requests');
  return { ok: true, message: 'Rad etildi' };
}

export async function saveImportNote(id: string, note: string): Promise<ActionResult> {
  if (!(await staff())) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const { error } = await getServiceSupabase().from('import_requests').update({ staff_note: note.trim().slice(0, 1000) || null }).eq('id', id);
  if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
  revalidatePath(`/admin/import-requests/${id}`);
  return { ok: true, message: 'Saqlandi' };
}
