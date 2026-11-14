import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { chatTitle, getTelegram, logSend, recentUpdates, tg, TelegramFail } from './server';
import { tokenFor } from './shop-bot';
import { CAPTION_MAX, validImageUrl } from './customer-messages';
import {
  BROADCAST_MAX_BUTTONS, BROADCAST_MAX_TEXT, renderTemplate,
  type Broadcast, type BroadcastAudience, type BroadcastButton,
} from './templates';

// Ommaviy xabarlar (kassa server/broadcast.ts asosida): Ega bitta xabar (2 tagacha havola tugmasi bilan)
// yozadi va xodimlarga, botga obuna boʻlgan xaridorlarga yoki hammasiga — hozir yoki belgilangan vaqtda yuboradi.
// Belgilangan vaqt cron (/api/cron/telegram) va admin panel ochiq turganda tekshiriladi.

const db = () => getServiceSupabase();
const COLUMNS = 'id, title, text, image, buttons, audience, silent, send_at, status, delivered, failed, created_at, sent_at';

export interface BroadcastInput { title?: string; text?: string; image?: string | null; buttons?: BroadcastButton[]; audience?: BroadcastAudience; silent?: boolean; sendAt?: string | null }

/** Muharrir yuborganini tekshiradi va tozalaydi; xato boʻlsa sababi bilan TelegramFail. */
export function parseBroadcast(body: BroadcastInput) {
  const title = String(body.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const text = String(body.text ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) throw new TelegramFail('Xabar matnini yozing');
  if (text.length > BROADCAST_MAX_TEXT) throw new TelegramFail(`Matn juda uzun (${BROADCAST_MAX_TEXT} belgigacha)`);
  const image = body.image ? String(body.image).trim() : null;
  if (image && !validImageUrl(image)) throw new TelegramFail('Rasm manzili notoʻgʻri');
  if (image && text.length > CAPTION_MAX) throw new TelegramFail(`Rasmli xabar matni ${CAPTION_MAX} belgidan oshmasin`);
  const buttons: BroadcastButton[] = [];
  for (const b of (body.buttons ?? []).slice(0, BROADCAST_MAX_BUTTONS)) {
    const label = String(b?.text ?? '').trim().slice(0, 40);
    const url = String(b?.url ?? '').trim().slice(0, 300);
    if (!label && !url) continue;
    if (!label) throw new TelegramFail('Tugma nomini yozing');
    if (!/^https:\/\/\S+$/i.test(url) && !/^tg:\/\/\S+$/i.test(url)) throw new TelegramFail(`“${label}” tugmasi uchun https:// bilan boshlanadigan havola yozing`);
    buttons.push({ text: label, url });
  }
  const kind = (['staff', 'customers', 'all'] as const).includes(body.audience?.kind as 'all') ? body.audience!.kind : 'all';
  const users = kind === 'staff' && Array.isArray(body.audience?.users)
    ? [...new Set(body.audience.users.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 500)
    : [];
  const audience: BroadcastAudience = users.length ? { kind, users } : { kind };
  let sendAt: string | null = null;
  if (body.sendAt) {
    const t = Date.parse(body.sendAt);
    if (!Number.isFinite(t)) throw new TelegramFail('Vaqt notoʻgʻri');
    if (t > Date.now() + 60 * 86_400_000) throw new TelegramFail('Vaqt 60 kundan uzoq boʻlmasin');
    sendAt = new Date(t).toISOString();
  }
  return { title, text, image, buttons, audience, silent: body.silent === true, sendAt };
}

export interface Recipient { chatId: number; name: string; via: 'admin' | 'shop' }

/** Kimga yetadi: Telegramini ulagan xodimlar va/yoki obuna xaridorlar (bir chat bir marta). */
export async function recipients(audience: BroadcastAudience): Promise<Recipient[]> {
  const out = new Map<number, Recipient>();
  if (audience.kind !== 'customers') {
    let q = db().from('telegram_people').select('user_id, chat_id, chat_name');
    if (audience.users?.length) q = q.in('user_id', audience.users);
    const { data } = await q;
    for (const p of data ?? []) out.set(Number(p.chat_id), { chatId: Number(p.chat_id), name: `staff:${p.chat_name ?? ''}`, via: 'admin' });
  }
  if (audience.kind !== 'staff') {
    const { data } = await db().from('telegram_subscribers').select('chat_id, name, via').eq('subscribed', true).limit(20_000);
    for (const s of data ?? []) if (!out.has(Number(s.chat_id))) out.set(Number(s.chat_id), { chatId: Number(s.chat_id), name: `mijoz:${s.name ?? ''}`, via: s.via === 'shop' ? 'shop' : 'admin' });
  }
  return [...out.values()];
}

const keyboard = (buttons: BroadcastButton[]) =>
  buttons.length ? { reply_markup: { inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]) } } : {};

/** Bitta chatga, ommaviy xabar qanday koʻrinsa shunday. */
export async function sendOne(b: Pick<Broadcast, 'text' | 'buttons' | 'silent'> & { image?: string | null }, chatId: number, prefix = '', via: 'admin' | 'shop' = 'admin') {
  const token = await tokenFor(via);
  const html = prefix + renderTemplate(b.text, {});
  if (b.image && html.length <= CAPTION_MAX) {
    try {
      await tg(token, 'sendPhoto', { chat_id: chatId, photo: b.image, caption: html, parse_mode: 'HTML', disable_notification: b.silent, ...keyboard(b.buttons) }, 20_000);
      return html;
    } catch (e) {
      if (e instanceof Error && /bloklagan|oʻchirilgan|topilmadi|tokeni/.test(e.message)) throw e;
    }
  }
  await tg(token, 'sendMessage', {
    chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: b.silent, ...keyboard(b.buttons),
  });
  return html;
}

/**
 * Bitta xabarni "olish": faqat bitta server yuboradi (status → 'sending' atomar UPDATE … WHERE status IN …).
 * Ikki marta bosilsa yoki cron bilan bir vaqtga tushsa, ikkinchisi false oladi.
 */
export async function claim(id: number, from: Broadcast['status'][]) {
  const { data } = await db().from('broadcasts').update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', id).in('status', from).select('id');
  return Boolean(data?.length);
}

/** Olingan xabarni hammaga yuboradi (har biri orasida 60 ms — Telegram chegarasidan ancha past) va natijani yozadi. */
export async function deliver(id: number) {
  const { data } = await db().from('broadcasts').select(COLUMNS).eq('id', id).eq('status', 'sending').maybeSingle();
  const b = data as Broadcast | null;
  if (!b) return;
  let delivered = 0;
  let failed = 0;
  try {
    for (const r of await recipients(b.audience)) {
      try {
        const html = await sendOne(b, r.chatId, '', r.via);
        delivered++;
        await logSend('broadcast', r.name, html, null);
      } catch (e) {
        failed++;
        await logSend('broadcast', r.name, b.text, e);
        // Botni bloklagan xaridor keyingi safar roʻyxatda boʻlmaydi.
        if (r.name.startsWith('mijoz:') && e instanceof Error && /bloklagan|oʻchirilgan|topilmadi/.test(e.message)) {
          await db().from('telegram_subscribers').update({ subscribed: false }).eq('chat_id', r.chatId);
        }
      }
      await new Promise((res) => setTimeout(res, 60));
    }
  } finally {
    await db().from('broadcasts').update({
      status: delivered === 0 && failed > 0 ? 'failed' : 'sent', delivered, failed, sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', id);
  }
}

let lastDueCheck = 0;
/** Vaqti kelgan rejalashtirilgan xabarlar; bitta server daqiqasiga bir martadan koʻp tekshirmaydi. */
export async function deliverDue(force = false) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  if (!force && Date.now() - lastDueCheck < 60_000) return;
  lastDueCheck = Date.now();
  const { data } = await db().from('broadcasts').select('id').eq('status', 'scheduled').lte('send_at', new Date().toISOString()).order('send_at').limit(5);
  for (const { id } of data ?? []) if (await claim(id, ['scheduled'])) await deliver(id);
}

/**
 * Botga /start bosgan xaridorlarni obunachilar roʻyxatiga qoʻshadi, /stop yozganlarni chiqaradi.
 * Webhook ishlatilmaydi (kalit va manzil kerak boʻlmasin) — oxirgi 100 ta xabar oʻqiladi.
 */
export async function syncSubscribers() {
  const config = await getTelegram();
  if (!config?.chatId) return { added: 0 };
  const updates = await recentUpdates(config.token);
  const { data: staff } = await db().from('telegram_people').select('chat_id');
  const skip = new Set<number>([config.chatId, ...(staff ?? []).map((s) => Number(s.chat_id))]);
  const latest = new Map<number, { on: boolean; name: string; username: string | null }>();
  for (const u of updates) {
    const m = u.message;
    if (!m || m.chat.type !== 'private' || skip.has(m.chat.id) || typeof m.text !== 'string') continue;
    const t = m.text.trim().toLowerCase();
    // Xodim ulash kodi (K…) bilan kelgan /start xaridor emas.
    if (t.startsWith('/start') && !/\bk\d{8}\b/.test(t) && !t.includes(config.code)) latest.set(m.chat.id, { on: true, name: chatTitle(m.chat), username: m.chat.username ?? null });
    else if (t.startsWith('/stop')) latest.set(m.chat.id, { on: false, name: chatTitle(m.chat), username: m.chat.username ?? null });
  }
  if (!latest.size) return { added: 0 };
  const { data: viaShop } = await db().from('telegram_subscribers').select('chat_id').eq('via', 'shop').in('chat_id', [...latest.keys()]);
  const shopChats = new Set((viaShop ?? []).map((r) => Number(r.chat_id)));
  const rows = [...latest].filter(([chat_id]) => !shopChats.has(chat_id)).map(([chat_id, v]) => ({ chat_id, name: v.name, username: v.username, subscribed: v.on }));
  if (!rows.length) return { added: 0 };
  const { error } = await db().from('telegram_subscribers').upsert(rows, { onConflict: 'chat_id' });
  if (error) throw error;
  return { added: rows.filter((r) => r.subscribed).length };
}
