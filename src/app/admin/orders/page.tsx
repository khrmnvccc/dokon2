import Link from 'next/link';
import { Download } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { applyOrderFilters, orderFilterOptions, type OrderFilters } from '@/lib/admin/orders';
import { buildHref, pageParam } from '@/lib/admin/query';
import { formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { ORDER_STATUSES, orderStatusLabel, orderStatusTone, paymentStatusLabel } from '@/lib/order-status';
import { Badge, Pagination } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { PageHeader, FilterBar, FilterField, Table, EmptyRow, inputSm } from '@/components/admin/ui';
import type { Order } from '@/lib/types';

export const metadata = { title: 'Buyurtmalar' };
const PAGE = 30;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<OrderFilters & { page?: string }> }) {
  await requirePagePermission('orders.read');
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await getServerSupabase();
  const query = applyOrderFilters(
    supabase.from('orders').select('id, number, status, payment_status, customer_name, customer_phone, total, items_count, payment_method_name, shipping_method_name, created_at', { count: 'exact' }),
    sp,
  );
  const [{ data, count }, options, { data: counts }] = await Promise.all([
    query.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    orderFilterOptions(supabase),
    supabase.rpc('admin_dashboard'),
  ]);
  const rows = (data ?? []) as Order[];
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][]).toString();

  return (
    <div>
      <PageHeader title="Buyurtmalar" description={`${count ?? 0} ta topildi`}
        actions={<Link prefetch={false} href={`/admin/orders/export?${exportQs}`} className={buttonClass('outline', 'sm')}><Download className="h-4 w-4" /> Excel</Link>} />
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {[null, ...ORDER_STATUSES].map((s) => (
          <Link key={s ?? 'all'} href={buildHref('/admin/orders', sp, { status: s, page: null })}
            className={cn('shrink-0 rounded-full px-3 py-1.5 text-sm font-medium', (sp.status ?? null) === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-line hover:bg-slate-50')}>
            {s ? orderStatusLabel[s] : 'Barchasi'}
            {s === 'new' && (counts as { new_orders?: number } | null)?.new_orders ? <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[11px] text-white">{(counts as { new_orders: number }).new_orders}</span> : null}
          </Link>
        ))}
      </div>
      <FilterBar resetHref="/admin/orders">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <FilterField label="Qidiruv"><input name="q" defaultValue={sp.q} placeholder="№, telefon, ism" className={`${inputSm} w-52`} /></FilterField>
        <FilterField label="Dan"><input type="date" name="from" defaultValue={sp.from} className={inputSm} /></FilterField>
        <FilterField label="Gacha"><input type="date" name="to" defaultValue={sp.to} className={inputSm} /></FilterField>
        <FilterField label="To‘lov">
          <select name="payment" defaultValue={sp.payment ?? ''} className={inputSm}><option value="">Barchasi</option>{options.payments.map((p) => <option key={p}>{p}</option>)}</select>
        </FilterField>
        <FilterField label="Yetkazish">
          <select name="shipping" defaultValue={sp.shipping ?? ''} className={inputSm}><option value="">Barchasi</option>{options.shippings.map((p) => <option key={p}>{p}</option>)}</select>
        </FilterField>
      </FilterBar>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <Table>
          <thead><tr><th>№</th><th>Sana</th><th>Mijoz</th><th className="text-right">Summa</th><th>To‘lov</th><th>Yetkazish</th><th>Holat</th></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow cols={7} />}
            {rows.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand hover:underline">#{o.number}</Link></td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(o.created_at)}</td>
                <td><div className="font-medium">{o.customer_name}</div><div className="text-xs text-muted">{formatUzPhone(o.customer_phone)}</div></td>
                <td className="text-right tabular-nums"><div className="font-semibold">{formatPrice(o.total)}</div><div className="text-xs text-muted">{o.items_count} dona</div></td>
                <td><div>{o.payment_method_name}</div><div className={cn('text-xs', o.payment_status === 'paid' ? 'text-emerald-700' : 'text-muted')}>{paymentStatusLabel[o.payment_status]}</div></td>
                <td className="text-muted">{o.shipping_method_name}</td>
                <td><Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} makeHref={(p) => buildHref('/admin/orders', sp, { page: p })} />
    </div>
  );
}
