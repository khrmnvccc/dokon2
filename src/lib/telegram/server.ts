import 'server-only';
import { createHash, randomInt } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase/admin';
import {
  MAX_TEMPLATE_LENGTH, TEMPLATE_BY_KEY, isTemplateKey, renderTemplate, translateTelegramError,
  type TemplateChats, type TemplateKey, type TemplateSettings,
} from './templates';

// Doʻkon boti (kassa server/telegram.ts asosida). Token bir marta Xabarlar oynasida kiritiladi va faqat
// bazada (app_meta 'telegram', RLS yopiq) turadi: brauzerga hech qachon qaytarilmaydi.
export interface TelegramConfig {
  token: string;
  botName: string;
  code: string; // Ega botga yuboradigan bir martalik kod
  chatId?: number;
  chatName?: string;
  /** Ega akkaunti: admin botidagi mini-ilova shu akkauntga kiritadi */
  ownerUserId?: string;
  groupId?: number;
  groupName?: string;
  groupThreadId?: number;
  groupPaused?: boolean;
  personalPaused?: boolean;
}

export interface TelegramError { chat: 'personal' | 'group'; message: string; at: string }

export class TelegramFail extends Error {}
/** Guruh superguruhga aylandi — yangi id */
export class ChatMoved extends Error {
  constructor(public chatId: number) { super('Telegram guruhi yangilandi'); }
}

const API = 'https://api.telegram.org';
const db = () => getServiceSupabase();

async function readMeta<T>(key: string): Promise<T | null> {
  const { data, error } = await db().from('app_meta').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}
async function writeMeta(key: string, value: unknown | null) {
  const q = value === null
    ? db().from('app_meta').delete().eq('key', key)
    : db().from('app_meta').upsert({ key, value, updated_at: new Date().toISOString() });
  const { error } = await q;
  if (error) throw error;
}

let cache: { value: TelegramConfig | null; until: number } | null = null;

export async function getTelegram(): Promise<TelegramConfig | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (cache && cache.until > Date.now()) return cache.value;
  const value = await readMeta<TelegramConfig>('telegram');
  cache = { value, until: Date.now() + 30_000 };
  return value;
}

export async function saveTelegram(config: TelegramConfig | null) {
  cache = null;
  await writeMeta('telegram', config);
}

/** Telegram API chaqiruvi: 10 soniyadan oshsa toʻxtatiladi, xato oʻzbekchaga oʻgiriladi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tg(token: string, method: string, body: Record<string, unknown>, timeoutMs = 10_000): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: 'no-store',
    });
  } catch {
    throw new TelegramFail('Telegram bilan aloqa boʻlmadi. Birozdan keyin qayta urinib koʻring');
  }
  const data = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string; parameters?: { migrate_to_chat_id?: number } } | null;
  if (!data?.ok) {
    if (data?.parameters?.migrate_to_chat_id) throw new ChatMoved(data.parameters.migrate_to_chat_id);
    if (res.status === 401 || res.status === 404) throw new TelegramFail('Bot tokeni notoʻgʻri. @BotFather bergan tokenni toʻliq nusxalang');
    throw new TelegramFail(translateTelegramError(data?.description || String(res.status)));
  }
  return data.result;
}

export const newCode = () => String(randomInt(100000, 999999));
export const groupCode = (token: string) => `G${createHash('sha256').update(`group:${token}`).digest().readUInt32BE(0) % 900000 + 100000}`;
export const personCode = (token: string, userId: string) => `K${createHash('sha256').update(`person:${token}:${userId}`).digest().readUInt32BE(0) % 90_000_000 + 10_000_000}`;

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

// ---------- Yuborilganlar jurnali (oxirgi ~500 ta) ----------
export async function logSend(template: string, chat: string, text: string, error: unknown) {
  try {
    await db().from('telegram_log').insert({ template, chat, ok: !error, text: text.slice(0, 4000), error: error ? errText(error) : null });
    if (Math.random() < 0.1) {
      const { data } = await db().from('telegram_log').select('id').order('id', { ascending: false }).range(500, 500);
      if (data?.[0]) await db().from('telegram_log').delete().lte('id', data[0].id);
    }
  } catch (e) {
    console.error('telegram log', e);
  }
}

export async function getTelegramErrors(): Promise<TelegramError[]> {
  const { data } = await db().from('app_meta').select('value').in('key', ['telegram_error_personal', 'telegram_error_group']);
  return (data ?? []).map((r) => r.value as TelegramError);
}
async function setTelegramError(chat: 'personal' | 'group', error: unknown | null) {
  try {
    await writeMeta(`telegram_error_${chat}`, error === null ? null : { chat, message: errText(error), at: new Date().toISOString() });
  } catch (e) {
    console.error('telegram error note', e);
  }
}

// ---------- Shablonlar (app_meta 'telegram_templates') ----------
let templateCache: { value: TemplateSettings; until: number } | null = null;

export async function getTemplateSettings(): Promise<TemplateSettings> {
  if (templateCache && templateCache.until > Date.now()) return templateCache.value;
  const raw = (await readMeta<Partial<TemplateSettings>>('telegram_templates')) ?? {};
  const value: TemplateSettings = {
    texts: Object.fromEntries(Object.entries(raw.texts ?? {}).filter(([k]) => isTemplateKey(k))),
    off: (raw.off ?? []).filter(isTemplateKey),
    chats: Object.fromEntries(Object.entries(raw.chats ?? {}).filter(([k]) => isTemplateKey(k))),
  };
  templateCache = { value, until: Date.now() + 30_000 };
  return value;
}

export async function saveTemplate(key: TemplateKey, change: { text?: string | null; on?: boolean; chats?: TemplateChats }) {
  const current = await getTemplateSettings();
  const texts = { ...current.texts };
  let off = [...current.off];
  if (change.text !== undefined) {
    const clean = change.text?.replace(/\r\n/g, '\n').trim() || null;
    if (clean && clean.length > MAX_TEMPLATE_LENGTH) throw new TelegramFail(`Matn juda uzun (${MAX_TEMPLATE_LENGTH} belgigacha)`);
    if (!clean || clean === TEMPLATE_BY_KEY[key].text) delete texts[key];
    else texts[key] = clean;
  }
  if (change.on !== undefined) off = change.on ? off.filter((k) => k !== key) : [...new Set([...off, key])];
  const chats = { ...current.chats };
  if (change.chats) {
    const next: TemplateChats = { ...chats[key], ...change.chats };
    if (next.staff && !next.staff.length) delete next.staff;
    chats[key] = next;
  }
  const next: TemplateSettings = { texts, off, chats };
  templateCache = null;
  await writeMeta('telegram_templates', next);
  return next;
}

/** Eganing matni (yoki standart) qiymatlar bilan; xabar oʻchirilgan boʻlsa null. */
export async function messageText(key: TemplateKey, values: Record<string, string | number | null | undefined>): Promise<string | null> {
  const s = await getTemplateSettings().catch((): TemplateSettings => ({ texts: {}, off: [], chats: {} }));
  if (s.off.includes(key)) return null;
  return renderTemplate(s.texts[key] || TEMPLATE_BY_KEY[key].text, values);
}

// ---------- Yuborish ----------
const sendText = (token: string, chatId: number, text: string, extra: Record<string, unknown> = {}) =>
  tg(token, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

export interface TgPhoto { bytes: Uint8Array; mime: string; name: string }

/** Rasmni toʻgʻridan-toʻgʻri yuklab yuboradi (havola tashqariga chiqmaydi). Izoh 1024 belgidan oshsa — alohida xabar. */
async function sendPhoto(token: string, chatId: number, photo: TgPhoto, caption: string, extra: Record<string, unknown> = {}) {
  const short = caption.length <= 1024;
  const form = new FormData();
  form.set('chat_id', String(chatId));
  for (const [k, v] of Object.entries(extra)) form.set(k, String(v));
  if (short) { form.set('caption', caption); form.set('parse_mode', 'HTML'); }
  form.set('photo', new Blob([photo.bytes as BlobPart], { type: photo.mime }), photo.name);
  let res: Response;
  try {
    res = await fetch(`${API}/bot${token}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  } catch {
    throw new TelegramFail('Telegram bilan aloqa boʻlmadi. Birozdan keyin qayta urinib koʻring');
  }
  const data = (await res.json().catch(() => null)) as { ok?: boolean; description?: string; parameters?: { migrate_to_chat_id?: number } } | null;
  if (!data?.ok) {
    if (data?.parameters?.migrate_to_chat_id) throw new ChatMoved(data.parameters.migrate_to_chat_id);
    throw new TelegramFail(translateTelegramError(data?.description || String(res.status)));
  }
  if (!short) await sendText(token, chatId, caption, extra);
}

/**
 * Bitta shablon xabarini Ega chatiga, guruhga va tanlangan xodimlarga yuboradi. Hech qachon xato tashlamaydi:
 * natija jurnalga yoziladi. Buyurtma saqlanishini sekinlashtirmaslik uchun after() ichida chaqiriladi.
 */
export async function notify(key: TemplateKey, values: Record<string, string | number | null | undefined>, opts: { personalOnly?: boolean; photo?: TgPhoto } = {}) {
  try {
    const config = await getTelegram();
    if (!config?.chatId) return;
    const text = await messageText(key, values);
    if (!text) return;
    const settings = await getTemplateSettings();
    const where = settings.chats[key];
    const def = TEMPLATE_BY_KEY[key];
    const targets: Array<{ chatId: number; which: 'personal' | 'group' | 'staff'; name?: string }> = [];
    if (!config.personalPaused && where?.personal !== false) targets.push({ chatId: config.chatId, which: 'personal' });
    if (!opts.personalOnly && def.groupChat && config.groupId && !config.groupPaused && where?.group !== false) targets.push({ chatId: config.groupId, which: 'group' });
    if (!opts.personalOnly && def.staff && where?.staff?.length) {
      const { data } = await db().from('telegram_people').select('user_id, chat_id, chat_name').in('user_id', where.staff);
      for (const p of data ?? []) {
        const chatId = Number(p.chat_id);
        if (!targets.some((t) => t.chatId === chatId)) targets.push({ chatId, which: 'staff', name: p.chat_name ?? '' });
      }
    }
    // Rasm boʻlsa — rasm + izoh; rasm oʻtmasa ham matn baribir yetib borsin
    const send = async (id: number, topic: Record<string, unknown>) => {
      if (!opts.photo) return sendText(config.token, id, text, topic);
      try {
        await sendPhoto(config.token, id, opts.photo, text, topic);
      } catch (e) {
        if (e instanceof ChatMoved) throw e;
        await sendText(config.token, id, text, topic);
      }
    };
    await Promise.allSettled(targets.map(async ({ chatId, which, name }) => {
      const topic = which === 'group' && config.groupThreadId ? { message_thread_id: config.groupThreadId } : {};
      const logChat = which === 'staff' ? `staff:${name}` : which;
      try {
        try {
          await send(chatId, topic);
        } catch (e) {
          if (!(e instanceof ChatMoved) || which !== 'group') throw e;
          await saveTelegram({ ...config, groupId: e.chatId });
          await send(e.chatId, topic);
        }
        await Promise.all([which === 'staff' ? null : setTelegramError(which, null), logSend(key, logChat, text, null)]);
      } catch (e) {
        await Promise.all([which === 'staff' ? null : setTelegramError(which, e), logSend(key, logChat, text, e)]);
      }
    }));
  } catch (e) {
    console.error('telegram notify', key, e);
  }
}

/** Faqat Ega chatiga (sinov xabari). Xato tashlaydi — foydalanuvchiga koʻrsatiladi. */
export async function sendToOwner(text: string, logAs: string) {
  const config = await getTelegram();
  if (!config?.chatId) throw new TelegramFail('Telegram ulanmagan');
  try {
    await sendText(config.token, config.chatId, text);
  } catch (e) {
    await logSend(logAs, 'personal', text, e);
    throw e;
  }
  await logSend(logAs, 'personal', text, null);
}

export interface TgUpdate {
  update_id: number;
  message?: {
    text?: string; message_thread_id?: number; is_topic_message?: boolean; migrate_to_chat_id?: number;
    chat: { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string };
    from?: { id: number }; new_chat_members?: Array<{ username?: string }>;
  };
}

/** Botning oxirgi 100 ta xabari (eskilari band guruhda kerakli xabarni yashirmasin). */
export const recentUpdates = (token: string): Promise<TgUpdate[]> =>
  tg(token, 'getUpdates', { offset: -100, allowed_updates: ['message'], timeout: 0 });

export const chatTitle = (c: { first_name?: string; last_name?: string; username?: string; title?: string }) =>
  c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || 'Telegram';
