import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatDateTime, formatNumber, formatPrice } from '@/lib/format';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import { Badge } from '@/components/ui/misc';
import { PageHeader, Panel, StatCard, Table, EmptyRow } from '@/components/admin/ui';
import { BarChart } from '@/components/admin/charts';
import type { OrderStatus } from '@/lib/types';

interface Dashboard {
  today_sales: number; today_orders: number; total_sales: number; orders_count: number; new_orders: number;
  pending_orders: number; cancelled_orders: number; products_count: number; active_products: number; low_stock: number;
  customers_count: number;
  sales_by_day: { date: string; revenue: number; orders: number }[];
  top_products: { product_id: string; name: string; quantity: number; revenue: number }[];
  recent_orders: { id: string; number: number; customer_name: string; total: number; status: OrderStatus; created_at: string }[];
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requirePagePermission('dashboard.view');
  const { denied } = await searchParams;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('admin_dashboard');
  const d = data as Dashboard | null;
  const p = (v: number) => formatPrice(v);

  return (
    <div>
      <PageHeader title="Dashboard" description="Bugungi holat va oxirgi 30 kunlik ko‘rsatkichlar" />
      {denied && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Sizda bu bo‘limga kirish huquqi yo‘q.</p>}
      {error || !d ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Ma’lumotlarni yuklab bo‘lmadi.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Bugungi savdo" value={p(d.today_sales)} hint={`${d.today_orders} ta buyurtma`} />
            <StatCard label="Yangi buyurtmalar" value={formatNumber(d.new_orders)} hint={`Jarayonda: ${d.pending_orders}`} tone={d.new_orders > 0 ? 'warn' : undefined} />
            <StatCard label="Jami savdo" value={p(d.total_sales)} hint={`${formatNumber(d.orders_count)} ta buyurtma, bekor: ${d.cancelled_orders}`} />
            <StatCard label="Mijozlar" value={formatNumber(d.customers_count)} hint={`Mahsulotlar: ${d.active_products} / ${d.products_count}`} />
          </div>
          {d.low_stock > 0 && (
            <Link href="/admin/inventory?low=1" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100">
              <AlertTriangle className="h-4 w-4" /> {d.low_stock} ta mahsulot qoldig‘i kam — ko‘rish →
            </Link>
          )}
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Savdo, oxirgi 30 kun (so‘m)" className="xl:col-span-2">
              <BarChart
                valueLabel="Savdo"
                data={d.sales_by_day.map((s) => ({
                  label: new Date(s.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' }),
                  value: Number(s.revenue),
                  sub: `${s.orders} ta buyurtma`,
                }))}
                formatValue={(v) => p(v)}
              />
            </Panel>
            <Panel title="Top mahsulotlar (30 kun)">
              {d.top_products.length === 0 ? <p className="py-8 text-center text-sm text-muted">Hali savdo yo‘q</p> : (
                <ol className="space-y-3">
                  {d.top_products.map((t, i) => (
                    <li key={t.product_id ?? i} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      <span className="shrink-0 text-right tabular-nums"><b>{t.quantity}</b> <span className="text-muted">dona</span></span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
          {ctx.permissions.has('orders.read') && (
            <Panel title="Oxirgi buyurtmalar" padded={false} actions={<Link href="/admin/orders" className="text-sm font-medium text-brand">Barchasi →</Link>}>
              <Table>
                <thead><tr><th>№</th><th>Mijoz</th><th>Summa</th><th>Holat</th><th>Sana</th></tr></thead>
                <tbody>
                  {d.recent_orders.length === 0 && <EmptyRow cols={5} text="Hali buyurtma yo‘q" />}
                  {d.recent_orders.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand">#{o.number}</Link></td>
                      <td>{o.customer_name}</td>
                      <td className="tabular-nums">{p(o.total)}</td>
                      <td><Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></td>
                      <td className="text-muted">{formatDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
