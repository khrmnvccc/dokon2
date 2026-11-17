'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getStaffContext } from '@/lib/auth';
import { dbErrorText } from '@/lib/admin/action';
import { getRawSettings } from '@/lib/data/public';
import { onOrderUpdate } from '@/lib/telegram/events';
import { notifyCargo } from '@/lib/jobs/cargo';
import type { ActionResult, OrderStatus } from '@/lib/types';

const schema = z.object({
  orderIds: z.array(z.string().uuid()).max(500).default([]),
  tracks: z.array(z.string().trim().max(80)).max(500).default([]),
  stage: z.string().regex(/^[a-z0-9_]{1,30}$/),
  note: z.string().trim().max(300).optional().nullable(),
});

/** Kargo bosqichini yangilash: bitta buyurtma (buyurtma sahifasidan) yoki trek raqamlari roʻyxati boʻyicha (ommaviy). */
export async function updateCargo(input: z.input<typeof schema>): Promise<ActionResult<{ updated: number; missing: string[] }>> {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('orders.write')) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ma’lumotlar noto‘g‘ri' };
  const d = parsed.data;
  if (!d.orderIds.length && !d.tracks.filter(Boolean).length) return { ok: false, error: 'Trek raqamlarini kiriting' };
  const cfg = (await getRawSettings()).cargo;
  const stage = cfg.stages.find((s) => s.key === d.stage);
  if (!stage) return { ok: false, error: 'Bunday bosqich yoʻq. Sozlamalarni tekshiring' };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('admin_cargo_update', { p_order_ids: d.orderIds, p_tracks: d.tracks.filter(Boolean), p_stage: d.stage, p_note: d.note ?? null });
  if (error) return { ok: false, error: dbErrorText(error, 'Saqlab bo‘lmadi') };
  const res = data as { updated: { id: string; number: number; status: OrderStatus; user_id: string | null }[]; missing: string[] };

  // Bosqich buyurtma holatini ham oʻzgartiradi (masalan “Toshkent omborida” → “Oʻzbekistonda”)
  const changedStatus = new Set<string>();
  if (stage.status !== 'none') {
    const target = stage.status as OrderStatus;
    for (const o of res.updated) {
      if (o.status === target) continue;
      const { error: e } = await supabase.rpc('admin_update_order', { p_order_id: o.id, p_status: target, p_note: stage.label, p_tracking_number: null, p_admin_note: null, p_payment_status: null });
      if (!e) changedStatus.add(o.id);
    }
  }
  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle();
  const by = me?.full_name || ctx.email || 'Xodim';
  after(async () => {
    for (const o of res.updated) {
      // Holat oʻzgargan boʻlsa — mijozga holat xabari ketadi (ikki marta yozmaymiz)
      if (changedStatus.has(o.id)) await onOrderUpdate(o.id, { status: stage.status as OrderStatus, note: stage.label, by });
      else if (cfg.notify) await notifyCargo(o.id, stage.label, d.note ?? null);
    }
  });
  revalidatePath('/admin/cargo');
  for (const o of res.updated.slice(0, 20)) revalidatePath(`/admin/orders/${o.id}`);
  const n = res.updated.length;
  return {
    ok: true, data: { updated: n, missing: res.missing },
    message: n ? `${n} ta buyurtma: “${stage.label}”${res.missing.length ? ` · topilmadi: ${res.missing.length} ta` : ''}` : 'Hech qaysi buyurtma topilmadi',
  };
}
