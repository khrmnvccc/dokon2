import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { sendToUser } from '@/lib/telegram/shop-bot';

/** Kargo bosqichi yangilandi: mijozga botdan “Yuk qayerda” xabari va saytdagi qoʻngʻiroqchaga bildirishnoma. */
export async function notifyCargo(orderId: string, stageLabel: string, note: string | null) {
  try {
    const db = getServiceSupabase();
    const { data: o } = await db.from('orders').select('id, number, user_id, tracking_number').eq('id', orderId).maybeSingle();
    if (!o?.user_id) return;
    await db.from('notifications').insert({
      user_id: o.user_id, type: 'cargo', title: `Buyurtma №${o.number}: ${stageLabel}`, body: note || null, link: `/account/orders/${o.id}`,
    });
    const { data: pf } = await db.from('profiles').select('notify_orders').eq('id', o.user_id).maybeSingle();
    if (pf && pf.notify_orders === false) return;
    await sendToUser(o.user_id, 'cargoUpdate', { raqam: o.number, bosqich: stageLabel, trek: o.tracking_number ?? '', izoh: note ?? '' }, `/account/orders/${o.id}`, String(o.number));
  } catch (e) {
    console.error('cargo notify', e);
  }
}
