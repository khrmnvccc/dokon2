import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { likeTerm } from './query';
import { ORDER_STATUSES } from '@/lib/order-status';
import { normalizeUzPhone } from '@/lib/phone';
import type { OrderStatus } from '@/lib/types';

export type OrderFilters = { q?: string; status?: string; from?: string; to?: string; payment?: string; shipping?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Buyurtmalar ro'yxati va eksporti uchun umumiy filtr */
interface FilterChain {
  or(s: string): FilterChain;
  eq(c: string, v: string | number): FilterChain;
  gte(c: string, v: string): FilterChain;
  lt(c: string, v: string): FilterChain;
}

export function applyOrderFilters<Q>(query: Q, f: OrderFilters): Q {
  let q = query as unknown as FilterChain;
  if (f.q) {
    const term = f.q.trim();
    const phone = normalizeUzPhone(term);
    if (/^\d{4,10}$/.test(term) && !phone) q = q.eq('number', Number(term));
    else if (phone) q = q.eq('customer_phone', phone);
    else {
      const t = likeTerm(term);
      q = q.or(`customer_name.ilike.${t},customer_email.ilike.${t},tracking_number.ilike.${t}`);
    }
  }
  if (f.status && ORDER_STATUSES.includes(f.status as OrderStatus)) q = q.eq('status', f.status);
  if (f.from && DATE.test(f.from)) q = q.gte('created_at', `${f.from}T00:00:00+05:00`);
  if (f.to && DATE.test(f.to)) {
    const end = new Date(`${f.to}T00:00:00+05:00`);
    end.setDate(end.getDate() + 1);
    q = q.lt('created_at', end.toISOString());
  }
  if (f.payment) q = q.eq('payment_method_name', f.payment);
  if (f.shipping) q = q.eq('shipping_method_name', f.shipping);
  return q as unknown as Q;
}

export async function orderFilterOptions(supabase: SupabaseClient) {
  const [{ data: pm }, { data: sm }] = await Promise.all([
    supabase.from('payment_methods').select('name').order('sort_order'),
    supabase.from('shipping_methods').select('name').order('sort_order'),
  ]);
  return { payments: (pm ?? []).map((p) => p.name as string), shippings: (sm ?? []).map((s) => s.name as string) };
}
