'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { withPermission } from '@/lib/admin/action';
import type { StaffContext } from '@/lib/auth';
import { referralSettingsSchema } from '@/lib/referral';
import { saveReferralSettings } from '@/lib/referral-server';
import { sendPersonalCoupon } from '@/lib/telegram/shop-bot';
import type { ActionResult } from '@/lib/types';

// Marketing → Hamkorlar: doʻst taklifi qoidalari, hamkorlar, toʻlovlar va shaxsiy kuponlar.
// Ruxsat har amalda tekshiriladi (partners.manage); yozish service role bilan, hammasi audit jurnaliga.

const PERM = 'partners.manage';
const db = () => getServiceSupabase();
const uuid = z.string().uuid();
const clientNo = z.coerce.number().int().positive().max(999_999_999_999);

function needService(): ActionResult | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? null : { ok: false, error: 'Serverda SUPABASE_SERVICE_ROLE_KEY sozlanmagan' };
}

async function audit(ctx: StaffContext, action: string, data: Record<string, unknown> = {}) {
  await db().from('audit_logs')
    .insert({ actor_id: ctx.userId, actor_email: ctx.email, action, entity: 'marketing', new_data: data })
    .then(({ error }) => error && console.error('audit', error.message));
}

const refresh = () => {
  revalidatePath('/admin/partners', 'layout');
  revalidatePath('/admin/referral-stats');
  revalidatePath('/admin/coupons/issued');
};

async function userByNo(no: number) {
  const { data } = await db().from('profiles').select('id, full_name, client_no, is_blocked').eq('client_no', no).maybeSingle();
  return data as { id: string; full_name: string | null; client_no: number; is_blocked: boolean } | null;
}

/** Qoidalar: bosqichlar, sovgʻa kupon, hamkor foizi va boshqalar. */
export async function saveReferralRules(input: unknown): Promise<ActionResult> {
  return withPermission(PERM, async (ctx) => {
    const svc = needService(); if (svc) return svc;
    const parsed = referralSettingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Maʼlumotlar notoʻgʻri' };
    try {
      await saveReferralSettings(parsed.data);
    } catch (e) {
      console.error('referral rules', e);
      return { ok: false, error: 'Saqlab boʻlmadi' };
    }
    await audit(ctx, 'referral_rules', { enabled: parsed.data.enabled, steps: parsed.data.steps.length, partner: parsed.data.partner });
    refresh();
    return { ok: true, message: 'Qoidalar saqlandi' };
  });
}

/** Hamkorlik arizasi: qabul (foiz bilan) yoki rad. */
export async function decideApplication(userId: string, approve: boolean, percent?: number): Promise<ActionResult> {
  return withPermission(PERM, async (ctx) => {
    const svc = needService(); if (svc) return svc;
    if (!uuid.safeParse(userId).success) return { ok: false, error: 'Topilmadi' };
    const patch: Record<string, unknown> = { status: approve ? 'active' : 'rejected', decided_at: new Date().toISOString(), decided_by: ctx.userId, updated_at: new Date().toISOString() };
    if (approve && percent !== undefined) {
      const p = z.coerce.number().min(0).max(50).safeParse(percent);
      if (!p.success) return { ok: false, error: 'Foiz 0–50 oraligʻida boʻlsin' };
      patch.commission_percent = p.data;
    }
    const { data, error } = await db().from('partners').update(patch).eq('user_id', userId).eq('status', 'pending').select('user_id');
    if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
    if (!data?.length) return { ok: false, error: 'Ariza allaqachon koʻrib chiqilgan' };
    await db().from('notifications').insert({
      user_id: userId, type: 'partner', title: approve ? 'Siz hamkor boʻldingiz!' : 'Hamkorlik arizasi rad etildi',
      body: approve ? 'Endi doʻstlaringiz buyurtmalaridan foiz olasiz' : null, link: '/account/referral',
    });
    await audit(ctx, approve ? 'partner_approve' : 'partner_reject', { user_id: userId, percent });
    refresh();
    return { ok: true, message: approve ? 'Hamkor qabul qilindi' : 'Ariza rad etildi' };
  });
}

/** Hamkor foizini oʻzgartirish, muzlatish yoki qayta yoqish. */
export async function updatePartner(userId: string, patch: { percent?: number; status?: 'active' | 'frozen' }): Promise<ActionResult> {
  return withPermission(PERM, async (ctx) => {
    const svc = needService(); if (svc) return svc;
    if (!uuid.safeParse(userId).success) return { ok: false, error: 'Topilmadi' };
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.percent !== undefined) {
      const p = z.coerce.number().min(0).max(50).safeParse(patch.percent);
      if (!p.success) return { ok: false, error: 'Foiz 0–50 oraligʻida boʻlsin' };
      row.commission_percent = p.data;
    }
    if (patch.status) {
      if (!['active', 'frozen'].includes(patch.status)) return { ok: false, error: 'Notoʻgʻri holat' };
      row.status = patch.status;
      row.decided_at = new Date().toISOString();
      row.decided_by = ctx.userId;
    }
    const { data, error } = await db().from('partners').update(row).eq('user_id', userId).in('status', ['active', 'frozen']).select('user_id');
    if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
    if (!data?.length) return { ok: false, error: 'Hamkor topilmadi' };
    await audit(ctx, 'partner_update', { user_id: userId, ...patch });
    refresh();
    return { ok: true, message: 'Saqlandi' };
  });
}

/** Istalgan mijozni qoʻlda hamkor qilish (masalan, blogger). */
export async function addPartner(no: number, percent: number): Promise<ActionResult> {
  return withPermission(PERM, async (ctx) => {
    const svc = needService(); if (svc) return svc;
    const n = clientNo.safeParse(no);
    const p = z.coerce.number().min(0).max(50).safeParse(percent);
    if (!n.success) return { ok: false, error: 'Mijoz ID raqamini yozing' };
    if (!p.success) return { ok: false, error: 'Foiz 0–50 oraligʻida boʻlsin' };
    const u = await userByNo(n.data);
    if (!u) return { ok: false, error: `ID ${n.data} boʻlgan mijoz topilmadi` };
    if (u.is_blocked) return { ok: false, error: 'Mijoz bloklangan' };
    const now = new Date().toISOString();
    const { error } = await db().from('partners').upsert({
      user_id: u.id, status: 'active', commission_percent: p.data, decided_at: now, decided_by: ctx.userId, updated_at: now,
    }, { onConflict: 'user_id' });
    if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
    await audit(ctx, 'partner_add', { client_no: n.data, percent: p.data });
    refresh();
    return { ok: true, message: `${u.full_name ?? 'Mijoz'} hamkor qilindi` };
  });
}

/** Pul yechish soʻrovi: toʻlandi yoki rad etildi. */
export async function decidePayout(id: string, status: 'paid' | 'rejected', note?: string): Promise<ActionResult> {
  return withPermission(PERM, async (ctx) => {
    const svc = needService(); if (svc) return svc;
    if (!uuid.safeParse(id).success || !['paid', 'rejected'].includes(status)) return { ok: false, error: 'Topilmadi' };
    const { data, error } = await db().from('partner_payouts')
      .update({ status, note: note?.trim().slice(0, 500) || null, decided_at: new Date().toISOString(), decided_by: ctx.userId })
      .eq('id', id).eq('status', 'requested').select('partner_id, amount');
    if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
    if (!data?.length) return { ok: false, error: 'Soʻrov allaqachon koʻrib chiqilgan' };
    await db().from('notifications').insert({
      user_id: data[0].partner_id, type: 'payout',
      title: status === 'paid' ? `Toʻlov oʻtkazildi: ${Number(data[0].amount).toLocaleString('ru-RU')} soʻm` : 'Pul yechish soʻrovi rad etildi',
      body: note?.trim() || null, link: '/account/referral',
    });
    await audit(ctx, status === 'paid' ? 'payout_paid' : 'payout_reject', { id, amount: data[0].amount });
    refresh();
    return { ok: true, message: status === 'paid' ? 'Toʻlandi deb belgilandi' : 'Rad etildi' };
  });
}

/** Hamkorga qoʻlda toʻlov qayd qilish (naqd yoki kartaga oʻtkazilgan). Mavjud balansdan oshmaydi. */
export async function recordPayout(userId: string, amount: number, note?: string): Promise<ActionResult> {
  return withPermission(PERM, async (ctx) => {
    const svc = needService(); if (svc) return svc;
    const a = z.coerce.number().int().positive().max(1_000_000_000).safeParse(amount);
    if (!uuid.safeParse(userId).success) return { ok: false, error: 'Hamkorni tanlang' };
    if (!a.success) return { ok: false, error: 'Summani yozing' };
    const { data: bal } = await db().rpc('_partner_balance', { p_partner: userId });
    const b = (bal ?? {}) as Record<string, number>;
    const free = Number(b.available_total ?? 0) - Number(b.paid ?? 0) - Number(b.requested ?? 0);
    if (a.data > free) return { ok: false, error: `Mavjud balans: ${Math.max(free, 0).toLocaleString('ru-RU')} soʻm` };
    const now = new Date().toISOString();
    const { error } = await db().from('partner_payouts').insert({
      partner_id: userId, amount: a.data, status: 'paid', note: note?.trim().slice(0, 500) || 'Qoʻlda qayd qilindi',
      requested_at: now, decided_at: now, decided_by: ctx.userId,
    });
    if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
    await audit(ctx, 'payout_record', { user_id: userId, amount: a.data });
    refresh();
    return { ok: true, message: 'Toʻlov qayd qilindi' };
  });
}

/** Qoʻlda bogʻlash: “bu mijozni falonchi olib kelgan”. Sovgʻa kupon berilmaydi. */
export async function linkReferral(friendNo: number, referrerNo: number): Promise<ActionResult> {
  return withPermission(PERM, async (ctx) => {
    const svc = needService(); if (svc) return svc;
    const f = clientNo.safeParse(friendNo);
    const r = clientNo.safeParse(referrerNo);
    if (!f.success || !r.success) return { ok: false, error: 'Ikkala ID raqamini yozing' };
    if (f.data === r.data) return { ok: false, error: 'Mijoz oʻzini taklif qila olmaydi' };
    const [friend, ref] = await Promise.all([userByNo(f.data), userByNo(r.data)]);
    if (!friend) return { ok: false, error: `ID ${f.data} topilmadi` };
    if (!ref) return { ok: false, error: `ID ${r.data} topilmadi` };
    const { data: existing } = await db().from('referrals').select('friend_id').eq('friend_id', friend.id).maybeSingle();
    if (existing) return { ok: false, error: 'Bu mijoz allaqachon kimgadir bogʻlangan' };
    const { data: cycle } = await db().from('referrals').select('friend_id').eq('friend_id', ref.id).eq('referrer_id', friend.id).maybeSingle();
    if (cycle) return { ok: false, error: 'Aylanma bogʻlash mumkin emas (ular bir-birini taklif qilgan boʻlib qoladi)' };
    const { count } = await db().from('orders').select('id', { count: 'exact', head: true }).eq('user_id', friend.id);
    const { error } = await db().from('referrals').insert({
      friend_id: friend.id, referrer_id: ref.id, source: 'admin', status: (count ?? 0) > 0 ? 'ordered' : 'joined',
    });
    if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
    await db().from('profiles').update({ referred_by: ref.id }).eq('id', friend.id);
    await audit(ctx, 'referral_link', { friend: f.data, referrer: r.data });
    refresh();
    return { ok: true, message: 'Bogʻlandi. Mukofot keyingi yetkazilgan buyurtmadan hisoblanadi' };
  });
}

/** Bogʻlanishni olib tashlash (shart hali bajarilmagan boʻlsa). */
export async function unlinkReferral(friendId: string): Promise<ActionResult> {
  return withPermission(PERM, async (ctx) => {
    const svc = needService(); if (svc) return svc;
    if (!uuid.safeParse(friendId).success) return { ok: false, error: 'Topilmadi' };
    const { data, error } = await db().from('referrals').delete().eq('friend_id', friendId).neq('status', 'qualified').select('referrer_id');
    if (error) return { ok: false, error: 'Oʻchirib boʻlmadi' };
    if (!data?.length) return { ok: false, error: 'Shart bajarilgan taklifni olib tashlab boʻlmaydi' };
    await db().from('profiles').update({ referred_by: null }).eq('id', friendId);
    await audit(ctx, 'referral_unlink', { friend_id: friendId });
    refresh();
    return { ok: true, message: 'Bogʻlanish olib tashlandi' };
  });
}

const giftSchema = z.object({
  clientNo,
  amount: z.coerce.number().int().min(1000, 'Kamida 1 000 soʻm').max(100_000_000),
  minOrder: z.coerce.number().int().min(0).max(1_000_000_000),
  days: z.coerce.number().int().min(1).max(365),
  note: z.string().trim().max(120).optional(),
  send: z.boolean().optional(),
});

/** Bitta mijozga shaxsiy kupon berish (faqat u ishlata oladi), xohlasa botda yuboriladi. */
export async function givePersonalCoupon(input: unknown): Promise<ActionResult> {
  return withPermission('coupons.write', async (ctx) => {
    const svc = needService(); if (svc) return svc;
    const parsed = giftSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Maʼlumotlar notoʻgʻri' };
    const d = parsed.data;
    const u = await userByNo(d.clientNo);
    if (!u) return { ok: false, error: `ID ${d.clientNo} boʻlgan mijoz topilmadi` };
    const { data: id, error } = await db().rpc('_issue_personal_coupon', {
      p_owner: u.id, p_amount: d.amount, p_min_order: d.minOrder, p_days: d.days, p_source: 'gift',
      p_description: d.note || 'Sovgʻa kupon', p_issued_by: ctx.userId,
    });
    if (error || !id) { console.error('gift coupon', error?.message); return { ok: false, error: 'Kupon yaratib boʻlmadi' }; }
    await db().from('notifications').insert({ user_id: u.id, type: 'coupon', title: 'Sizga sovgʻa kupon berildi', body: d.note || null, link: '/account/referral' });
    let sent = false;
    if (d.send) { try { sent = await sendPersonalCoupon(String(id), u.id); } catch (e) { console.error('gift send', e); } }
    await audit(ctx, 'coupon_gift', { client_no: d.clientNo, amount: d.amount, sent });
    refresh();
    return { ok: true, message: d.send ? (sent ? 'Kupon berildi va botda yuborildi' : 'Kupon berildi (mijoz botga ulanmagan — kabinetida koʻradi)') : 'Kupon berildi' };
  });
}

/** Shaxsiy kuponni bekor qilish (ishlatilmagan boʻlsa). */
export async function revokePersonalCoupon(id: string): Promise<ActionResult> {
  return withPermission('coupons.write', async (ctx) => {
    const svc = needService(); if (svc) return svc;
    if (!uuid.safeParse(id).success) return { ok: false, error: 'Topilmadi' };
    const { data, error } = await db().from('coupons').update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id).not('owner_id', 'is', null).eq('used_count', 0).select('code');
    if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
    if (!data?.length) return { ok: false, error: 'Ishlatilgan kuponni bekor qilib boʻlmaydi' };
    await audit(ctx, 'coupon_revoke', { code: data[0].code });
    refresh();
    return { ok: true, message: 'Kupon bekor qilindi' };
  });
}
