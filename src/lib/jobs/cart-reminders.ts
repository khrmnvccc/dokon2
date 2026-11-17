import 'server-only';
import { randomBytes } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getRawSettings } from '@/lib/data/public';
import { formatPrice } from '@/lib/format';
import { sendToUser } from '@/lib/telegram/shop-bot';
import { ddmmyyyy, inQuietHours, tashkentNow } from './util';

// Tashlab ketilgan savat: savat oxirgi oʻzgarganidan N soat oʻtib, buyurtma berilmagan boʻlsa —
// doʻkon botidan eslatma. Ikkinchi eslatma va shaxsiy kupon — Ega sozlamasiga koʻra.

const db = () => getServiceSupabase();
const money = (n: number) => formatPrice(n, 'soʻm');

interface CartRow { id: string; user_id: string; updated_at: string; cart_items: { product_id: string; variant_id: string | null; quantity: number }[] }

async function cartSummary(items: CartRow['cart_items']) {
  const pids = [...new Set(items.map((i) => i.product_id))];
  const vids = items.map((i) => i.variant_id).filter((v): v is string => Boolean(v));
  const [{ data: products }, { data: variants }] = await Promise.all([
    db().from('products').select('id, name, price, is_active').in('id', pids),
    vids.length ? db().from('product_variants').select('id, price').in('id', vids) : Promise.resolve({ data: [] as { id: string; price: number | null }[] }),
  ]);
  const pmap = new Map((products ?? []).map((p) => [p.id as string, p]));
  const vmap = new Map((variants ?? []).map((v) => [v.id as string, v]));
  let total = 0; let count = 0; const names: string[] = [];
  for (const i of items) {
    const p = pmap.get(i.product_id);
    if (!p?.is_active) continue;
    const price = Number((i.variant_id ? vmap.get(i.variant_id)?.price : null) ?? p.price);
    total += price * i.quantity; count += i.quantity;
    if (names.length < 5) names.push(`• ${p.name}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`);
  }
  if (items.length > 5) names.push(`… yana ${items.length - 5} ta`);
  return { total, count, list: names.join('\n') };
}

async function issueCoupon(userId: string, c: Awaited<ReturnType<typeof getRawSettings>>['cart_reminder']['coupon']) {
  const ends = new Date(Date.now() + c.days * 86_400_000);
  for (let i = 0; i < 5; i++) {
    const code = `SV${randomBytes(5).toString('hex').toUpperCase().slice(0, 8)}`;
    const { data, error } = await db().from('coupons').insert({
      code, description: 'Savat eslatmasi', discount_type: c.type, value: c.value,
      max_discount: c.type === 'percent' && c.max_discount > 0 ? c.max_discount : null,
      min_order_amount: c.min_order, scope: 'all', starts_at: new Date().toISOString(), ends_at: ends.toISOString(),
      usage_limit: 1, per_user_limit: 1, is_active: true, is_public: false, owner_id: userId, source: 'gift',
    }).select('id, code').single();
    if (!error && data) return { id: data.id as string, code: data.code as string, ends };
    if (error?.code !== '23505') throw error;
  }
  return null;
}

export async function runCartReminders() {
  const cfg = (await getRawSettings()).cart_reminder;
  if (!cfg.enabled) return { skipped: 'off' };
  if (inQuietHours(tashkentNow().hour, cfg.quiet_from, cfg.quiet_to)) return { skipped: 'quiet' };
  const now = Date.now();
  let sent = 0;

  // Telegramda doʻkon botiga ulangan mijozlar (boshqalarga yozib boʻlmaydi)
  const { data: subs } = await db().from('telegram_subscribers').select('user_id').eq('via', 'shop').not('user_id', 'is', null).limit(20_000);
  const reachable = new Set((subs ?? []).map((s) => s.user_id as string));
  if (!reachable.size) return { sent };
  const { data: muted } = await db().from('profiles').select('id').eq('notify_promo', false).limit(20_000);
  const mutedSet = new Set((muted ?? []).map((m) => m.id as string));

  const send = async (cart: CartRow, step: 1 | 2) => {
    const sum = await cartSummary(cart.cart_items);
    if (!sum.count || sum.total < cfg.min_cart_total) return false;
    // Savat yangilangandan keyin buyurtma berganmi
    const { count: ordered } = await db().from('orders').select('id', { count: 'exact', head: true }).eq('user_id', cart.user_id).gte('created_at', cart.updated_at);
    if (ordered) return false;
    const withCoupon = cfg.coupon.enabled && cfg.coupon.on_step === step && (step === 1 || cfg.second_after_hours > 0);
    // Avval yozuv (takror yubormaslik uchun), keyin kupon va xabar
    const { data: rem, error } = await db().from('cart_reminders').insert({
      user_id: cart.user_id, cart_updated_at: cart.updated_at, step, items_count: sum.count, cart_total: Math.round(sum.total),
    }).select('id').single();
    if (error || !rem) return false;
    const coupon = withCoupon ? await issueCoupon(cart.user_id, cfg.coupon) : null;
    if (coupon) await db().from('cart_reminders').update({ coupon_id: coupon.id }).eq('id', rem.id);
    const values = {
      soni: `${sum.count} dona`, summa: money(sum.total), mahsulotlar: sum.list,
      qiymat: cfg.coupon.type === 'percent' ? `${cfg.coupon.value}%` : money(cfg.coupon.value),
      kod: coupon?.code ?? '', muddat: coupon ? ddmmyyyy(coupon.ends) : '',
    };
    return sendToUser(cart.user_id, coupon ? 'cartCoupon' : 'cartReminder', values, coupon ? `/cart?coupon=${coupon.code}` : '/cart', `savat:${cart.user_id.slice(0, 8)}`);
  };

  // 1-eslatma
  const since = new Date(now - 7 * 86_400_000).toISOString();
  const until = new Date(now - cfg.delay_hours * 3_600_000).toISOString();
  const { data: carts } = await db().from('carts').select('id, user_id, updated_at, cart_items(product_id, variant_id, quantity)')
    .gte('updated_at', since).lte('updated_at', until).order('updated_at', { ascending: false }).limit(300);
  const candidates = ((carts ?? []) as CartRow[]).filter((c) => c.cart_items?.length && reachable.has(c.user_id) && !mutedSet.has(c.user_id));
  if (candidates.length) {
    const { data: done } = await db().from('cart_reminders').select('user_id, cart_updated_at, step, sent_at').in('user_id', candidates.map((c) => c.user_id));
    // Bir mijozga 2 kunda bittadan ortiq yangi eslatma ketmaydi
    const cooldown = new Set((done ?? []).filter((d) => now - new Date(d.sent_at as string).getTime() < 48 * 3_600_000).map((d) => d.user_id as string));
    const key = (u: string, t: string, s: number) => `${u}|${new Date(t).getTime()}|${s}`;
    const doneSet = new Set((done ?? []).map((d) => key(d.user_id as string, d.cart_updated_at as string, d.step as number)));
    for (const cart of candidates) {
      if (sent >= 50) break;
      if (!doneSet.has(key(cart.user_id, cart.updated_at, 1))) {
        if (!cooldown.has(cart.user_id) && await send(cart, 1)) sent++;
        continue;
      }
      // 2-eslatma: birinchisidan keyin savat oʻzgarmagan va vaqti kelgan
      if (cfg.second_after_hours > 0 && !doneSet.has(key(cart.user_id, cart.updated_at, 2))) {
        const first = (done ?? []).find((d) => d.user_id === cart.user_id && new Date(d.cart_updated_at as string).getTime() === new Date(cart.updated_at).getTime() && d.step === 1);
        if (!first) continue;
        const { data: r } = await db().from('cart_reminders').select('sent_at, recovered_order_id').eq('user_id', cart.user_id).eq('cart_updated_at', cart.updated_at).eq('step', 1).maybeSingle();
        if (r && !r.recovered_order_id && now - new Date(r.sent_at as string).getTime() >= cfg.second_after_hours * 3_600_000) {
          if (await send(cart, 2)) sent++;
        }
      }
    }
  }
  return { sent };
}
