import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { orderStatusLabel } from '@/lib/order-status';
import { ADMIN_URL } from '@/lib/env';
import { getTelegram, notify, type TgPhoto } from './server';
import { notifyCustomer, notifyReferralRewards } from './shop-bot';
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
  });
  await checkLowStock((items ?? []).map((i) => i.product_id).filter(Boolean));
}

/** Buyurtmadagi mahsulotlardan qoldigʻi chegaradan tushganlari. */
async function checkLowStock(productIds: string[]) {
  if (!productIds.length) return;
  const { data } = await getServiceSupabase().from('products')
    .select('name, stock, low_stock_threshold, track_stock, has_variants').in('id', productIds);
  const low = (data ?? []).filter((p) => p.track_stock && !p.has_variants && p.stock <= p.low_stock_threshold);
  if (low.length) await notify('lowStock', { royxat: low.map((p) => `• ${p.name} — ${p.stock} dona`).join('\n') });
}

export async function onOrderUpdate(orderId: string, change: { status?: OrderStatus | null; payment?: string | null; note?: string | null; by: string }) {
  if (change.status) await notifyCustomer(orderId, change.status);
  // Doʻst taklifi: holat oʻzgarishi bilan bazada yaratilgan bosqich kuponlarini egasiga yuborish
  if (change.status) await notifyReferralRewards();
  if (!(await getTelegram())?.chatId) return;
  const o = await loadOrder(orderId);
  if (!o) return;
  if (change.status === 'cancelled' || change.status === 'returned') {
    await notify('orderCancel', { ...base(o), kim: change.by, sabab: change.note });
  } else if (change.status) {
    await notify('orderStatus', { ...base(o), holat: orderStatusLabel[change.status], trek: o.tracking_number, kim: change.by });
  }
  if (change.payment === 'paid') await notify('paymentReceived', { ...base(o), kim: change.by });
  if (change.payment === 'refunded' || change.payment === 'failed') await notify('paymentVoid', { ...base(o), kim: change.by });
}

/** Mijoz chek yukladi: rasm bilan xodimlarga. */
export async function onReceiptUploaded(orderId: string, photo: TgPhoto) {
  if (!(await getTelegram())?.chatId) return;
  const o = await loadOrder(orderId);
  if (!o) return;
  await notify('paymentReceipt', { ...base(o), havola: `${ADMIN_URL}/admin/orders/${o.id}` }, { photo });
}

const DAY_MS = 86_400_000;
/** Toshkent vaqti boʻyicha bugungi kun chegarasi (UTC+5, yozgi vaqt yoʻq). */
function tashkentDay(now = new Date()) {
  const local = new Date(now.getTime() + 5 * 3600_000);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 5 * 3600_000);
  return { start, end: new Date(start.getTime() + DAY_MS), local };
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Kechki hisobot: bugungi savdo, toʻlov turlari, bekor qilingan va yetkazilmaganlar. Faqat Egaga. */
export async function sendDailyReport(storeName: string) {
  if (!(await getTelegram())?.chatId) return false;
  const { start, end, local } = tashkentDay();
  const s = getServiceSupabase();
  const [{ data: orders }, { count: open }] = await Promise.all([
    s.from('orders').select('total, status, payment_method_name').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).limit(10_000),
    s.from('orders').select('id', { count: 'exact', head: true }).in('status', ['new', 'confirmed', 'processing', 'shipped']),
  ]);
  const rows = orders ?? [];
  const live = rows.filter((o) => o.status !== 'cancelled' && o.status !== 'returned');
  const byPay = new Map<string, number>();
  for (const o of live) byPay.set(o.payment_method_name, (byPay.get(o.payment_method_name) ?? 0) + Number(o.total));
  await notify('dailyReport', {
    dokon: storeName,
    sana: `${local.getUTCDate()}-${MONTHS[local.getUTCMonth()]}, ${local.getUTCFullYear()}`,
    jami: money(live.reduce((a, o) => a + Number(o.total), 0)),
    soni: live.length,
    turlar: [...byPay].sort((a, b) => b[1] - a[1]).map(([k, v]) => `   ${k}: ${money(v)}`).join('\n'),
    bekor: `${rows.length - live.length} ta`,
    yetkazilmagan: `${open ?? 0} ta`,
  }, { personalOnly: true });
  return true;
}
