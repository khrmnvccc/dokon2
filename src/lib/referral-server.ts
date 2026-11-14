import 'server-only';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { cleanReferralSettings, parseRefCode, REF_COOKIE, type ReferralSettings } from '@/lib/referral';

const META_KEY = 'referral';
const hasService = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function getReferralSettings(): Promise<ReferralSettings> {
  if (!hasService()) return cleanReferralSettings(null);
  const { data } = await getServiceSupabase().from('app_meta').select('value').eq('key', META_KEY).maybeSingle();
  return cleanReferralSettings(data?.value);
}

export async function saveReferralSettings(value: ReferralSettings) {
  const { error } = await getServiceSupabase().from('app_meta')
    .upsert({ key: META_KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

export interface AttachResult { ok: boolean; reason?: string; referrer_id?: string; welcome_coupon_id?: string | null }

/**
 * Yangi mijozni taklif qilgan odamga bogʻlaydi. Barcha shartlar bazada tekshiriladi
 * (faqat yangi mijoz, oʻzini emas, bir marta). Xato boʻlsa jim qaytadi — xarid toʻxtamaydi.
 */
export async function attachReferral(friendId: string, refNo: number | null, source: 'bot' | 'link' | 'webapp' | 'admin'): Promise<AttachResult> {
  if (!refNo || !hasService()) return { ok: false, reason: 'none' };
  try {
    const { data, error } = await getServiceSupabase().rpc('referral_attach', { p_friend: friendId, p_ref_no: refNo, p_source: source });
    if (error) { console.error('referral attach', error.message); return { ok: false, reason: 'error' }; }
    return (data ?? { ok: false }) as AttachResult;
  } catch (e) {
    console.error('referral attach', e);
    return { ok: false, reason: 'error' };
  }
}

/** Saytdagi /r/<ID> havolasidan qolgan cookie boʻyicha bogʻlaydi (roʻyxatdan oʻtish va birinchi buyurtmada). */
export async function attachFromCookie(friendId: string): Promise<AttachResult | null> {
  const jar = await cookies();
  const refNo = parseRefCode(jar.get(REF_COOKIE)?.value);
  if (!refNo) return null;
  const res = await attachReferral(friendId, refNo, 'link');
  // Natija qanday boʻlmasin, cookie bir martalik
  try { jar.delete(REF_COOKIE); } catch { /* server komponentida oʻchirib boʻlmaydi */ }
  return res;
}

/** Havola ochildi (sayt yoki bot): taklif qilgan mijoz hisobiga yoziladi — Foydalanish statistikasi uchun. */
export async function trackRefOpen(refNo: number | null) {
  if (!refNo || !hasService()) return;
  try {
    const db = getServiceSupabase();
    const { data: p } = await db.from('profiles').select('id').eq('client_no', refNo).maybeSingle();
    if (p?.id) await db.from('referral_events').insert({ user_id: p.id, kind: 'open' });
  } catch (e) {
    console.error('referral open', e);
  }
}
