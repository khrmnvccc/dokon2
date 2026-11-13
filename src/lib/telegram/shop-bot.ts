import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/data/public';
import { formatPrice } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import { ADMIN_URL, SITE_URL } from '@/lib/env';
import { chatTitle, getTelegram, logSend, tg, TelegramFail } from './server';
import type { OrderStatus } from '@/lib/types';

// Doʻkon boti — xaridorlar uchun alohida bot. Admin botidan farqi: webhook bilan ishlaydi (javob darhol),
// menyu tugmasi doʻkonni Telegram ichida mini-ilova qilib ochadi, buyurtma holati xaridorning oʻziga keladi.
// Token faqat bazada (app_meta 'shop_bot', RLS yopiq), brauzerga hech qachon qaytmaydi.

export interface ShopBotConfig {
  token: string;
  botName: string;
  /** Telegram webhook soʻroviga qoʻshib yuboradigan maxfiy kalit (X-Telegram-Bot-Api-Secret-Token) */
  secret: string;
  setupAt: string;
  webhookError?: string | null;
}

const db = () => getServiceSupabase();
let cache: { value: ShopBotConfig | null; until: number } | null = null;

export async function getShopBot(): Promise<ShopBotConfig | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (cache && cache.until > Date.now()) return cache.value;
  const { data, error } = await db().from('app_meta').select('value').eq('key', 'shop_bot').maybeSingle();
  if (error) throw error;
  const value = (data?.value as ShopBotConfig) ?? null;
  cache = { value, until: Date.now() + 30_000 };
  return value;
}

export async function saveShopBot(config: ShopBotConfig | null) {
  cache = null;
  const q = config === null
    ? db().from('app_meta').delete().eq('key', 'shop_bot')
    : db().from('app_meta').upsert({ key: 'shop_bot', value: config, updated_at: new Date().toISOString() });
  const { error } = await q;
  if (error) throw error;
}

export const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;

/** Webhook soʻrovi haqiqatan Telegramdan (bizning maxfiy kalit bilan) kelganmi. */
export function secretMatches(config: ShopBotConfig, header: string | null) {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(config.secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const webApp = (text: string, path = '/') => ({ text, web_app: { url: `${SITE_URL}${path}` } });
const canUseWebApp = SITE_URL.startsWith('https://');
/** Mini-ilova tugmasi (https boʻlmasa oddiy havola — Telegram web_app uchun https talab qiladi). */
const openButton = (text: string, path = '/') => (canUseWebApp ? webApp(text, path) : { text, url: `${SITE_URL}${path}` });

/**
 * Botni sozlaydi: webhook, menyu tugmasi (doʻkonni ochadi), buyruqlar va tavsif.
 * Har safar token saqlanganda va “Qayta sozlash” bosilganda chaqiriladi.
 */
export async function setupShopBot(token: string, previous?: ShopBotConfig | null): Promise<ShopBotConfig> {
  const me = await tg(token, 'getMe', {});
  const secret = previous?.token === token && previous.secret ? previous.secret : randomBytes(24).toString('hex');
  const { brand } = await getSettings();
  const name = brand.name || 'Doʻkon';
  let webhookError: string | null = null;
  if (SITE_URL.startsWith('https://')) {
    await tg(token, 'setWebhook', { url: `${SITE_URL}/api/telegram/shop`, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: false });
  } else {
    webhookError = 'Sayt manzili https emas — bot faqat saytga chiqqandan keyin javob beradi';
  }
  await Promise.allSettled([
    canUseWebApp
      ? tg(token, 'setChatMenuButton', { menu_button: { type: 'web_app', text: 'Doʻkon', web_app: { url: SITE_URL } } })
      : Promise.resolve(),
    tg(token, 'setMyCommands', { commands: [
      { command: 'start', description: 'Doʻkonni ochish' },
      { command: 'orders', description: 'Mening buyurtmalarim' },
      { command: 'help', description: 'Yordam va aloqa' },
      { command: 'stop', description: 'Aksiya xabarlarini oʻchirish' },
    ] }),
    tg(token, 'setMyShortDescription', { short_description: `${name} — onlayn doʻkon. Buyurtma bering va holatini shu yerda kuzating.`.slice(0, 120) }),
    tg(token, 'setMyDescription', { description: `${name} rasmiy boti.\n\n🛍 Doʻkonni Telegramdan chiqmasdan oching\n📦 Buyurtma holati shu yerga keladi\n🎁 Aksiya va kuponlardan birinchi boʻlib xabardor boʻling\n\n“Start” tugmasini bosing.`.slice(0, 512) }),
  ]);
  return { token, botName: me.username, secret, setupAt: new Date().toISOString(), webhookError };
}

/** Admin botining menyu tugmasi admin panelni ochadi (xodimlar Telegramdan kiradi). Xato boʻlsa jim. */
export async function setupAdminMenu(token: string) {
  if (!ADMIN_URL.startsWith('https://')) return;
  await Promise.allSettled([
    tg(token, 'setChatMenuButton', { menu_button: { type: 'web_app', text: 'Admin', web_app: { url: `${ADMIN_URL}/admin` } } }),
    tg(token, 'setMyCommands', { commands: [{ command: 'start', description: 'Ulash kodi yoki admin panel' }] }),
  ]);
}

// ---------- Webhook: xaridor yozganlari ----------
export interface ShopUpdate {
  update_id: number;
  message?: {
    message_id: number; text?: string;
    chat: { id: number; type: string; first_name?: string; last_name?: string; username?: string };
    from?: { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function send(config: ShopBotConfig, chatId: number, text: string, keyboard?: unknown[][]) {
  await tg(config.token, 'sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

async function upsertSubscriber(chat: NonNullable<ShopUpdate['message']>['chat'], subscribed: boolean) {
  const { error } = await db().from('telegram_subscribers').upsert(
    { chat_id: chat.id, name: chatTitle(chat), username: chat.username ?? null, subscribed, via: 'shop', last_seen: new Date().toISOString() },
    { onConflict: 'chat_id' },
  );
  if (error) console.error('shop bot subscriber', error.message);
}

async function linkedUser(chatId: number) {
  const { data } = await db().from('telegram_subscribers').select('user_id').eq('chat_id', chatId).maybeSingle();
  return (data?.user_id as string | null) ?? null;
}

const STATUS_ICON: Partial<Record<OrderStatus, string>> = {
  new: '🆕', confirmed: '✅', processing: '📦', shipped: '🚚', delivered: '🎉', cancelled: '❌', returned: '↩️',
};

export async function handleShopUpdate(config: ShopBotConfig, update: ShopUpdate) {
  const m = update.message;
  if (!m || m.chat.type !== 'private' || typeof m.text !== 'string') return;
  const text = m.text.trim();
  const cmd = text.split(/[\s@]/)[0].toLowerCase();
  const { brand, contact } = await getSettings();
  const name = esc(brand.name || 'Doʻkon');

  if (cmd === '/start') {
    await upsertSubscriber(m.chat, true);
    const first = esc(m.from?.first_name || m.chat.first_name || '');
    await send(config, m.chat.id,
      `Assalomu alaykum${first ? `, <b>${first}</b>` : ''}! 👋\n\n<b>${name}</b> botiga xush kelibsiz.\n\n` +
      `🛍 <b>Doʻkonni ochish</b> tugmasini bosing — doʻkon shu yerda, Telegram ichida ochiladi. Roʻyxatdan oʻtish shart emas.\n` +
      `📦 Buyurtma bersangiz, holati shu chatga keladi.\n🎁 Aksiya va kuponlar haqida birinchi boʻlib bilasiz.\n\n` +
      `Xabarlar kerak boʻlmasa — /stop`,
      [[openButton('🛍 Doʻkonni ochish')], [openButton('🎁 Aksiyalar', '/sale'), openButton('📦 Buyurtmalarim', '/account/orders')]],
    );
    return;
  }
  if (cmd === '/stop') {
    await upsertSubscriber(m.chat, false);
    await send(config, m.chat.id, 'Aksiya xabarlari oʻchirildi. Buyurtmangiz holati baribir keladi.\nQayta yoqish uchun — /start');
    return;
  }
  if (cmd === '/orders') {
    const userId = await linkedUser(m.chat.id);
    if (!userId) {
      await send(config, m.chat.id, 'Hali buyurtma yoʻq. Doʻkonni oching — Telegram orqali kirasiz va buyurtmalaringiz shu yerda koʻrinadi.', [[openButton('🛍 Doʻkonni ochish')]]);
      return;
    }
    const { data } = await db().from('orders').select('id, number, status, total, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
    if (!data?.length) {
      await send(config, m.chat.id, 'Hali buyurtma yoʻq.', [[openButton('🛍 Doʻkonni ochish')]]);
      return;
    }
    const lines = data.map((o) => `${STATUS_ICON[o.status as OrderStatus] ?? '•'} <b>#${o.number}</b> — ${orderStatusLabel[o.status as OrderStatus] ?? o.status}, ${formatPrice(Number(o.total), 'soʻm')}`);
    await send(config, m.chat.id, `<b>Oxirgi buyurtmalaringiz:</b>\n\n${lines.join('\n')}`, [[openButton('📦 Batafsil', '/account/orders')]]);
    return;
  }
  // /help va boshqa har qanday matn
  const phone = contact.phone ? `\n📞 Telefon: ${esc(contact.phone)}` : '';
  await send(config, m.chat.id,
    `<b>Qanday buyurtma beraman?</b>\n1. “Doʻkonni ochish” tugmasini bosing.\n2. Mahsulotni savatga qoʻshing.\n3. Savatda “Rasmiylashtirish” — telefon va manzilni yozing.\n\n` +
    `Buyurtma holati shu chatga keladi. Savol boʻlsa, bizga yozing.${phone}`,
    [[openButton('🛍 Doʻkonni ochish')], [openButton('❓ Yordam markazi', '/help')]],
  );
}

// ---------- Xaridorga buyurtma xabari ----------
const CUSTOMER_TEXT: Partial<Record<OrderStatus, string>> = {
  confirmed: 'tasdiqlandi ✅ Tez orada tayyorlaymiz.',
  processing: 'tayyorlanmoqda 📦',
  shipped: 'yoʻlga chiqdi 🚚',
  delivered: 'yetkazildi 🎉 Xaridingiz uchun rahmat!',
  cancelled: 'bekor qilindi ❌',
  returned: 'qaytarildi ↩️',
};

/** Buyurtma egasining Telegramiga (doʻkon boti orqali) xabar. Hech qachon xato tashlamaydi. */
export async function notifyCustomer(orderId: string, kind: 'new' | OrderStatus) {
  try {
    const config = await getShopBot();
    if (!config) return;
    const { data: o } = await db().from('orders').select('id, number, user_id, total, tracking_number').eq('id', orderId).maybeSingle();
    if (!o?.user_id) return;
    const { data: subs } = await db().from('telegram_subscribers').select('chat_id').eq('user_id', o.user_id).eq('via', 'shop');
    if (!subs?.length) return;
    const head = `<b>Buyurtma #${o.number}</b>`;
    let text: string;
    if (kind === 'new') text = `${head} qabul qilindi 🙌\nSumma: <b>${formatPrice(Number(o.total), 'soʻm')}</b>\n\nTez orada operator bogʻlanadi. Holati shu yerga keladi.`;
    else if (CUSTOMER_TEXT[kind]) text = `${head} ${CUSTOMER_TEXT[kind]}${kind === 'shipped' && o.tracking_number ? `\nTrek raqami: <code>${esc(o.tracking_number)}</code>` : ''}`;
    else return;
    for (const s of subs) {
      try {
        await send(config, Number(s.chat_id), text, [[openButton('📦 Buyurtmani koʻrish', `/account/orders/${o.id}`)]]);
        await logSend(`customer:${kind}`, `mijoz:${o.number}`, text, null);
      } catch (e) {
        await logSend(`customer:${kind}`, `mijoz:${o.number}`, text, e);
      }
    }
  } catch (e) {
    console.error('notify customer', e);
  }
}

/** Ommaviy xabar uchun: xaridor qaysi bot orqali kelgan boʻlsa, oʻsha botning tokeni. */
export async function tokenFor(via: 'admin' | 'shop') {
  if (via === 'shop') {
    const shop = await getShopBot();
    if (shop) return shop.token;
  }
  const admin = await getTelegram();
  if (!admin?.chatId) throw new TelegramFail('Telegram bot ulanmagan');
  return admin.token;
}
