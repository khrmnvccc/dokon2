import 'server-only';
// Telegram kanalga avtomatik post: yangi mahsulot va flash sale. Doʻkon boti (boʻlmasa admin boti) kanal admini boʻlishi kerak.
// Sozlama: Telegram → Kanalga post (site_settings 'channel_post').
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getRawSettings } from '@/lib/data/public';
import { SITE_URL } from '@/lib/env';
import { formatPrice, discountPercent } from '@/lib/format';
import { renderTemplate } from './templates';
import { getTelegram, logSend, tg, TelegramFail } from './server';
import { getShopBot } from './shop-bot';
import type { SiteSettings } from '@/lib/settings-schema';

const db = () => getServiceSupabase();
const money = (n: number) => formatPrice(n, 'soʻm');

async function channelToken(): Promise<{ token: string; via: 'shop' | 'admin' } | null> {
  const shop = await getShopBot().catch(() => null);
  if (shop?.token) return { token: shop.token, via: 'shop' };
  const admin = await getTelegram().catch(() => null);
  return admin?.token ? { token: admin.token, via: 'admin' } : null;
}

const absUrl = (u: string | null | undefined) => (!u ? null : u.startsWith('https://') ? u : u.startsWith('/') && SITE_URL.startsWith('https://') ? `${SITE_URL}${u}` : null);

async function postToChannel(cfg: SiteSettings['channel_post'], html: string, image: string | null, link: string, logAs: string) {
  const bot = await channelToken();
  if (!bot) throw new TelegramFail('Bot ulanmagan. Telegram → Botlar boʻlimida doʻkon botini ulang');
  if (!cfg.chat) throw new TelegramFail('Kanal manzili kiritilmagan');
  const markup = cfg.button && link.startsWith('https://') ? { reply_markup: { inline_keyboard: [[{ text: cfg.button, url: link }]] } } : {};
  try {
    if (image && !/\.svg(\?|$)/i.test(image) && html.length <= 1024) {
      try {
        await tg(bot.token, 'sendPhoto', { chat_id: cfg.chat, photo: image, caption: html, parse_mode: 'HTML', ...markup }, 20_000);
        await logSend(logAs, `kanal:${cfg.chat}`, html, null);
        return;
      } catch (e) {
        if (e instanceof Error && /topilmadi|bloklagan|admin|huquq|rights|not found/i.test(e.message)) throw e;
      }
    }
    await tg(bot.token, 'sendMessage', { chat_id: cfg.chat, text: html, parse_mode: 'HTML', disable_web_page_preview: false, ...markup });
    await logSend(logAs, `kanal:${cfg.chat}`, html, null);
  } catch (e) {
    await logSend(logAs, `kanal:${cfg.chat}`, html, e);
    throw e;
  }
}

async function productValues(productId: string) {
  const { data: p } = await db().from('products').select('id, name, slug, price, compare_at_price, short_description, is_active, created_at, channel_posted_at').eq('id', productId).maybeSingle();
  if (!p) return null;
  const { data: img } = await db().from('product_images').select('url').eq('product_id', productId).order('is_primary', { ascending: false }).order('sort_order').limit(1).maybeSingle();
  const price = Number(p.price);
  const old = p.compare_at_price ? Number(p.compare_at_price) : null;
  const link = `${SITE_URL}/product/${p.slug}`;
  return {
    p, link, image: absUrl(img?.url),
    values: {
      nomi: p.name, narx: money(price), eski_narx: old && old > price ? `(eski narx ${money(old)})` : '',
      chegirma: old && old > price ? `${discountPercent(price, old)}%` : '', tavsif: p.short_description ?? '', havola: link,
    },
  };
}

/** Mahsulotni kanalga chiqaradi (qoʻlda “Kanalga yuborish” — takror ham mumkin). Xato tashlaydi. */
export async function postProductToChannel(productId: string) {
  const cfg = (await getRawSettings()).channel_post;
  const v = await productValues(productId);
  if (!v) throw new TelegramFail('Mahsulot topilmadi');
  if (!v.p.is_active) throw new TelegramFail('Mahsulot faol emas — avval sotuvga chiqaring');
  const { brand } = await getRawSettings();
  await postToChannel(cfg, renderTemplate(cfg.text, { ...v.values, dokon: brand.name }), v.image, v.link, 'channel:product');
  await db().from('products').update({ channel_posted_at: new Date().toISOString() }).eq('id', productId);
}

/** Yangi mahsulot saqlanganda: yoqilgan boʻlsa va hali chiqmagan boʻlsa (faqat oxirgi 3 kunda yaratilganlar). Xato tashlamaydi. */
export async function autoPostProduct(productId: string) {
  try {
    const cfg = (await getRawSettings()).channel_post;
    if (!cfg.enabled || !cfg.new_products || !cfg.chat) return;
    const { data: p } = await db().from('products').select('is_active, created_at, channel_posted_at').eq('id', productId).maybeSingle();
    if (!p?.is_active || p.channel_posted_at || Date.now() - new Date(p.created_at).getTime() > 3 * 86_400_000) return;
    // Bir vaqtda ikki marta saqlansa ham bir marta chiqsin
    const { data: claimed } = await db().from('products').update({ channel_posted_at: new Date().toISOString() })
      .eq('id', productId).is('channel_posted_at', null).select('id');
    if (!claimed?.length) return;
    try {
      await postProductToChannel(productId);
    } catch (e) {
      await db().from('products').update({ channel_posted_at: null }).eq('id', productId);
      throw e;
    }
  } catch (e) {
    console.error('channel autopost', e);
  }
}

/** Flash sale boshlanganda kanalga. Xato tashlamaydi. */
export async function postFlashToChannel(promo: { title: string; description: string | null; image_url: string | null; ends_at: string | null; discount_type: string; value: number; slug: string }) {
  try {
    const cfg = (await getRawSettings()).channel_post;
    if (!cfg.enabled || !cfg.flash_sales || !cfg.chat) return;
    const { brand } = await getRawSettings();
    const html = renderTemplate(cfg.flash_text, {
      nomi: promo.title, chegirma: promo.discount_type === 'percent' ? `${promo.value}%` : money(promo.value),
      tugash: promo.ends_at ? tashkentTime(promo.ends_at) : '', tavsif: promo.description ?? '', havola: `${SITE_URL}/sale`, dokon: brand.name,
    });
    await postToChannel(cfg, html, absUrl(promo.image_url), `${SITE_URL}/sale`, 'channel:flash');
  } catch (e) {
    console.error('channel flash', e);
  }
}

/** “Sinab koʻrish”: kanal topiladimi va bot u yerda yoza oladimi. */
export async function testChannel(chat: string) {
  const bot = await channelToken();
  if (!bot) throw new TelegramFail('Bot ulanmagan. Telegram → Botlar boʻlimida doʻkon botini ulang');
  const info = await tg(bot.token, 'getChat', { chat_id: chat }).catch(() => null) as { title?: string; type?: string } | null;
  if (!info) throw new TelegramFail('Kanal topilmadi. Manzilni tekshiring va botni kanalga admin qiling');
  await tg(bot.token, 'sendMessage', { chat_id: chat, text: '✅ Kanal ulandi. Yangi mahsulotlar shu yerga avtomatik chiqadi.', disable_notification: true });
  return { title: info.title ?? chat, via: bot.via };
}

export function tashkentTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
