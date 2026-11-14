import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/data/public';
import { formatPrice } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import { ADMIN_URL, SITE_URL } from '@/lib/env';
import { chatTitle, getTelegram, logSend, tg, TelegramFail } from './server';
import type { OrderStatus } from '@/lib/types';
import { ensureShopUser, profileOf, savePhone, tgDisplay } from './tg-users';
import { attachReferral, trackRefOpen } from '@/lib/referral-server';
import { parseRefCode } from '@/lib/referral';
import { renderTemplate } from './templates';
import {
  CAPTION_MAX, CUSTOMER_MSG_BY_KEY, customerImage, customerSample,
  type CustomerMsgKey, type CustomerMsgSetting, type CustomerMsgSettings,
} from './customer-messages';

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
    contact?: { phone_number: string; first_name?: string; last_name?: string; user_id?: number };
    chat: { id: number; type: string; first_name?: string; last_name?: string; username?: string };
    from?: { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function send(config: ShopBotConfig, chatId: number, text: string, keyboard?: unknown[][], markup?: Record<string, unknown>) {
  await tg(config.token, 'sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : markup ? { reply_markup: markup } : {}),
  });
}

/** Pastdagi katta tugma: bosilsa Telegram raqamni botga yuboradi (Laylakdagidek bir bosishda roʻyxatdan oʻtish). */
const PHONE_KEYBOARD = { keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true, input_field_placeholder: 'Pastdagi tugmani bosing' };

async function askPhone(config: ShopBotConfig, chatId: number) {
  await send(config, chatId, '📱 <b>Roʻyxatdan oʻtish</b> — bir bosishda.\nPastdagi <b>“Raqamni yuborish”</b> tugmasini bosing. Raqamingiz faqat buyurtmani yetkazish uchun kerak.', undefined, PHONE_KEYBOARD);
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
  if (!m || m.chat.type !== 'private') return;
  const { brand: b0 } = await getSettings();

  // Raqam yuborildi: faqat oʻz raqami (boshqa odamning kontaktini ulashsa — qabul qilinmaydi).
  if (m.contact) {
    const from = m.from;
    if (!from || m.contact.user_id !== from.id) {
      await send(config, m.chat.id, 'Iltimos, oʻzingizning raqamingizni pastdagi tugma orqali yuboring.', undefined, PHONE_KEYBOARD);
      return;
    }
    const userId = await ensureShopUser(from);
    const phone = userId ? await savePhone(userId, m.contact.phone_number, tgDisplay(from)) : null;
    if (!userId || !phone) {
      await send(config, m.chat.id, 'Raqamni saqlab boʻlmadi. Birozdan keyin qayta urinib koʻring.', undefined, PHONE_KEYBOARD);
      return;
    }
    const p = await profileOf(userId);
    await send(config, m.chat.id, `✅ Roʻyxatdan oʻtdingiz!${p?.client_no ? `\nSizning ID: <b>${p.client_no}</b>` : ''}\nTelefon: ${esc(phone)}`, undefined, { remove_keyboard: true });
    await send(config, m.chat.id, `Endi <b>${esc(b0.name || 'doʻkon')}</b>dan xarid qilishingiz mumkin 👇`, [[openButton('🛍 Doʻkonni ochish')]]);
    return;
  }
  if (typeof m.text !== 'string') return;
  const text = m.text.trim();
  const cmd = text.split(/[\s@]/)[0].toLowerCase();
  const { brand, contact } = await getSettings();
  const name = esc(brand.name || 'Doʻkon');

  if (cmd === '/start') {
    await upsertSubscriber(m.chat, true);
    // Akkaunt darhol ochiladi; raqami yoʻq boʻlsa — salomdan keyin bir bosishda roʻyxatdan oʻtish taklif qilinadi.
    const startUser = m.from ? await ensureShopUser(m.from) : null;
    const startProfile = startUser ? await profileOf(startUser) : null;
    // Doʻst havolasi: /start ref_1234 — yangi mijoz taklif qilgan odamga bogʻlanadi
    const refNo = parseRefCode(text.split(/\s+/)[1]);
    if (refNo) await trackRefOpen(refNo);
    if (startUser && refNo) {
      const res = await attachReferral(startUser, refNo, 'bot');
      if (res.ok) await afterReferralAttach(config, res, startUser, m.chat.id);
    }
    const first = esc(m.from?.first_name || m.chat.first_name || '');
    await send(config, m.chat.id,
      `Assalomu alaykum${first ? `, <b>${first}</b>` : ''}! 👋\n\n<b>${name}</b> botiga xush kelibsiz.\n\n` +
      `🛍 <b>Doʻkonni ochish</b> tugmasini bosing — doʻkon shu yerda, Telegram ichida ochiladi. Roʻyxatdan oʻtish shart emas.\n` +
      `📦 Buyurtma bersangiz, holati shu chatga keladi.\n🎁 Aksiya va kuponlar haqida birinchi boʻlib bilasiz.\n\n` +
      `Xabarlar kerak boʻlmasa — /stop`,
      [[openButton('🛍 Doʻkonni ochish')], [openButton('🎁 Aksiyalar', '/sale'), openButton('📦 Buyurtmalarim', '/account/orders')], [openButton('🤝 Doʻstni taklif qilish', '/account/referral')]],
    );
    if (startUser && !startProfile?.phone) await askPhone(config, m.chat.id);
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

// ---------- Xaridorga xabarlar: rasm + matn + tugma (Ega boshqaradi) ----------
const META_KEY = 'customer_messages';
let msgCache: { value: CustomerMsgSettings; until: number } | null = null;

export async function getCustomerMsgSettings(): Promise<CustomerMsgSettings> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return {};
  if (msgCache && msgCache.until > Date.now()) return msgCache.value;
  const { data } = await db().from('app_meta').select('value').eq('key', META_KEY).maybeSingle();
  const value = (data?.value && typeof data.value === 'object' ? data.value : {}) as CustomerMsgSettings;
  msgCache = { value, until: Date.now() + 30_000 };
  return value;
}

/** Bitta xabar sozlamasini yangilaydi. null — standartga qaytarish. */
export async function saveCustomerMsgSetting(key: CustomerMsgKey, patch: { text?: string | null; button?: string | null; image?: string | null; on?: boolean }) {
  const all = { ...(await getCustomerMsgSettings()) };
  const cur: CustomerMsgSetting = { ...(all[key] ?? {}) };
  if (patch.text !== undefined) { if (patch.text === null) delete cur.text; else cur.text = patch.text; }
  if (patch.button !== undefined) { if (patch.button === null) delete cur.button; else cur.button = patch.button; }
  if (patch.image !== undefined) { if (patch.image === null) delete cur.image; else cur.image = patch.image; }
  if (patch.on !== undefined) { if (patch.on) delete cur.off; else cur.off = true; }
  if (Object.keys(cur).length) all[key] = cur; else delete all[key];
  const { error } = await db().from('app_meta').upsert({ key: META_KEY, value: all, updated_at: new Date().toISOString() });
  msgCache = null;
  if (error) throw error;
}

export interface RichMessage { html: string; image: string | null; buttons: unknown[][] }

/** Shablondan tayyor xabar (oʻchirilgan boʻlsa null). */
export async function customerMessage(key: CustomerMsgKey, values: Record<string, string | number | null | undefined>, link: { path: string }, imageExtra = '', override?: { text?: string; button?: string }): Promise<RichMessage | null> {
  const def = CUSTOMER_MSG_BY_KEY[key];
  const s = (await getCustomerMsgSettings())[key];
  if (s?.off && !override) return null;
  const html = renderTemplate(override?.text ?? s?.text ?? def.text, values);
  const label = (override?.button ?? s?.button ?? def.button).trim();
  return {
    html,
    image: customerImage(SITE_URL, key, s, imageExtra),
    buttons: label ? [[openButton(label, link.path)]] : [],
  };
}

/** Rasm boʻlsa — rasm ostida yozuv bilan, boʻlmasa oddiy matn. Rasm yuklanmasa matn baribir yetadi. */
export async function sendRich(token: string, chatId: number, msg: RichMessage) {
  const markup = msg.buttons.length ? { reply_markup: { inline_keyboard: msg.buttons } } : {};
  if (msg.image && msg.html.length <= CAPTION_MAX) {
    try {
      await tg(token, 'sendPhoto', { chat_id: chatId, photo: msg.image, caption: msg.html, parse_mode: 'HTML', ...markup }, 20_000);
      return;
    } catch (e) {
      // Foydalanuvchi botni bloklagan boʻlsa matnni ham urinmaymiz.
      if (e instanceof Error && /bloklagan|oʻchirilgan|topilmadi|tokeni/.test(e.message)) throw e;
    }
  }
  await tg(token, 'sendMessage', { chat_id: chatId, text: msg.html, parse_mode: 'HTML', disable_web_page_preview: true, ...markup });
}

const STATUS_MSG: Partial<Record<'new' | OrderStatus, CustomerMsgKey>> = {
  new: 'orderNew', confirmed: 'confirmed', processing: 'processing', shipped: 'shipped', delivered: 'delivered', cancelled: 'cancelled', returned: 'returned',
};

/** Buyurtma egasining Telegramiga (doʻkon boti orqali) xabar. Hech qachon xato tashlamaydi. */
export async function notifyCustomer(orderId: string, kind: 'new' | OrderStatus) {
  try {
    const key = STATUS_MSG[kind];
    if (!key) return;
    const config = await getShopBot();
    if (!config) return;
    const { data: o } = await db().from('orders').select('id, number, user_id, total, tracking_number, customer_name, items_count').eq('id', orderId).maybeSingle();
    if (!o?.user_id) return;
    const { data: subs } = await db().from('telegram_subscribers').select('chat_id').eq('user_id', o.user_id).eq('via', 'shop');
    if (!subs?.length) return;
    const { brand } = await getSettings();
    const msg = await customerMessage(key, {
      raqam: o.number, mijoz: String(o.customer_name ?? '').split(' ')[0], summa: formatPrice(Number(o.total), 'soʻm'),
      soni: o.items_count ? `${o.items_count} dona` : '', trek: o.tracking_number ?? '', dokon: brand.name || 'Doʻkon',
    }, { path: `/account/orders/${o.id}` });
    if (!msg) return;
    for (const s of subs) {
      try {
        await sendRich(config.token, Number(s.chat_id), msg);
        await logSend(`customer:${kind}`, `mijoz:${o.number}`, msg.html, null);
      } catch (e) {
        await logSend(`customer:${kind}`, `mijoz:${o.number}`, msg.html, e);
      }
    }
  } catch (e) {
    console.error('notify customer', e);
  }
}

const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };

/** Kupon xabari uchun qiymatlar (kod — xaridorga beriladigan narsa, rasmda chiqmaydi). */
async function couponMessage(couponId: string, name: string) {
  const { data: c } = await db().from('coupons').select('id, code, description, discount_type, value, max_discount, min_order_amount, ends_at, is_active, design').eq('id', couponId).maybeSingle();
  if (!c) throw new TelegramFail('Kupon topilmadi');
  if (!c.is_active) throw new TelegramFail('Kupon oʻchirilgan — avval yoqing');
  if (c.ends_at && new Date(c.ends_at).getTime() < Date.now()) throw new TelegramFail('Kupon muddati tugagan');
  const { brand } = await getSettings();
  const qiymat = c.discount_type === 'percent'
    ? `${c.value}%${c.max_discount ? ` (koʻpi bilan ${formatPrice(Number(c.max_discount), 'soʻm')})` : ''}`
    : formatPrice(Number(c.value), 'soʻm');
  const v = { mijoz: name, kupon: c.description || c.code, qiymat, kod: c.code, muddat: c.ends_at ? fmtDate(c.ends_at) : '', min: c.min_order_amount ? formatPrice(Number(c.min_order_amount), 'soʻm') : '', dokon: brand.name || 'Doʻkon' };
  return { values: v, extra: `?c=${c.id}&v=${Date.parse(String(c.ends_at ?? '')) || 0}` };
}

/**
 * Kuponni doʻkon boti orqali yuboradi: hamma obunachilarga yoki bitta mijozga (ID raqami boʻyicha).
 * Bitta chatga bir marta; botni bloklaganlar obunadan chiqariladi.
 */
export async function sendCouponToCustomers(couponId: string, clientNo: number | null, path = '/sale') {
  const config = await getShopBot();
  if (!config) throw new TelegramFail('Doʻkon boti ulanmagan. Telegram → Botlar boʻlimida ulang');
  let q = db().from('telegram_subscribers').select('chat_id, name, user_id').eq('via', 'shop');
  if (clientNo !== null) {
    const { data: p } = await db().from('profiles').select('id').eq('client_no', clientNo).maybeSingle();
    if (!p) throw new TelegramFail(`ID ${clientNo} boʻlgan mijoz topilmadi`);
    q = q.eq('user_id', p.id);
  } else {
    q = q.eq('subscribed', true);
  }
  const { data: subs } = await q.limit(5000);
  if (!subs?.length) throw new TelegramFail(clientNo !== null ? 'Bu mijoz doʻkon botiga ulanmagan' : 'Doʻkon botida hali obunachi yoʻq');
  let delivered = 0;
  let failed = 0;
  const base = await couponMessage(couponId, '');
  for (const s of subs) {
    const first = String(s.name ?? '').split(' ')[0];
    const msg = await customerMessage('coupon', { ...base.values, mijoz: first }, { path }, base.extra);
    if (!msg) throw new TelegramFail('“Sizga kupon berildi” xabari oʻchirilgan. Xabarlar va Push → Mijozga boʻlimida yoqing');
    try {
      await sendRich(config.token, Number(s.chat_id), msg);
      delivered++;
      await logSend('customer:coupon', `mijoz:${s.name ?? s.chat_id}`, msg.html, null);
    } catch (e) {
      failed++;
      await logSend('customer:coupon', `mijoz:${s.name ?? s.chat_id}`, msg.html, e);
      if (e instanceof Error && /bloklagan|oʻchirilgan|topilmadi/.test(e.message)) {
        await db().from('telegram_subscribers').update({ subscribed: false }).eq('chat_id', s.chat_id);
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return { delivered, failed };
}

/** Admin “Namuna yuborish”: Eganing oʻz Telegramiga (doʻkon boti orqali, u /start bosgan boʻlsa). */
export async function testCustomerMessage(key: CustomerMsgKey, ownerId: string, override: { text?: string; button?: string }) {
  const config = await getShopBot();
  if (!config) throw new TelegramFail('Doʻkon boti ulanmagan');
  const { data: subs } = await db().from('telegram_subscribers').select('chat_id').eq('user_id', ownerId).eq('via', 'shop').limit(1);
  if (!subs?.length) throw new TelegramFail('Namuna uchun doʻkon botiga oʻzingiz /start bosing (shu akkaunt bilan)');
  const msg = await customerMessage(key, customerSample(key), { path: key === 'coupon' ? '/sale' : '/account/orders' }, '', override);
  if (!msg) return;
  await sendRich(config.token, Number(subs[0].chat_id), msg);
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

// ---------- Doʻstni taklif qilish: bot xabarlari ----------
async function chatsOf(userId: string) {
  const { data } = await db().from('telegram_subscribers').select('chat_id, name').eq('user_id', userId).eq('via', 'shop').limit(3);
  return (data ?? []) as { chat_id: number; name: string | null }[];
}

async function textToUser(config: ShopBotConfig, userId: string, html: string, keyboard?: unknown[][]) {
  for (const c of await chatsOf(userId)) {
    try { await send(config, Number(c.chat_id), html, keyboard); } catch (e) { console.error('referral msg', e); }
  }
}

/** Bogʻlangandan keyin: doʻstga sovgʻa kupon, taklif qilganga “doʻstingiz qoʻshildi”. */
async function afterReferralAttach(config: ShopBotConfig, res: { referrer_id?: string; welcome_coupon_id?: string | null }, friendId: string, chatId: number) {
  try {
    const friend = await profileOf(friendId);
    if (res.welcome_coupon_id) {
      const { data: c } = await db().from('coupons').select('value, min_order_amount, ends_at').eq('id', res.welcome_coupon_id).maybeSingle();
      if (c) {
        await send(config, chatId,
          `🎁 <b>Sizga sovgʻa!</b>\nDoʻstingiz taklifi bilan kelganingiz uchun <b>${formatPrice(Number(c.value), 'soʻm')}</b> chegirma kuponi berildi.` +
          (Number(c.min_order_amount) ? `\nBuyurtma ${formatPrice(Number(c.min_order_amount), 'soʻm')} dan boshlab.` : '') +
          (c.ends_at ? `\nAmal qiladi: ${fmtDate(String(c.ends_at))} gacha.` : '') +
          `\n\nKupon kabinetingizda — rasmiylashtirishda bir bosishda qoʻllanadi.`,
          [[openButton('🎟 Kuponlarim', '/account/referral')]]);
      }
    }
    if (res.referrer_id) {
      const first = esc(String(friend?.full_name ?? '').split(' ')[0] || 'Doʻstingiz');
      await textToUser(config, res.referrer_id,
        `🤝 <b>${first}</b> havolangiz orqali qoʻshildi!\nU birinchi buyurtmasini olgach, sizga kupon beriladi.`,
        [[openButton('📊 Taklif qilish', '/account/referral')]]);
    }
  } catch (e) {
    console.error('referral attach msg', e);
  }
}

/**
 * Bosqich kuponlari: bazada buyurtma holati oʻzgarganda yaratiladi, bu yerda egasiga botda yuboriladi.
 * Har biri bir marta (notified_at). Bot ulanmagan boʻlsa ham belgilanadi — kupon baribir kabinetda turadi.
 */
export async function notifyReferralRewards() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const { data } = await db().from('referral_rewards').select('id, referrer_id, coupon_id, step')
      .is('notified_at', null).order('created_at').limit(20);
    if (!data?.length) return;
    const config = await getShopBot();
    for (const r of data) {
      await db().from('referral_rewards').update({ notified_at: new Date().toISOString() }).eq('id', r.id).is('notified_at', null);
      if (!config || !r.coupon_id) continue;
      const chats = await chatsOf(String(r.referrer_id));
      if (!chats.length) continue;
      try {
        const base = await couponMessage(String(r.coupon_id), '');
        for (const c of chats) {
          const msg = await customerMessage('coupon', { ...base.values, mijoz: String(c.name ?? '').split(' ')[0] }, { path: '/account/referral' }, base.extra);
          if (!msg) break;
          try {
            await sendRich(config.token, Number(c.chat_id), msg);
            await logSend('customer:referral', `mijoz:${c.name ?? c.chat_id}`, msg.html, null);
          } catch (e) {
            await logSend('customer:referral', `mijoz:${c.name ?? c.chat_id}`, msg.html, e);
          }
        }
      } catch (e) {
        console.error('referral reward msg', e);
      }
    }
  } catch (e) {
    console.error('referral rewards', e);
  }
}

/** Admin qoʻlda bergan shaxsiy kuponni egasiga yuboradi (bot ulanmagan boʻlsa — false). */
export async function sendPersonalCoupon(couponId: string, userId: string) {
  const config = await getShopBot();
  if (!config) return false;
  const chats = await chatsOf(userId);
  if (!chats.length) return false;
  const base = await couponMessage(couponId, '');
  let sent = false;
  for (const c of chats) {
    const msg = await customerMessage('coupon', { ...base.values, mijoz: String(c.name ?? '').split(' ')[0] }, { path: '/account/referral' }, base.extra);
    if (!msg) return false;
    try { await sendRich(config.token, Number(c.chat_id), msg); sent = true; await logSend('customer:gift', `mijoz:${c.name ?? c.chat_id}`, msg.html, null); }
    catch (e) { await logSend('customer:gift', `mijoz:${c.name ?? c.chat_id}`, msg.html, e); }
  }
  return sent;
}

/** Mini-ilova yoki sayt orqali bogʻlanganda ham xabarlar (bot ulangan boʻlsa). */
export async function referralAttachedNotice(res: { referrer_id?: string; welcome_coupon_id?: string | null }, friendId: string) {
  const config = await getShopBot().catch(() => null);
  if (!config) return;
  const chats = await chatsOf(friendId);
  await afterReferralAttach(config, { ...res, welcome_coupon_id: chats.length ? res.welcome_coupon_id : null }, friendId, chats[0]?.chat_id ?? 0);
}
