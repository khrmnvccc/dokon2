import Link from 'next/link';
import { getStaffContext } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { applyOrderFilters } from '@/lib/admin/orders';
import { likeTerm } from '@/lib/admin/query';
import { formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import { Badge } from '@/components/ui/misc';
import { PageHeader, Panel } from '@/components/admin/ui';
import type { OrderStatus } from '@/lib/types';

export const metadata = { title: 'Qidiruv' };

export default async function AdminSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await getStaffContext();
  if (!ctx) redirect('/admin');
  const q = ((await searchParams).q ?? '').trim().slice(0, 80);
  const supabase = await getServerSupabase();
  const [orders, products, customers] = await Promise.all([
    ctx.permissions.has('orders.read') && q ? applyOrderFilters(supabase.from('orders').select('id, number, status, customer_name, customer_phone, total, created_at'), { q }).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    ctx.permissions.has('products.read') && q ? supabase.from('products').select('id, name, sku, price, stock').or(`name.ilike.${likeTerm(q)},sku.ilike.${likeTerm(q)}`).limit(10) : Promise.resolve({ data: [] }),
    ctx.permissions.has('customers.read') && q ? supabase.rpc('admin_customers', { p_q: q, p_limit: 10, p_offset: 0 }) : Promise.resolve({ data: { items: [] } }),
  ]);
  const custItems = ((customers.data as { items?: { id: string; full_name: string | null; phone: string | null; email: string | null }[] }) ?? {}).items ?? [];
  const empty = !(orders.data ?? []).length && !(products.data ?? []).length && !custItems.length;
  return (
    <div className="max-w-4xl">
      <PageHeader title={`Qidiruv: “${q}”`} />
      {empty && <p className="rounded-xl border border-line bg-white p-10 text-center text-muted">Hech narsa topilmadi</p>}
      <div className="space-y-4">
        {(orders.data ?? []).length > 0 && (
          <Panel title="Buyurtmalar" padded={false}>
            <ul className="divide-y divide-line">
              {(orders.data ?? []).map((o) => (
                <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <span><b>#{o.number}</b> · {o.customer_name} · {formatUzPhone(o.customer_phone)}<span className="block text-xs text-muted">{formatDateTime(o.created_at)}</span></span>
                  <span className="text-right">{formatPrice(o.total)} <Badge tone={orderStatusTone[o.status as OrderStatus]}>{orderStatusLabel[o.status as OrderStatus]}</Badge></span>
                </Link></li>
              ))}
            </ul>
          </Panel>
        )}
        {(products.data ?? []).length > 0 && (
          <Panel title="Mahsulotlar" padded={false}>
            <ul className="divide-y divide-line">
              {(products.data ?? []).map((p) => (
                <li key={p.id}><Link href={`/admin/products/${p.id}`} className="flex justify-between gap-3 px-5 py-3 hover:bg-slate-50"><span>{p.name} <span className="text-xs text-muted">{p.sku}</span></span><span>{formatPrice(p.price)} · {p.stock} dona</span></Link></li>
              ))}
            </ul>
          </Panel>
        )}
        {custItems.length > 0 && (
          <Panel title="Mijozlar" padded={false}>
            <ul className="divide-y divide-line">
              {custItems.map((c) => (
                <li key={c.id}><Link href={`/admin/customers/${c.id}`} className="block px-5 py-3 hover:bg-slate-50">{c.full_name || 'Ismsiz'} <span className="text-sm text-muted">· {formatUzPhone(c.phone)} · {c.email}</span></Link></li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
