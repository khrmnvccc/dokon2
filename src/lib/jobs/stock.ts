import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getRawSettings } from '@/lib/data/public';
import { formatPrice } from '@/lib/format';
import { notify, getTelegram } from '@/lib/telegram/server';
import { sendToUser } from '@/lib/telegram/shop-bot';

// Ombor hodisalari (bazadagi trigger yozadi): kam qoldi / tugadi → xodimlarga bitta xabar;
// qayta keldi → “Kelganda xabar ber” bosganlar (va sevimlilarga qoʻshganlar) ga doʻkon botidan xabar.

const db = () => getServiceSupabase();

interface EventRow { id: number; kind: 'restock' | 'low' | 'out'; product_id: string; variant_id: string | null; stock: number }

export async function processStockEvents() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { skipped: 'no key' };
  // Hodisalarni “olib qoʻyish”: bir vaqtda ikki ishga tushsa ham har biri bir marta ishlanadi
  const { data, error } = await db().from('stock_events').update({ processed_at: new Date().toISOString() })
    .is('processed_at', null).gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString()).select('id, kind, product_id, variant_id, stock');
  if (error) throw error;
  const events = (data ?? []) as EventRow[];
  if (!events.length) return { events: 0 };
  const cfg = (await getRawSettings()).stock_alerts;

  const pids = [...new Set(events.map((e) => e.product_id))];
  const vids = [...new Set(events.map((e) => e.variant_id).filter((v): v is string => Boolean(v)))];
  const [{ data: products }, { data: variants }] = await Promise.all([
    db().from('products').select('id, name, slug, price, stock, is_active, has_variants').in('id', pids),
    vids.length ? db().from('product_variants').select('id, name, price, stock').in('id', vids) : Promise.resolve({ data: [] as { id: string; name: string; price: number | null; stock: number }[] }),
  ]);
  const pmap = new Map((products ?? []).map((p) => [p.id as string, p]));
  const vmap = new Map((variants ?? []).map((v) => [v.id as string, v]));

  // ---- Xodimlarga: kam qoldi / tugadi ----
  let staffLines = 0;
  const lines: string[] = [];
  for (const e of events) {
    if (e.kind === 'restock') continue;
    if (e.kind === 'low' && !cfg.low_alert) continue;
    if (e.kind === 'out' && !cfg.out_alert) continue;
    if (e.variant_id && !cfg.include_variants) continue;
    const p = pmap.get(e.product_id);
    if (!p?.is_active) continue;
    const v = e.variant_id ? vmap.get(e.variant_id) : null;
    lines.push(`${e.kind === 'out' ? '⛔️' : '⚠️'} ${p.name}${v ? ` (${v.name})` : ''} — ${e.kind === 'out' ? 'tugadi' : `${e.stock} dona`}`);
  }
  if (lines.length && (await getTelegram())?.chatId) {
    const shown = lines.slice(0, 30);
    if (lines.length > 30) shown.push(`… yana ${lines.length - 30} ta`);
    await notify('lowStock', { royxat: shown.join('\n') }, { link: '/admin/inventory?low=1' });
    staffLines = lines.length;
  }

  // ---- Mijozlarga: qayta keldi ----
  let customers = 0;
  if (cfg.restock_enabled) {
    for (const e of events.filter((x) => x.kind === 'restock')) {
      const p = pmap.get(e.product_id);
      if (!p?.is_active) continue;
      const v = e.variant_id ? vmap.get(e.variant_id) : null;
      // Variantli mahsulotda umumiy qoldiq hodisasi faqat “istalgan variant” obunachilariga
      let q = db().from('stock_alerts').select('id, user_id').eq('product_id', e.product_id).is('notified_at', null).limit(1000);
      q = e.variant_id ? q.or(`variant_id.is.null,variant_id.eq.${e.variant_id}`) : p.has_variants ? q.is('variant_id', null) : q;
      const { data: alerts } = await q;
      const users = new Map<string, string[]>();
      for (const a of alerts ?? []) users.set(a.user_id as string, [...(users.get(a.user_id as string) ?? []), a.id as string]);
      // Sevimlilarga qoʻshganlar (aksiya xabarlari oʻchirilmagan boʻlsa)
      if (cfg.restock_wishlist && !e.variant_id) {
        const { data: wish } = await db().from('wishlists').select('user_id').eq('product_id', e.product_id).limit(1000);
        const wl = (wish ?? []).map((w) => w.user_id as string).filter((u) => !users.has(u));
        if (wl.length) {
          const { data: muted } = await db().from('profiles').select('id').in('id', wl).eq('notify_promo', false);
          const m = new Set((muted ?? []).map((x) => x.id as string));
          for (const u of wl) if (!m.has(u)) users.set(u, []);
        }
      }
      const name = `${p.name}${v ? ` (${v.name})` : ''}`;
      const price = Number(v?.price ?? p.price);
      for (const [userId, alertIds] of users) {
        const ok = await sendToUser(userId, 'backInStock', { mahsulot: name, narx: formatPrice(price, 'soʻm'), qoldiq: `${v?.stock ?? p.stock} dona` }, `/product/${p.slug}`, `qaytdi:${p.slug}`).catch(() => false);
        if (alertIds.length) {
          await db().from('stock_alerts').update({ notified_at: new Date().toISOString() }).in('id', alertIds);
          await db().from('notifications').insert({ user_id: userId, type: 'stock', title: 'Siz kutgan mahsulot keldi', body: name, link: `/product/${p.slug}` });
        }
        if (ok) customers++;
      }
    }
  }
  return { events: events.length, staffLines, customers };
}

/** Kechki hisobot uchun: hozir chegaradan past qolgan mahsulotlar. */
export async function lowStockList(limit = 15) {
  const { data } = await db().from('products').select('name, stock, low_stock_threshold')
    .eq('is_active', true).eq('track_stock', true).order('stock').limit(500);
  const low = (data ?? []).filter((p) => p.stock <= p.low_stock_threshold);
  return { total: low.length, lines: low.slice(0, limit).map((p) => `• ${p.name} — ${p.stock} dona`) };
}
