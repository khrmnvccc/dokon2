'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';
import { normalizeUzPhone } from '@/lib/phone';
import { ROLE_LABELS } from '@/lib/admin/nav';
import { getTelegram, tg } from '@/lib/telegram/server';
import { getShopBot } from '@/lib/telegram/shop-bot';

export async function setCustomerBlocked(userId: string, blocked: boolean, reason?: string): Promise<ActionResult> {
  return withPermission('customers.block', async (ctx) => {
    const parsed = z.object({ id: z.string().uuid(), reason: z.string().trim().max(300).optional() }).safeParse({ id: userId, reason });
    if (!parsed.success) return { ok: false, error: 'Noto‘g‘ri so‘rov' };
    if (userId === ctx.userId) return { ok: false, error: 'O‘zingizni bloklay olmaysiz' };
    const supabase = await getServerSupabase();
    if (!ctx.permissions.has('staff.manage')) {
      const { count } = await supabase.from('user_roles').select('role', { count: 'exact', head: true }).eq('user_id', userId);
      if (count) return { ok: false, error: 'Xodimni faqat super admin bloklashi mumkin' };
    }
    const { error } = await supabase.from('profiles').update({ is_blocked: blocked, blocked_reason: blocked ? parsed.data.reason || null : null }).eq('id', userId);
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidatePath(`/admin/customers/${userId}`);
    revalidatePath('/admin/customers');
    return { ok: true, message: blocked ? 'Mijoz bloklandi' : 'Blok olib tashlandi' };
  });
}

export async function moderateReview(id: string, action: 'approve' | 'hide' | 'delete'): Promise<ActionResult> {
  return withPermission('reviews.moderate', async () => {
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Noto‘g‘ri so‘rov' };
    const supabase = await getServerSupabase();
    const { error } = action === 'delete'
      ? await supabase.from('reviews').delete().eq('id', id)
      : await supabase.from('reviews').update({ is_approved: action === 'approve' }).eq('id', id);
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidateTag(TAGS.reviews);
    revalidateTag(TAGS.products);
    revalidatePath('/admin/reviews');
    return { ok: true, message: action === 'delete' ? 'Sharh o‘chirildi' : action === 'approve' ? 'Sharh ko‘rsatildi' : 'Sharh yashirildi' };
  });
}

/** Sharhga doʻkon nomidan javob (boʻsh — javobni oʻchirish). Mijozga bildirishnoma boradi. */
export async function replyReview(id: string, reply: string): Promise<ActionResult> {
  return withPermission('reviews.moderate', async () => {
    const parsed = z.object({ id: z.string().uuid(), reply: z.string().trim().max(2000, 'Juda uzun (2000 belgigacha)') }).safeParse({ id, reply });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Noto‘g‘ri so‘rov' };
    const text = parsed.data.reply || null;
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('reviews')
      .update({ reply: text, replied_at: text ? new Date().toISOString() : null })
      .eq('id', parsed.data.id).select('user_id, products(slug, name)').single();
    if (error) return { ok: false, error: dbErrorText(error) };
    const product = (Array.isArray(data.products) ? data.products[0] : data.products) as { slug: string; name: string } | null;
    if (text && data.user_id && product) {
      await getServiceSupabase().from('notifications').insert({
        user_id: data.user_id, type: 'review', title: 'Sharhingizga javob berildi', body: text.slice(0, 200), link: `/product/${product.slug}#reviews`,
      });
    }
    revalidateTag(TAGS.reviews);
    revalidatePath('/admin/reviews');
    if (product) revalidatePath(`/product/${product.slug}`);
    return { ok: true, message: text ? 'Javob saqlandi' : 'Javob oʻchirildi' };
  });
}

const roleSchema = z.object({
  // Mijoz ID (1001), telefon (+998…) yoki email — Telegram orqali kirganlarda haqiqiy email yoʻq
  who: z.string().trim().min(1, 'ID, telefon yoki emailni kiriting').max(200),
  role: z.enum(['super_admin', 'manager', 'operator', 'warehouse']),
  grant: z.boolean(),
});

type FoundUser = { id: string; email: string | null; full_name: string | null; client_no: number | null };

/** Xodimni ID, telefon yoki email boʻyicha topadi. */
async function findPerson(who: string): Promise<FoundUser | { error: string }> {
  const db = getServiceSupabase();
  const q = db.from('profiles').select('id, email, full_name, client_no');
  const raw = who.trim().replace(/^#/, '');
  let res;
  if (raw.includes('@')) res = await q.ilike('email', raw.toLowerCase()).limit(2);
  else if (/^\d{1,7}$/.test(raw)) res = await q.eq('client_no', Number(raw)).limit(2);
  else {
    const digits = raw.replace(/\D/g, '');
    const phone = normalizeUzPhone(digits) ?? (digits.length >= 7 ? `+${digits}` : null);
    if (!phone) return { error: 'ID, telefon yoki email notoʻgʻri' };
    res = await q.eq('phone', phone).limit(2);
  }
  if (res.error) return { error: dbErrorText(res.error) };
  const rows = (res.data ?? []) as FoundUser[];
  if (!rows.length) return { error: 'Bunday foydalanuvchi topilmadi. Xodim avval doʻkon botini ochib, roʻyxatdan oʻtsin, keyin Profil sahifasidagi ID raqamini sizga aytsin' };
  if (rows.length > 1) return { error: 'Bu telefon bir nechta akkauntda bor. ID raqami bilan kiriting' };
  return rows[0];
}

/**
 * Telegram orqali roʻyxatdan oʻtgan xodimning Telegrami admin botga avtomatik ulanadi:
 * shunda u admin botni ochib, menyu tugmasi orqali email/parolsiz kiradi. Doʻkon boti orqali xabar ham boradi.
 */
async function linkStaffTelegram(userId: string, roleText: string) {
  try {
    const db = getServiceSupabase();
    const [{ data: authUser }, { data: sub }, { data: linked }] = await Promise.all([
      db.auth.admin.getUserById(userId),
      db.from('telegram_subscribers').select('chat_id, name').eq('user_id', userId).eq('via', 'shop').limit(1).maybeSingle(),
      db.from('telegram_people').select('chat_id').eq('user_id', userId).maybeSingle(),
    ]);
    const meta = (authUser.user?.user_metadata ?? {}) as { telegram_id?: number; full_name?: string };
    const chatId = Number(sub?.chat_id ?? meta.telegram_id ?? 0);
    if (!chatId) return;
    if (!linked) {
      await db.from('telegram_people').insert({ user_id: userId, chat_id: chatId, chat_name: (sub?.name as string | undefined) ?? meta.full_name ?? null });
    }
    const [admin, shop] = await Promise.all([getTelegram().catch(() => null), getShopBot().catch(() => null)]);
    if (!shop) return;
    const text = admin
      ? `✅ Sizga doʻkonda “${roleText}” roli berildi.\n\nAdmin panelni ochish: @${admin.botName} botini oching, “Start” bosing va pastdagi menyu tugmasini bosing. Email yoki parol kerak emas.`
      : `✅ Sizga doʻkonda “${roleText}” roli berildi.`;
    const extra = admin ? { reply_markup: { inline_keyboard: [[{ text: 'Admin botni ochish', url: `https://t.me/${admin.botName}` }]] } } : {};
    await tg(shop.token, 'sendMessage', { chat_id: chatId, text, ...extra }).catch(() => undefined);
  } catch (e) {
    console.error('staff tg link', e);
  }
}

/** Rol berish/olish. Tekshiruv (staff.manage, oxirgi super admin) bazadagi admin_set_role ichida. */
export async function setStaffRole(input: z.input<typeof roleSchema>): Promise<ActionResult> {
  return withPermission('staff.manage', async (ctx) => {
    const parsed = roleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Noto‘g‘ri so‘rov' };
    const person = await findPerson(parsed.data.who);
    if ('error' in person) return { ok: false, error: person.error };
    if (!person.email) return { ok: false, error: 'Akkauntda email yoʻq' };
    if (!parsed.data.grant && person.id === ctx.userId && parsed.data.role === 'super_admin') {
      return { ok: false, error: 'O‘zingizdan super admin rolini ololmaysiz' };
    }
    const supabase = await getServerSupabase();
    const { error } = await supabase.rpc('admin_set_role', { p_email: person.email, p_role: parsed.data.role, p_grant: parsed.data.grant });
    if (error) return { ok: false, error: dbErrorText(error) };
    if (parsed.data.grant) await linkStaffTelegram(person.id, ROLE_LABELS[parsed.data.role] ?? parsed.data.role);
    revalidatePath('/admin/staff');
    const name = person.full_name || (person.client_no ? `ID ${person.client_no}` : 'Xodim');
    return { ok: true, message: parsed.data.grant ? `${name}ga rol berildi` : 'Rol olib tashlandi' };
  });
}

const accessSchema = z.object({
  userId: z.string().uuid(),
  // null — rol boʻyicha standart ruxsatlar
  perms: z.array(z.string().regex(/^[a-z]+\.[a-z]+$/)).max(60).nullable(),
  // boʻsh — barcha filiallar
  branches: z.array(z.number().int().positive()).max(100),
});

/** Xodimning shaxsiy ruxsatlari va filiallari (kassa 3.2, 3.4). Tekshiruv bazadagi admin_set_staff_access ichida. */
export async function setStaffAccess(input: z.input<typeof accessSchema>): Promise<ActionResult> {
  return withPermission('staff.manage', async (ctx) => {
    const parsed = accessSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Notoʻgʻri soʻrov' };
    if (parsed.data.userId === ctx.userId) return { ok: false, error: 'Oʻz ruxsatlaringizni oʻzgartira olmaysiz' };
    const supabase = await getServerSupabase();
    const { error } = await supabase.rpc('admin_set_staff_access', {
      p_user: parsed.data.userId, p_perms: parsed.data.perms, p_branches: parsed.data.branches,
    });
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidatePath('/admin/staff');
    return { ok: true, message: 'Ruxsatlar saqlandi' };
  });
}
