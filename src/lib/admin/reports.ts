import 'server-only';
import { getServerSupabase } from '@/lib/supabase/server';

export interface SalesRow { period: string; orders_count: number; items_sold: number; revenue: number; goods_revenue: number; discounts: number; shipping: number; cost_known: number; gross_profit: number; cancelled_count: number; returned_count: number }
export interface ProductRow { product_id: string | null; product_name: string; sku: string | null; quantity: number; revenue: number; cost: number | null; gross_profit: number | null }

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function reportRange(sp: { from?: string; to?: string; g?: string; preset?: string }) {
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const shift = (days: number) => new Date(Date.parse(today) - days * 86400_000).toISOString().slice(0, 10);
  let from = sp.from && DATE.test(sp.from) ? sp.from : shift(29);
  let to = sp.to && DATE.test(sp.to) ? sp.to : today;
  if (sp.preset === 'today') from = to = today;
  if (sp.preset === '7') { from = shift(6); to = today; }
  if (sp.preset === '30') { from = shift(29); to = today; }
  if (sp.preset === 'month') { from = `${today.slice(0, 7)}-01`; to = today; }
  if (sp.preset === 'year') { from = `${today.slice(0, 4)}-01-01`; to = today; }
  if (from > to) [from, to] = [to, from];
  const g = sp.g === 'week' || sp.g === 'month' ? sp.g : 'day';
  return { from, to, g: g as 'day' | 'week' | 'month' };
}

export async function loadReports(from: string, to: string, g: 'day' | 'week' | 'month') {
  const supabase = await getServerSupabase();
  const [sales, products, statuses] = await Promise.all([
    supabase.rpc('report_sales', { p_from: from, p_to: to, p_granularity: g }),
    supabase.rpc('report_products', { p_from: from, p_to: to }),
    supabase.rpc('report_status_breakdown', { p_from: from, p_to: to }),
  ]);
  return {
    error: sales.error ?? products.error ?? statuses.error,
    sales: (sales.data ?? []) as SalesRow[],
    products: (products.data ?? []) as ProductRow[],
    statuses: (statuses.data ?? []) as { status: string; orders_count: number; amount: number }[],
  };
}
