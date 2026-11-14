import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';

// Hamkorlar boʻlimi sahifalari uchun umumiy oʻqishlar (ruxsat sahifada tekshiriladi, service role bilan).

export const hasService = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Tablardagi “kutilmoqda” raqamlari: arizalar va pul yechish soʻrovlari. */
export async function partnerTabCounts() {
  if (!hasService()) return {};
  const db = getServiceSupabase();
  const [{ count: applications }, { count: payouts }] = await Promise.all([
    db.from('partners').select('user_id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('partner_payouts').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
  ]);
  return { applications: applications ?? 0, payouts: payouts ?? 0 };
}

export interface ProfileLite { id: string; client_no: number | null; full_name: string | null; phone: string | null }

/** id → profil (bir soʻrovda). */
export async function profilesById(ids: string[]): Promise<Map<string, ProfileLite>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length || !hasService()) return new Map();
  const out = new Map<string, ProfileLite>();
  for (let i = 0; i < uniq.length; i += 300) {
    const { data } = await getServiceSupabase().from('profiles').select('id, client_no, full_name, phone').in('id', uniq.slice(i, i + 300));
    for (const p of (data ?? []) as ProfileLite[]) out.set(p.id, p);
  }
  return out;
}

export const personLabel = (p: ProfileLite | undefined) => (p ? `${p.client_no ?? '—'} · ${p.full_name || p.phone || 'Mijoz'}` : '—');

export interface Balance { user_id: string; status: string; percent: number; earned: number; holding: number; available: number; paid: number; requested: number; free: number; debt: number }

/** Har bir hamkorning balansi (komissiya, tekshiruvda, toʻlangan, soʻralgan). */
export async function partnerBalances(): Promise<Balance[]> {
  if (!hasService()) return [];
  const db = getServiceSupabase();
  const [{ data: partners }, { data: earnings }, { data: payouts }] = await Promise.all([
    db.from('partners').select('user_id, status, commission_percent').in('status', ['active', 'frozen']).limit(2000),
    db.from('partner_earnings').select('partner_id, amount, available_at').eq('status', 'active').limit(50_000),
    db.from('partner_payouts').select('partner_id, amount, status').in('status', ['paid', 'requested']).limit(50_000),
  ]);
  const now = Date.now();
  const map = new Map<string, Balance>();
  for (const p of partners ?? []) {
    map.set(String(p.user_id), { user_id: String(p.user_id), status: String(p.status), percent: Number(p.commission_percent), earned: 0, holding: 0, available: 0, paid: 0, requested: 0, free: 0, debt: 0 });
  }
  for (const e of earnings ?? []) {
    const b = map.get(String(e.partner_id));
    if (!b) continue;
    b.earned += Number(e.amount);
    if (new Date(String(e.available_at)).getTime() > now) b.holding += Number(e.amount); else b.available += Number(e.amount);
  }
  for (const x of payouts ?? []) {
    const b = map.get(String(x.partner_id));
    if (!b) continue;
    if (x.status === 'paid') b.paid += Number(x.amount); else b.requested += Number(x.amount);
  }
  for (const b of map.values()) {
    b.debt = Math.max(b.available - b.paid, 0);
    b.free = Math.max(b.available - b.paid - b.requested, 0);
  }
  return [...map.values()].sort((a, b) => b.earned - a.earned);
}
