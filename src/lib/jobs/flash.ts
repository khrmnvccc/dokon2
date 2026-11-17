import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getRawSettings } from '@/lib/data/public';
import { formatPrice } from '@/lib/format';
import { customerMessage, getShopBot, sendRich } from '@/lib/telegram/shop-bot';
import { logSend } from '@/lib/telegram/server';
import { postFlashToChannel, tashkentTime } from '@/lib/telegram/channel';
import { inQuietHours, tashkentNow } from './util';

const db = () => getServiceSupabase();

/**
 * Boshlangan flash sale’lar: aksiya xabarlarini oʻchirmagan obunachilarga botdan bir marta xabar va kanalga post.
 * Har aksiya atomar “egallanadi” (flash_notified_at), shuning uchun ikki marta ketmaydi.
 */
export async function runFlashSales() {
  const now = new Date().toISOString();
  const { data: due } = await db().from('promotions')
    .select('id, title, slug, description, image_url, ends_at, discount_type, value, starts_at')
    .eq('is_flash', true).eq('is_active', true).is('flash_notified_at', null).gt('ends_at', now).limit(5);
  const ready = (due ?? []).filter((p) => !p.starts_at || p.starts_at <= now);
  if (!ready.length) return { flash: 0 };
  const cfg = (await getRawSettings()).flash_sale;
  // Tunda obunachilarga yozmaymiz — ertalab yuboriladi (kanalga ham shu bilan birga)
  if (cfg.notify_bot && inQuietHours(tashkentNow().hour, 23, 8)) return { flash: 0, quiet: true };
  let sent = 0;
  for (const p of ready) {
    const { data: claimed } = await db().from('promotions').update({ flash_notified_at: now }).eq('id', p.id).is('flash_notified_at', null).select('id');
    if (!claimed?.length) continue;
    await postFlashToChannel(p);
    if (cfg.notify_bot) sent += await notifySubscribers(p);
  }
  return { flash: ready.length, sent };
}

async function notifySubscribers(p: { title: string; description: string | null; ends_at: string | null; discount_type: string; value: number }) {
  const bot = await getShopBot().catch(() => null);
  if (!bot) return 0;
  const { data: subs } = await db().from('telegram_subscribers').select('chat_id, name, user_id').eq('via', 'shop').eq('subscribed', true).limit(5000);
  if (!subs?.length) return 0;
  const userIds = subs.map((s) => s.user_id).filter(Boolean) as string[];
  const off = new Set<string>();
  for (let i = 0; i < userIds.length; i += 500) {
    const { data } = await db().from('profiles').select('id').in('id', userIds.slice(i, i + 500)).eq('notify_promo', false);
    for (const r of data ?? []) off.add(r.id as string);
  }
  const { brand } = await getRawSettings();
  const values = {
    aksiya: p.title, chegirma: p.discount_type === 'percent' ? `${p.value}%` : formatPrice(p.value, 'soʻm'),
    tugash: p.ends_at ? tashkentTime(p.ends_at) : '', tavsif: p.description ?? '', dokon: brand.name || 'Doʻkon',
  };
  let sent = 0;
  for (const s of subs) {
    if (s.user_id && off.has(s.user_id as string)) continue;
    const msg = await customerMessage('flashSale', { ...values, mijoz: String(s.name ?? '').split(' ')[0] }, { path: '/sale' });
    if (!msg) return sent;
    try {
      await sendRich(bot.token, Number(s.chat_id), msg);
      sent++;
    } catch (e) {
      await logSend('customer:flashSale', `mijoz:${s.name ?? s.chat_id}`, msg.html, e);
      if (e instanceof Error && /bloklagan|oʻchirilgan|topilmadi/.test(e.message)) await db().from('telegram_subscribers').update({ subscribed: false }).eq('chat_id', s.chat_id);
    }
    await new Promise((r) => setTimeout(r, 45));
  }
  await logSend('customer:flashSale', `obunachilar:${sent}`, values.aksiya, null);
  return sent;
}
