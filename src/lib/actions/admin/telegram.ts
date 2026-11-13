'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getStaffContext, type StaffContext } from '@/lib/auth';
import { withPermission } from '@/lib/admin/action';
import { getServiceSupabase } from '@/lib/supabase/admin';
import {
  ChatMoved, TelegramFail, chatTitle, getTelegram, groupCode, newCode, personCode, recentUpdates,
  saveTelegram, saveTemplate, sendToOwner, tg,
} from '@/lib/telegram/server';
import { claim, deliver, parseBroadcast, recipients, sendOne, syncSubscribers, type BroadcastInput } from '@/lib/telegram/broadcast';
import { MAX_TEMPLATE_LENGTH, TEMPLATE_BY_KEY, isTemplateKey, renderTemplate, sampleValues, type TemplateChats } from '@/lib/telegram/templates';
import type { ActionResult } from '@/lib/types';

// Xabarlar oynasining server amallari. Token va chat id faqat shu yerda (service role) oʻqiladi;
// brauzerga faqat "ulangan / ulanmagan", bot nomi va bir martalik kod qaytadi.

const PAGE = '/admin/messages';
const isOwner = (ctx: StaffContext) => ctx.roles.includes('super_admin');

/** Telegram va sozlash xatolarini foydalanuvchiga koʻrsatiladigan matnga oʻgiradi. */
function fail<T = undefined>(e: unknown): ActionResult<T> {
  if (e instanceof TelegramFail) return { ok: false, error: e.message };
  if (e instanceof Error && e.message.includes('SUPABASE_SERVICE_ROLE_KEY')) return { ok: false, error: 'Serverda SUPABASE_SERVICE_ROLE_KEY sozlanmagan' };
  console.error('telegram action', e);
  return { ok: false, error: 'Kutilmagan xatolik yuz berdi' };
}

async function audit(ctx: StaffContext, action: string, data: Record<string, unknown> = {}) {
  await getServiceSupabase().from('audit_logs')
    .insert({ actor_id: ctx.userId, actor_email: ctx.email, action, entity: 'telegram', new_data: data })
    .then(({ error }) => error && console.error('audit', error.message));
}

/** Faqat Ega: bot tokenini saqlash (getMe bilan tekshiriladi). */
export async function connectBot(token: string): Promise<ActionResult> {
  return withPermission('messages.manage', async (ctx) => {
    if (!isOwner(ctx)) return { ok: false, error: 'Botni faqat Ega ulaydi' };
    const t = String(token ?? '').trim();
    if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t)) return { ok: false, error: 'Bot tokeni notoʻgʻri. @BotFather bergan tokenni toʻliq nusxalang' };
    try {
      const me = await tg(t, 'getMe', {});
      await saveTelegram({ token: t, botName: me.username, code: newCode() });
      await audit(ctx, 'telegram_set', { bot: me.username });
    } catch (e) { return fail(e); }
    revalidatePath(PAGE);
    return { ok: true, message: 'Bot saqlandi. Endi botga kodni yuboring' };
  });
}

/** Ega botni ochib kodni yuborgach: chatini topamiz. */
export async function checkOwnerChat(): Promise<ActionResult> {
  return withPermission('messages.manage', async (ctx) => {
    if (!isOwner(ctx)) return { ok: false, error: 'Faqat Ega' };
    try {
      const config = await getTelegram();
      if (!config) return { ok: false, error: 'Avval bot tokenini kiriting' };
      if (config.chatId) return { ok: true, message: 'Allaqachon ulangan' };
      const updates = await recentUpdates(config.token);
      const match = updates.reverse().find((u) => u.message?.text?.includes(config.code) && u.message.chat.type === 'private');
      if (!match?.message) return { ok: false, error: `Botga hali kod kelmadi. @${config.botName} ni ochib, “Start” bosing yoki ${config.code} deb yozing` };
      const chat = match.message.chat;
      await saveTelegram({ ...config, chatId: chat.id, chatName: chatTitle(chat) });
      await tg(config.token, 'sendMessage', { chat_id: chat.id, text: '✅ Doʻkon ulandi. Yangi buyurtmalar va kechki hisobot shu yerga keladi.' }).catch(() => undefined);
      await audit(ctx, 'telegram_connect', { chat: chatTitle(chat) });
    } catch (e) { return fail(e); }
    revalidatePath(PAGE);
    return { ok: true, message: 'Telegram ulandi' };
  });
}

/**
 * Guruhni ulash: guruhda “/start@bot G123456” yoziladi (kod faqat shu oynada) yoki botni Eganing oʻzi qoʻshadi.
 * Begona odam botni oʻz guruhiga qoʻshsa — hech narsa olmaydi.
 */
export async function linkGroup(): Promise<ActionResult> {
  return withPermission('messages.manage', async (ctx) => {
    if (!isOwner(ctx)) return { ok: false, error: 'Faqat Ega' };
    try {
      const config = await getTelegram();
      if (!config?.chatId) return { ok: false, error: 'Avval botni oʻzingizga ulang' };
      const code = groupCode(config.token);
      const inGroup = (await recentUpdates(config.token)).map((u) => u.message).filter((m) => m && ['group', 'supergroup'].includes(m.chat.type)) as NonNullable<Awaited<ReturnType<typeof recentUpdates>>[number]['message']>[];
      const added = [...inGroup].reverse().find((m) => m.text?.includes(code)
        || (m.from?.id === config.chatId && (m.new_chat_members ?? []).some((u) => u.username === config.botName)));
      if (!added) return { ok: false, error: `Guruh topilmadi. Guruhda /start@${config.botName} ${code} deb yozing, keyin qayta bosing` };
      const threadId = added.is_topic_message && added.message_thread_id ? added.message_thread_id : undefined;
      let groupId = added.chat.id;
      const moved = inGroup.find((m) => m.chat.id === groupId && m.migrate_to_chat_id);
      if (moved?.migrate_to_chat_id) groupId = moved.migrate_to_chat_id;
      const hello = (id: number) => tg(config.token, 'sendMessage', {
        chat_id: id, ...(threadId ? { message_thread_id: threadId } : {}), text: '✅ Doʻkon: bu yerga yangi buyurtmalar va bekor qilinganlar haqida xabar keladi.',
      });
      try { await hello(groupId); } catch (e) {
        if (!(e instanceof ChatMoved)) throw e;
        groupId = e.chatId;
        await hello(groupId);
      }
      await saveTelegram({ ...config, groupId, groupThreadId: threadId, groupName: added.chat.title || 'Guruh', groupPaused: false });
      await audit(ctx, 'telegram_group', { group: added.chat.title });
    } catch (e) { return fail(e); }
    revalidatePath(PAGE);
    return { ok: true, message: 'Guruh ulandi' };
  });
}

export async function disconnectTelegram(what: 'bot' | 'group'): Promise<ActionResult> {
  return withPermission('messages.manage', async (ctx) => {
    if (!isOwner(ctx)) return { ok: false, error: 'Faqat Ega' };
    try {
      const config = await getTelegram();
      if (what === 'bot') await saveTelegram(null);
      else if (config) await saveTelegram({ ...config, groupId: undefined, groupName: undefined, groupThreadId: undefined, groupPaused: false });
      await audit(ctx, what === 'bot' ? 'telegram_disconnect' : 'telegram_group_unlink');
    } catch (e) { return fail(e); }
    revalidatePath(PAGE);
    return { ok: true, message: what === 'bot' ? 'Bot uzildi' : 'Guruh uzildi' };
  });
}

/** Ega chati yoki guruhni vaqtincha toʻxtatish (uzmasdan). */
export async function setChatPaused(which: 'personal' | 'group', paused: boolean): Promise<ActionResult> {
  return withPermission('messages.manage', async (ctx) => {
    try {
      const config = await getTelegram();
      if (!config?.chatId) return { ok: false, error: 'Telegram ulanmagan' };
      if (which === 'group' && !config.groupId) return { ok: false, error: 'Guruh ulanmagan' };
      await saveTelegram(which === 'group' ? { ...config, groupPaused: paused } : { ...config, personalPaused: paused });
      await audit(ctx, `telegram_${which}_${paused ? 'pause' : 'resume'}`);
    } catch (e) { return fail(e); }
    revalidatePath(PAGE);
    return { ok: true, message: paused ? 'Toʻxtatildi' : 'Qayta yoqildi' };
  });
}

const chatsSchema = z.object({ personal: z.boolean().optional(), group: z.boolean().optional(), staff: z.array(z.string().uuid()).max(100).optional() });

/** Bitta xabar: matni (null — standartga qaytarish), yoqilgan/oʻchirilgan va qaysi chatlarga ketadi. */
export async function updateTemplate(key: string, change: { text?: string | null; on?: boolean; chats?: TemplateChats }): Promise<ActionResult> {
  return withPermission('messages.manage', async (ctx) => {
    if (!isTemplateKey(key)) return { ok: false, error: 'Bunday xabar yoʻq' };
    const clean: { text?: string | null; on?: boolean; chats?: TemplateChats } = {};
    if ('text' in change) clean.text = change.text == null ? null : String(change.text).slice(0, MAX_TEMPLATE_LENGTH + 1);
    if (typeof change.on === 'boolean') clean.on = change.on;
    if (change.chats) {
      const parsed = chatsSchema.safeParse(change.chats);
      if (!parsed.success) return { ok: false, error: 'Notoʻgʻri soʻrov' };
      if (key === 'dailyReport') return { ok: false, error: 'Kechki hisobot faqat sizga keladi' };
      if (parsed.data.staff && !TEMPLATE_BY_KEY[key].staff) return { ok: false, error: 'Bu xabar xodimlarga yuborilmaydi' };
      clean.chats = parsed.data;
    }
    try {
      await saveTemplate(key, clean);
      await audit(ctx, clean.chats ? 'telegram_template_chats' : clean.on === undefined ? 'telegram_template' : clean.on ? 'telegram_template_on' : 'telegram_template_off', { key });
    } catch (e) { return fail(e); }
    revalidatePath(PAGE);
    return { ok: true, message: 'Saqlandi' };
  });
}

/** Namuna: matn namunaviy qiymatlar bilan Ega chatiga, xuddi haqiqiydek. */
export async function testTemplate(key: string, text: string): Promise<ActionResult> {
  return withPermission('messages.manage', async () => {
    if (!isTemplateKey(key)) return { ok: false, error: 'Bunday xabar yoʻq' };
    try {
      const html = renderTemplate(String(text ?? '').slice(0, MAX_TEMPLATE_LENGTH).trim() || TEMPLATE_BY_KEY[key].text, sampleValues(key));
      await sendToOwner(`🧪 Namuna\n\n${html}`, 'test');
    } catch (e) { return fail(e); }
    return { ok: true, message: 'Namuna Telegramingizga yuborildi' };
  });
}

export async function unlinkPerson(userId: string): Promise<ActionResult> {
  return withPermission('messages.manage', async (ctx) => {
    if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: 'Xodim topilmadi' };
    try {
      await getServiceSupabase().from('telegram_people').delete().eq('user_id', userId);
      await audit(ctx, 'telegram_person_unlink', { user: userId });
    } catch (e) { return fail(e); }
    revalidatePath(PAGE);
    return { ok: true, message: 'Uzildi' };
  });
}

export async function syncCustomers(): Promise<ActionResult> {
  return withPermission('messages.manage', async () => {
    try {
      const { added } = await syncSubscribers();
      revalidatePath(PAGE);
      return { ok: true, message: added ? `${added} ta obunachi yangilandi` : 'Yangi obunachi yoʻq' };
    } catch (e) { return fail(e); }
  });
}

// ---------- Xodimning oʻz Telegrami (har qanday xodim) ----------
async function staffOnly<T>(fn: (ctx: StaffContext) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.roles.length) return { ok: false, error: 'Ruxsat yoʻq' };
  try { return await fn(ctx); } catch (e) { return fail(e); }
}

export async function checkMyTelegram(): Promise<ActionResult> {
  return staffOnly(async (ctx) => {
    const config = await getTelegram();
    if (!config?.chatId) return { ok: false, error: 'Telegram bot hali ulanmagan' };
    const code = personCode(config.token, ctx.userId);
    const match = (await recentUpdates(config.token)).reverse().find((u) => u.message?.text?.includes(code) && u.message.chat.type === 'private');
    if (!match?.message) return { ok: false, error: `Botga hali kod kelmadi. @${config.botName} ni ochib, “Start” bosing yoki ${code} deb yozing` };
    const chat = match.message.chat;
    const { error } = await getServiceSupabase().from('telegram_people')
      .upsert({ user_id: ctx.userId, chat_id: chat.id, chat_name: chatTitle(chat), linked_at: new Date().toISOString() });
    if (error) throw error;
    // Bu chat endi xaridor obunachisi emas.
    await getServiceSupabase().from('telegram_subscribers').delete().eq('chat_id', chat.id);
    await tg(config.token, 'sendMessage', { chat_id: chat.id, text: '✅ Doʻkon admin paneli ulandi. Qaysi xabarlar kelishini Ega belgilaydi.' }).catch(() => undefined);
    await audit(ctx, 'telegram_person_link', { chat: chatTitle(chat) });
    revalidatePath('/admin/telegram');
    return { ok: true, message: 'Telegramingiz ulandi' };
  });
}

export async function unlinkMyTelegram(): Promise<ActionResult> {
  return staffOnly(async (ctx) => {
    await getServiceSupabase().from('telegram_people').delete().eq('user_id', ctx.userId);
    await audit(ctx, 'telegram_person_unlink', { user: ctx.userId });
    revalidatePath('/admin/telegram');
    return { ok: true, message: 'Telegram uzildi' };
  });
}

// ---------- Ommaviy xabarlar ----------
/**
 * Saqlash: 'draft' — qoralama, 'schedule' — belgilangan vaqtda, 'now' — darhol (fonda, 60 ms oraliq bilan).
 * id berilsa — faqat qoralama yoki rejalashtirilgan xabar oʻzgaradi.
 */
export async function saveBroadcast(id: number | null, input: BroadcastInput, mode: 'draft' | 'schedule' | 'now'): Promise<ActionResult<{ id: number }>> {
  return withPermission<{ id: number }>('messages.manage', async (ctx) => {
    try {
      const b = parseBroadcast(input);
      if (mode === 'schedule' && (!b.sendAt || Date.parse(b.sendAt) < Date.now() - 60_000)) return { ok: false, error: 'Kelajakdagi vaqtni tanlang' };
      if (mode !== 'draft') {
        if (!(await getTelegram())?.chatId) return { ok: false, error: 'Telegram bot ulanmagan' };
        if (!(await recipients(b.audience)).length) return { ok: false, error: 'Bu xabar hech kimga yetmaydi: hali hech kim Telegramini ulamagan' };
      }
      const row = {
        title: b.title, text: b.text, buttons: b.buttons, audience: b.audience, silent: b.silent,
        send_at: mode === 'schedule' ? b.sendAt : null, status: mode === 'schedule' ? 'scheduled' : 'draft', updated_at: new Date().toISOString(),
      };
      const s = getServiceSupabase();
      let savedId = id;
      if (id) {
        const { data, error } = await s.from('broadcasts').update(row).eq('id', id).in('status', ['draft', 'scheduled']).select('id');
        if (error) throw error;
        if (!data?.length) return { ok: false, error: 'Bu xabar allaqachon yuborilgan' };
      } else {
        const { data, error } = await s.from('broadcasts').insert({ ...row, created_by: ctx.userId }).select('id').single();
        if (error) throw error;
        savedId = data.id as number;
      }
      if (mode === 'now') {
        if (!(await claim(savedId!, ['draft', 'scheduled']))) return { ok: false, error: 'Bu xabar allaqachon yuborilmoqda' };
        after(() => deliver(savedId!));
      }
      await audit(ctx, `broadcast_${mode}`, { id: savedId, audience: b.audience.kind });
      revalidatePath(PAGE);
      return { ok: true, data: { id: savedId! }, message: mode === 'now' ? 'Yuborilmoqda…' : mode === 'schedule' ? 'Rejalashtirildi' : 'Qoralama saqlandi' };
    } catch (e) { return fail(e); }
  });
}

/** Sinov: faqat Eganing oʻziga, xuddi hammaga qanday borsa shunday. */
export async function testBroadcast(input: BroadcastInput): Promise<ActionResult> {
  return withPermission('messages.manage', async () => {
    try {
      const b = parseBroadcast(input);
      const config = await getTelegram();
      if (!config?.chatId) return { ok: false, error: 'Telegram bot ulanmagan' };
      await sendOne(b, config.chatId, '🧪 <i>Sinov</i>\n\n');
    } catch (e) { return fail(e); }
    return { ok: true, message: 'Sinov xabari Telegramingizga yuborildi' };
  });
}

/** Qoralamani oʻchirish yoki rejalashtirilganini bekor qilish (qoralamaga qaytadi). */
export async function removeBroadcast(id: number): Promise<ActionResult> {
  return withPermission('messages.manage', async (ctx) => {
    try {
      const s = getServiceSupabase();
      const { data: row } = await s.from('broadcasts').select('status').eq('id', id).maybeSingle();
      if (!row) return { ok: false, error: 'Topilmadi' };
      if (row.status === 'scheduled') await s.from('broadcasts').update({ status: 'draft', send_at: null }).eq('id', id).eq('status', 'scheduled');
      else if (row.status === 'draft' || row.status === 'failed') await s.from('broadcasts').delete().eq('id', id);
      else return { ok: false, error: 'Yuborilgan xabarni oʻchirib boʻlmaydi' };
      await audit(ctx, row.status === 'scheduled' ? 'broadcast_unschedule' : 'broadcast_delete', { id });
    } catch (e) { return fail(e); }
    revalidatePath(PAGE);
    return { ok: true, message: 'Bajarildi' };
  });
}
