import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { orderStatusLabel } from '@/lib/order-status';
import { ADMIN_URL } from '@/lib/env';
import { getTelegram, notify, type TgPhoto } from './server';
import { notifyCustomer, notifyReferralRewards, sendToUser } from './shop-bot';
import { processStockEvents } from '@/lib/jobs/stock';
import { notifyOrderSms } from '@/lib/sms/notify';
import type { OrderStatus } from '@/lib/types';

// Doʻkon hodisalari → Telegram. Hammasi after() ichida chaqiriladi: xaridor va xodim kutmaydi,
// xato boʻlsa faqat jurnalga yoziladi.

const money = (n: number) => formatPrice(n, 'soʻm');

interface OrderRow {
  id: string; number: number; customer_name: string; customer_phone: string; total: number;
  payment_method_name: string; shipping_method_name: string; comment: string | null;
  address: { region?: string; city?: string | null; street?: string; apartment?: string | null; landmark?: string | null } | null;
  tracking_number: string | null;
}

async function loadOrder(id: string) {
  const { data } = await getServiceSupabase().from('orders')
    .select('id, number, customer_name, customer_phone, total, payment_method_name, shipping_method_name, comment, address, tracking_number')
    .eq('id', id).maybeSingle();
  return data as OrderRow | null;
}

const base = (o: OrderRow) => ({
  raqam: o.number, mijoz: o.customer_name, telefon: formatUzPhone(o.customer_phone), summa: money(o.total), tolov: o.payment_method_name,
});

export async function onNewOrder(orderId: string) {
  await notifyCustomer(orderId, 'new');
  await notifyOrderSms(orderId, 'orderNew');
  // Buyurtmadan keyin qoldiq kamaygan boʻlsa — darhol ogohlantirish (fon ishini kutmasdan)
  await processStockEvents().catch((e) => console.error('stock events', e));
  if (!(await getTelegram())?.chatId) return;
  const o = await loadOrder(orderId);
  if (!o) return;
  const { data: items } = await getServiceSupabase().from('order_items')
    .select('product_id, product_name, variant_name, quantity').eq('order_id', orderId);
  const lines = (items ?? []).slice(0, 15).map((i) => `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} × ${i.quantity}`);
  if ((items?.length ?? 0) > 15) lines.push(`… yana ${items!.length - 15} ta`);
  const a = o.address;
  await notify('newOrder', {
    ...base(o), yetkazish: o.shipping_method_name, mahsulotlar: lines.join('\n'), izoh: o.comment,
    manzil: a ? [a.region, a.city, a.street, a.apartment, a.landmark].filter(Boolean).join(', ') : '',
    havola: `${ADMIN_URL}/admin/orders/${o.id}`,
  }, { link: `/admin/orders/${o.id}` });
}

export async function onOrderUpdate(orderId: string, change: { status?: OrderStatus | null; payment?: string | null; note?: string | null; by: string }) {
  if (change.status) await notifyCustomer(orderId, change.status);
  if (change.status) await notifyOrderSms(orderId, change.status);
  if (change.payment === 'paid') await notifyOrderSms(orderId, 'paid');
  // Doʻst taklifi: holat oʻzgarishi bilan bazada yaratilgan bosqich kuponlarini egasiga yuborish
  if (change.status) await notifyReferralRewards();
  if (change.status === 'delivered') await notifyBonusEarned(orderId).catch((e) => console.error('bonus notify', e));
  if (!(await getTelegram())?.chatId) return;
  const o = await loadOrder(orderId);
  if (!o) return;
  if (change.status === 'cancelled' || change.status === 'returned') {
    await notify('orderCancel', { ...base(o), kim: change.by, sabab: change.note }, { link: `/admin/orders/${o.id}` });
  } else if (change.status) {
    await notify('orderStatus', { ...base(o), holat: orderStatusLabel[change.status], trek: o.tracking_number, kim: change.by }, { link: `/admin/orders/${o.id}` });
  }
  if (change.payment === 'paid') await notify('paymentReceived', { ...base(o), kim: change.by }, { link: `/admin/orders/${o.id}` });
  if (change.payment === 'refunded' || change.payment === 'failed') await notify('paymentVoid', { ...base(o), kim: change.by }, { link: `/admin/orders/${o.id}` });
}

/** Yetkazildi: bazada keshbek yozilgan boʻlsa — mijozga “Keshbek tushdi”. */
async function notifyBonusEarned(orderId: string) {
  const s = getServiceSupabase();
  const { data: row } = await s.from('bonus_ledger').select('user_id, amount, created_at').eq('order_id', orderId).eq('kind', 'earn').maybeSingle();
  if (!row || Date.now() - new Date(row.created_at).getTime() > 15 * 60_000) return;
  const { data: bal } = await s.rpc('bonus_balance', { p_user: row.user_id });
  const { data: o } = await s.from('orders').select('number').eq('id', orderId).maybeSingle();
  await sendToUser(row.user_id, 'bonusEarned', { raqam: o?.number ?? '', bonus: money(Number(row.amount)), balans: money(Number(bal ?? 0)) }, '/account/bonus', `bonus:${o?.number ?? ''}`);
}

/** Click / Payme toʻlovi tushdi: mijozga “Toʻlov tasdiqlandi”, xodimlarga “Toʻlov qabul qilindi”. */
export async function onOnlinePaid(orderId: string, provider: 'click' | 'payme') {
  await notifyCustomer(orderId, 'paid');
  await notifyOrderSms(orderId, 'paid');
  await notifyReferralRewards();
  if (!(await getTelegram())?.chatId) return;
  const o = await loadOrder(orderId);
  if (!o) return;
  await notify('paymentReceived', { ...base(o), kim: provider === 'click' ? 'Click' : 'Payme' }, { link: `/admin/orders/${o.id}` });
}

/** Mijoz “Oʻzbekistonda” boʻlgan buyurtma uchun yetkazishga ariza qoldirdi yoki olib ketishni tanladi. */
export async function onDeliveryRequest(orderId: string) {
  if (!(await getTelegram())?.chatId) return;
  const { data: o } = await getServiceSupabase().from('orders')
    .select('id, number, customer_name, customer_phone, total, payment_method_name, fulfillment, shipping_method_id, shipping_method_name, address, delivery_fee')
    .eq('id', orderId).maybeSingle();
  if (!o) return;
  let manzil = '';
  if (o.fulfillment === 'pickup' && o.shipping_method_id) {
    const { data: sm } = await getServiceSupabase().from('shipping_methods').select('pickup_address, description').eq('id', o.shipping_method_id).maybeSingle();
    manzil = sm?.pickup_address || sm?.description || '';
  } else {
    const a = o.address as OrderRow['address'];
    manzil = a ? [a.region, a.city, a.street, a.apartment, a.landmark].filter(Boolean).join(', ') : '';
  }
  await notify('deliveryRequest', {
    raqam: o.number, mijoz: o.customer_name, telefon: formatUzPhone(o.customer_phone),
    tur: o.fulfillment === 'pickup' ? '🏬 Oʻzi olib ketadi' : '🚚 Yetkazib berish', usul: o.shipping_method_name, manzil,
    narx: Number(o.delivery_fee) > 0 ? money(Number(o.delivery_fee)) : 'bepul', havola: `${ADMIN_URL}/admin/orders/${o.id}`,
  }, { link: `/admin/orders/${o.id}` });
}

/** Mijoz chek yukladi: rasm bilan xodimlarga. */
export async function onReceiptUploaded(orderId: string, photo: TgPhoto) {
  if (!(await getTelegram())?.chatId) return;
  const o = await loadOrder(orderId);
  if (!o) return;
  await notify('paymentReceipt', { ...base(o), havola: `${ADMIN_URL}/admin/orders/${o.id}` }, { photo, link: `/admin/orders/${o.id}` });
}

const DAY_MS = 86_400_000;
/** Toshkent vaqti boʻyicha bugungi kun chegarasi (UTC+5, yozgi vaqt yoʻq). */
function tashkentDay(now = new Date()) {
  const local = new Date(now.getTime() + 5 * 3600_000);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 5 * 3600_000);
  return { start, end: new Date(start.getTime() + DAY_MS), local };
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Davr statistikasi (Toshkent vaqti chegaralari bilan): savdo, foyda, eng koʻp sotilganlar. */
export async function periodStats(start: Date, end: Date, topCount = 3) {
  const s = getServiceSupabase();
  const { data: orders } = await s.from('orders').select('id, total, status, payment_method_name')
    .gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).limit(20_000);
  const rows = orders ?? [];
  const live = rows.filter((o) => o.status !== 'cancelled' && o.status !== 'returned');
  const liveIds = live.map((o) => o.id as string);
  const items: { product_name: string; quantity: number; line_total: number; cost_price: number | null }[] = [];
  for (let i = 0; i < liveIds.length; i += 300) {
    const { data } = await s.from('order_items').select('product_name, quantity, line_total, cost_price').in('order_id', liveIds.slice(i, i + 300));
    items.push(...((data ?? []) as typeof items));
  }
  const byName = new Map<string, number>();
  let profit = 0;
  for (const it of items) {
    byName.set(it.product_name, (byName.get(it.product_name) ?? 0) + Number(it.quantity));
    if (it.cost_price !== null) profit += Number(it.line_total) - Number(it.cost_price) * Number(it.quantity);
  }
  const byPay = new Map<string, number>();
  for (const o of live) byPay.set(o.payment_method_name, (byPay.get(o.payment_method_name) ?? 0) + Number(o.total));
  const total = live.reduce((a, o) => a + Number(o.total), 0);
  return {
    total, count: live.length, cancelled: rows.length - live.length, profit,
    payTypes: [...byPay].sort((a, b) => b[1] - a[1]),
    top: [...byName].sort((a, b) => b[1] - a[1]).slice(0, topCount).map(([n, q], i) => `${i + 1}. ${n} — ${q} dona`),
  };
}

/** Kechki hisobot: bugungi savdo, foyda, toʻlov turlari, eng koʻp sotilganlar, kam qolganlar. Faqat Egaga. */
export async function sendDailyReport(storeName: string, opts: { topCount?: number; lowStock?: string[] } = {}) {
  if (!(await getTelegram())?.chatId) return false;
  const { start, end, local } = tashkentDay();
  const [st, { count: open }] = await Promise.all([
    periodStats(start, end, opts.topCount ?? 3),
    getServiceSupabase().from('orders').select('id', { count: 'exact', head: true }).in('status', ['new', 'confirmed', 'processing', 'shipped', 'arrived']),
  ]);
  await notify('dailyReport', {
    dokon: storeName,
    sana: `${local.getUTCDate()}-${MONTHS[local.getUTCMonth()]}, ${local.getUTCFullYear()}`,
    jami: money(st.total),
    soni: st.count,
    foyda: st.profit ? money(st.profit) : '',
    turlar: st.payTypes.map(([k, v]) => `   ${k}: ${money(v)}`).join('\n'),
    bekor: `${st.cancelled} ta`,
    yetkazilmagan: `${open ?? 0} ta`,
    top: st.top.join('\n'),
    kam: (opts.lowStock ?? []).join('\n'),
  }, { personalOnly: true });
  return true;
}

export { MONTHS, tashkentDay };
