import Link from 'next/link';
import { formatDateTime, formatNumber, formatPrice } from '@/lib/format';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import { STATUS_COLOR, paymentTone, toneColor } from '@/lib/order-colors';
import { Badge } from '@/components/ui/misc';
import { Avatar } from '@/components/ui/kit';
import { Capsule } from '@/components/ui/capsule';
import { Panel, StatCard, Table, EmptyRow } from '@/components/admin/ui';
import { BarChart } from '@/components/admin/charts';
import type { OrderStatus } from '@/lib/types';

export interface Dashboard {
  today_sales: number; yesterday_sales: number; today_orders: number; yesterday_orders: number; new_orders: number;
  undelivered: number; low_stock: number; month_sales: number;
  sales_by_day: { date: string; revenue: number; orders: number }[];
  by_payment: { name: string; kind: string; provider: string | null; total: number }[];
  by_status: { status: OrderStatus; count: number }[];
  recent_orders: { id: string; number: number; customer_name: string; total: number; status: OrderStatus; payment_method_name: string; created_at: string }[];
  staff_rating: { name: string; actions: number }[];
}

/** Dashboard koʻrinishi (kassa 1.10): maʼlumot sahifada olinadi, bu yerda faqat chiziladi. */
export function DashboardView({ d, perms }: { d: Dashboard; perms: string[] }) {
  const p = (v: number) => formatPrice(v);
  const can = (perm: string) => perms.includes(perm);
  return (
        <div className="space-y-4">
      {/* Jonli lenta: hech narsa o'zi aylanmaydi; ruxsati yo'q karta umuman chiqmaydi */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Bugungi savdo" accent="var(--cash)" value={Number(d.today_sales)} previous={Number(d.yesterday_sales)} format="money" hint="kechagiga nisbatan" href={can('reports.view') ? '/admin/reports' : undefined} />
        {can('orders.read') && <StatCard label="Buyurtmalar (bugun)" accent="var(--card)" value={Number(d.today_orders)} previous={Number(d.yesterday_orders)} href="/admin/orders" />}
        {can('orders.read') && <StatCard label="Yangi buyurtmalar" accent="var(--yandex)" value={Number(d.new_orders)} tone={d.new_orders > 0 ? 'warn' : undefined} hint="tasdiqlash kutilmoqda" href="/admin/orders?status=new" />}
        {can('orders.read') && <StatCard label="Yetkazilmagan" accent="var(--pochta)" value={Number(d.undelivered)} hint="tasdiqlangan, yigʻilmoqda, yoʻlda" href="/admin/orders?status=shipped" />}
        {can('products.read') && <StatCard label="Kam qolgan mahsulotlar" accent="var(--danger)" value={Number(d.low_stock)} tone={d.low_stock > 0 ? 'bad' : undefined} hint="qoldiq chegaradan past" href={can('inventory.write') ? '/admin/inventory?low=1' : '/admin/products'} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Savdo, oxirgi 14 kun" subtitle={`Shu oy: ${p(Number(d.month_sales))}`} className="xl:col-span-2">
          <BarChart
            valueLabel="Savdo"
            data={d.sales_by_day.map((s) => ({
              label: `${s.date.slice(8, 10)}.${s.date.slice(5, 7)}`,
              value: Number(s.revenue),
              sub: `${s.orders} ta buyurtma`,
            }))}
            formatValue="money"
          />
        </Panel>
        <Panel title="Toʻlov turlari ulushi" subtitle="Oxirgi 30 kun">
          {d.by_payment.length === 0 ? <p className="py-8 text-center text-[13px] text-ink-3">Hali savdo yoʻq</p> : (
            <Capsule parts={d.by_payment.map((m) => ({ label: m.name, value: Number(m.total), color: toneColor(paymentTone(m)), display: p(Number(m.total)) }))} />
          )}
          {d.by_status.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-[13px] font-medium text-ink-2">Buyurtma holatlari</h3>
              <Capsule parts={d.by_status.map((s) => ({ label: orderStatusLabel[s.status], value: Number(s.count), color: STATUS_COLOR[s.status], display: `${formatNumber(s.count)} ta` }))} />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {can('orders.read') && (
          <Panel title="Oxirgi buyurtmalar" padded={false} className="xl:col-span-2" actions={<Link href="/admin/orders" className="text-sm font-medium text-primary">Barchasi →</Link>}>
            <Table>
              <thead><tr><th>№</th><th>Mijoz</th><th className="text-right">Summa</th><th>Holat</th><th className="max-sm:hidden">Sana</th></tr></thead>
              <tbody>
                {d.recent_orders.length === 0 && <EmptyRow cols={5} text="Hali buyurtma yoʻq" />}
                {d.recent_orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-primary num">#{o.number}</Link></td>
                    <td>{o.customer_name}<div className="text-xs text-ink-3">{o.payment_method_name}</div></td>
                    <td className="text-right num">{p(o.total)}</td>
                    <td><Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></td>
                    <td className="text-ink-3 num max-sm:hidden">{formatDateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )}
        <Panel title="Xodimlar reytingi" subtitle="Buyurtma holatini oʻzgartirganlar, 30 kun">
          {d.staff_rating.length === 0 ? <p className="py-8 text-center text-[13px] text-ink-3">Hali harakat yoʻq</p> : (
            <ol className="space-y-3">
              {d.staff_rating.map((s, i) => (
                <li key={s.name + i} className="flex items-center gap-3 text-sm">
                  <Avatar name={s.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 font-semibold num">{formatNumber(s.actions)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
