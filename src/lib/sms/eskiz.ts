import 'server-only';
// Eskiz.uz SMS shlyuzi. Login (email) va parol faqat app_meta 'sms' da (Ega kiritadi), brauzerga qaytmaydi.
// Token 30 kun amal qiladi — 25 kundan keyin yoki 401 boʻlsa qayta olinadi.
import { getServiceSupabase } from '@/lib/supabase/admin';

const API = 'https://notify.eskiz.uz/api';
const META = 'sms';
const db = () => getServiceSupabase();

export interface SmsCreds { email: string; password: string; from: string; token?: string; token_at?: string }
export interface SmsStatus { configured: boolean; email: string; from: string }

export class SmsFail extends Error {}

export async function getSmsCreds(): Promise<SmsCreds | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await db().from('app_meta').select('value').eq('key', META).maybeSingle();
  const v = data?.value as Partial<SmsCreds> | null;
  if (!v?.email || !v.password) return null;
  return { email: String(v.email), password: String(v.password), from: String(v.from || '4546'), token: v.token, token_at: v.token_at };
}

export async function smsStatus(): Promise<SmsStatus> {
  const c = await getSmsCreds();
  if (!c) return { configured: false, email: '', from: '4546' };
  const [user, host] = c.email.split('@');
  return { configured: true, email: `${user.slice(0, 2)}***@${host ?? ''}`, from: c.from };
}

async function saveCreds(c: SmsCreds | null) {
  const { error } = await db().from('app_meta').upsert({ key: META, value: c ?? {}, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function login(c: SmsCreds): Promise<string> {
  const form = new FormData();
  form.set('email', c.email);
  form.set('password', c.password);
  let res: Response;
  try {
    res = await fetch(`${API}/auth/login`, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  } catch {
    throw new SmsFail('Eskiz bilan aloqa boʻlmadi');
  }
  const json = await res.json().catch(() => ({})) as { data?: { token?: string }; message?: string };
  if (!res.ok || !json.data?.token) throw new SmsFail(res.status === 401 ? 'Eskiz login yoki paroli notoʻgʻri' : `Eskiz: ${json.message ?? res.status}`);
  await saveCreds({ ...c, token: json.data.token, token_at: new Date().toISOString() });
  return json.data.token;
}

async function token(c: SmsCreds, fresh = false) {
  if (!fresh && c.token && c.token_at && Date.now() - new Date(c.token_at).getTime() < 25 * 86_400_000) return c.token;
  return login(c);
}

/** Login/parolni saqlash (boʻsh parol — eskisi qoladi) va darhol tekshirish. */
export async function saveSmsCreds(input: { email: string; password: string; from: string }) {
  const old = await getSmsCreds();
  const c: SmsCreds = { email: input.email.trim(), password: input.password || old?.password || '', from: input.from.trim() || '4546' };
  if (!c.email || !c.password) throw new SmsFail('Email va parolni kiriting');
  await login(c);
}

export async function clearSmsCreds() {
  await saveCreds(null);
}

/** Eskiz balansi (tekshirish uchun). */
export async function smsBalance(): Promise<number | null> {
  const c = await getSmsCreds();
  if (!c) return null;
  const call = async (t: string) => fetch(`${API}/user/get-limit`, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
  let res = await call(await token(c)).catch(() => null);
  if (res?.status === 401) res = await call(await token(c, true)).catch(() => null);
  if (!res?.ok) return null;
  const j = await res.json().catch(() => ({})) as { data?: { balance?: number } };
  return typeof j.data?.balance === 'number' ? j.data.balance : null;
}

/** +998901234567 / 998901234567 → 998901234567 (faqat Oʻzbekiston raqamlari). */
export function smsPhone(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  const n = d.length === 9 ? `998${d}` : d;
  return /^998\d{9}$/.test(n) ? n : null;
}

/** Bitta SMS. Natija sms_log ga yoziladi. Xato tashlaydi (sinov uchun), fon chaqiruvlari ushlab oladi. */
export async function sendSms(phone: string, text: string, meta: { event: string; orderId?: string | null }) {
  const c = await getSmsCreds();
  if (!c) throw new SmsFail('Eskiz ulanmagan');
  const to = smsPhone(phone);
  if (!to) throw new SmsFail('Telefon raqami notoʻgʻri');
  const call = async (t: string) => {
    const form = new FormData();
    form.set('mobile_phone', to);
    form.set('message', text);
    form.set('from', c.from);
    return fetch(`${API}/message/sms/send`, { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: form, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  };
  let res: Response | null = null;
  let error: string | null = null;
  let id: string | null = null;
  try {
    res = await call(await token(c));
    if (res.status === 401) res = await call(await token(c, true));
    const j = await res.json().catch(() => ({})) as { id?: string | number; message?: unknown; status?: string };
    if (!res.ok) error = typeof j.message === 'string' ? j.message : `HTTP ${res.status}`;
    else id = j.id !== undefined ? String(j.id) : null;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Yuborib boʻlmadi';
  }
  await db().from('sms_log').insert({
    phone: `+${to.slice(0, 5)}***${to.slice(-2)}`, event: meta.event.slice(0, 40), text: text.slice(0, 1000), order_id: meta.orderId ?? null,
    ok: !error, error: error ? error.slice(0, 500) : null, provider_id: id,
  });
  if (error) throw new SmsFail(/template|shablon|moderat/i.test(error) ? 'Eskiz bu matnni qabul qilmadi: avval shablonni Eskiz kabinetida tasdiqlating' : `Eskiz: ${error}`);
}
