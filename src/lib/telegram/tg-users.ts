import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { normalizeUzPhone } from '@/lib/phone';

// Telegram foydalanuvchisi ↔ doʻkon akkaunti. Mini-ilova (initData) va doʻkon boti (kontakt) shu yerdan foydalanadi.

export interface TgPerson { id: number; first_name?: string; last_name?: string; username?: string }

export const tgEmail = (id: number) => `tg${id}@telegram.user`;
export const tgDisplay = (u: TgPerson) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || 'Telegram foydalanuvchi';
const db = () => getServiceSupabase();

/**
 * Telegram foydalanuvchisining akkaunti: avval bogʻlangan boʻlsa — oʻsha, xodim boʻlsa — xodim akkaunti,
 * saytda kirgan boʻlsa — oʻsha akkaunt (fallbackUserId), aks holda yangi akkaunt ochiladi. Obuna qatori yangilanadi.
 */
export async function ensureShopUser(u: TgPerson, fallbackUserId: string | null = null): Promise<string | null> {
  const service = db();
  const [{ data: sub }, { data: person }] = await Promise.all([
    service.from('telegram_subscribers').select('user_id').eq('chat_id', u.id).maybeSingle(),
    service.from('telegram_people').select('user_id').eq('chat_id', u.id).maybeSingle(),
  ]);
  let userId: string | null = (sub?.user_id as string | null) ?? (person?.user_id as string | undefined) ?? fallbackUserId;
  if (!userId) {
    const email = tgEmail(u.id);
    const created = await service.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { full_name: tgDisplay(u), telegram_id: u.id, telegram_username: u.username ?? null },
    });
    if (created.data.user) userId = created.data.user.id;
    else {
      const { data: p } = await service.from('profiles').select('id').eq('email', email).maybeSingle();
      userId = (p?.id as string | undefined) ?? null;
    }
    if (!userId) return null;
  }
  const row: Record<string, unknown> = { chat_id: u.id, user_id: userId, name: tgDisplay(u), username: u.username ?? null, via: 'shop', last_seen: new Date().toISOString() };
  if (!sub) row.subscribed = true;
  const { error } = await service.from('telegram_subscribers').upsert(row, { onConflict: 'chat_id' });
  if (error) console.error('tg subscriber', error.message);
  return userId;
}

export async function profileOf(userId: string) {
  const { data } = await db().from('profiles').select('full_name, phone, client_no, is_blocked, email').eq('id', userId).maybeSingle();
  return data as { full_name: string | null; phone: string | null; client_no: number | null; is_blocked: boolean; email: string | null } | null;
}

/** Telegram yuborgan raqamni saqlaydi (+998… koʻrinishida; chet el raqami boʻlsa + bilan oʻzicha). */
export async function savePhone(userId: string, raw: string, name?: string) {
  const digits = raw.replace(/\D/g, '');
  const phone = normalizeUzPhone(digits) ?? (digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null);
  if (!phone) return null;
  const current = await profileOf(userId);
  const patch: Record<string, string> = { phone };
  if (!current?.full_name && name) patch.full_name = name.slice(0, 120);
  const { error } = await db().from('profiles').update(patch).eq('id', userId);
  if (error) { console.error('tg phone', error.message); return null; }
  return phone;
}
