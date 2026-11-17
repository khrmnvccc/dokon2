import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getRawSettings } from '@/lib/data/public';
import { formatPrice } from '@/lib/format';
import { getSmsCreds, sendSms } from './eskiz';
import { renderSms, SMS_BY_KEY, isSmsEvent, type SmsEvent } from './events';

const db = () => getServiceSupabase();

async function eventText(event: SmsEvent) {
  const { sms } = await getRawSettings();
  if (!sms.enabled) return null;
  const s = sms.events[event];
  if (!s?.on) return null;
  return s.text || SMS_BY_KEY[event].text;
}

/** Mijoz doʻkon botiga ulanganmi (ulangan boʻlsa — “faqat Telegramsizlarga” rejimida SMS ketmaydi). */
async function hasTelegram(userId: string | null) {
  if (!userId) return false;
  const { count } = await db().from('telegram_subscribers').select('chat_id', { count: 'exact', head: true }).eq('user_id', userId).eq('via', 'shop');
  return (count ?? 0) > 0;
}

/** Buyurtma hodisasi boʻyicha SMS. Hech qachon xato tashlamaydi. */
export async function notifyOrderSms(orderId: string, event: string) {
  try {
    if (!isSmsEvent(event)) return;
    const text = await eventText(event);
    if (!text || !(await getSmsCreds())) return;
    const { sms, brand } = await getRawSettings();
    const { data: o } = await db().from('orders').select('id, number, user_id, customer_phone, total, tracking_number').eq('id', orderId).maybeSingle();
    if (!o) return;
    if (sms.only_without_telegram && (await hasTelegram(o.user_id as string | null))) return;
    if (o.user_id && event !== 'orderNew') {
      const { data: pf } = await db().from('profiles').select('notify_orders').eq('id', o.user_id).maybeSingle();
      if (pf?.notify_orders === false) return;
    }
    const body = renderSms(text, { dokon: brand.name || 'Dokon', raqam: o.number, summa: formatPrice(Number(o.total), 'soʻm'), trek: o.tracking_number ?? '' });
    await sendSms(o.customer_phone as string, body, { event, orderId });
  } catch (e) {
    console.error('sms order', event, e instanceof Error ? e.message : e);
  }
}

export async function notifyImportSms(requestId: string) {
  try {
    const text = await eventText('importQuoted');
    if (!text || !(await getSmsCreds())) return;
    const { sms, brand } = await getRawSettings();
    const { data: r } = await db().from('import_requests').select('number, user_id, customer_phone, quote, status').eq('id', requestId).maybeSingle();
    if (!r || r.status !== 'quoted') return;
    if (sms.only_without_telegram && (await hasTelegram(r.user_id as string))) return;
    const total = Number((r.quote as { total?: number } | null)?.total ?? 0);
    await sendSms(r.customer_phone as string, renderSms(text, { dokon: brand.name || 'Dokon', sorov: r.number, summa: formatPrice(total, 'soʻm') }), { event: 'importQuoted' });
  } catch (e) {
    console.error('sms import', e instanceof Error ? e.message : e);
  }
}
