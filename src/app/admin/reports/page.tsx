import Link from 'next/link';
import { Download } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { loadReports, reportRange } from '@/lib/admin/reports';
import { buildHref } from '@/lib/admin/query';
import { formatDate, formatNumber, formatPrice } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import { buttonClass } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { PageHeader, Panel, StatCard, Table, EmptyRow, FilterBar, FilterField, inputSm } from '@/components/admin/ui';
import { BarChart, HBarList } from '@/components/admin/charts';
import type { OrderStatus } from '@/lib/types';

export const metadata = { title: 'Hisobotlar' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; g?: string; preset?: string }> }) {
  await requirePagePermission('reports.view');
  const sp = await searchParams;
  const { from, to, g } = reportRange(sp);
  const { sales, products, statuses, error } = await loadReports(from, to, g);
  const sum = (k: keyof (typeof sales)[number]) => sales.reduce((s, r) => s + Number(r[k]), 0);
  const revenue = sum('revenue');
  const orders = sum('orders_count');
  const profit = sum('gross_profit');
  const goods = sum('goods_revenue');
  const p = (v: number) => formatPrice(v);
  const base = { from, to, g };
  const periodLabel = (d: string) => g === 'month' ? new Date(d).toLocaleDateString('uz-UZ', { month: 'short', year: 'numeric' }) : formatDate(d);

  return (
    <div>
      <PageHeader title="Hisobotlar" description={`${formatDate(from)} — ${formatDate(to)}`}
        actions={<>
          <Link prefetch={false} href={`/admin/reports/export?${new URLSearchParams({ ...base, format: 'xlsx' })}`} className={buttonClass('outline', 'sm')}><Download className="h-4 w-4" /> Excel</Link>
          <Link prefetch={false} href={`/admin/reports/export?${new URLSearchParams({ ...base, format: 'csv' })}`} className={buttonClass('outline', 'sm')}><Download className="h-4 w-4" /> CSV</Link>
        </>} />
      <div className="mb-3 flex flex-wrap gap-2">
        {[['today', 'Bugun'], ['7', '7 kun'], ['30', '30 kun'], ['month', 'Shu oy'], ['year', 'Shu yil']].map(([k, l]) => (
          <Link key={k} href={buildHref('/admin/reports', { g }, { preset: k })} className={cn('rounded-full px-3 py-1.5 text-sm font-medium', sp.preset === k ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-line')}>{l}</Link>
        ))}
      </div>
      <FilterBar resetHref="/admin/reports">
        <FilterField label="Dan"><input type="date" name="from" defaultValue={from} className={inputSm} /></FilterField>
        <FilterField label="Gacha"><input type="date" name="to" defaultValue={to} className={inputSm} /></FilterField>
        <FilterField label="Guruhlash">
          <select name="g" defaultValue={g} className={inputSm}><option value="day">Kunlik</option><option value="week">Haftalik</option><option value="month">Oylik</option></select>
        </FilterField>
      </FilterBar>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Hisobotni yuklab bo‘lmadi.</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Tushum" value={p(revenue)} hint="Bekor/qaytarilganlarsiz" />
        <StatCard label="Buyurtmalar" value={formatNumber(orders)} hint={`O‘rtacha chek: ${p(orders ? Math.round(revenue / orders) : 0)}`} />
        <StatCard label="Sotilgan dona" value={formatNumber(sum('items_sold'))} />
        <StatCard label="Yalpi foyda" value={p(profit)} hint={goods ? `Marja: ${Math.round((profit / goods) * 100)}% (tannarxi ma’lum mahsulotlar)` : undefined} />
        <StatCard label="Chegirmalar" value={p(sum('discounts'))} hint={`Bekor: ${sum('cancelled_count')}, qaytarilgan: ${sum('returned_count')}`} />
      </div>
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Tushum dinamikasi (so‘m)" className="xl:col-span-2">
          {sales.length ? <BarChart valueLabel="Tushum" data={sales.map((r) => ({ label: periodLabel(r.period), value: Number(r.revenue), sub: `${r.orders_count} ta buyurtma` }))} formatValue={p} /> : <p className="py-10 text-center text-sm text-muted">Bu davrda savdo yo‘q</p>}
        </Panel>
        <Panel title="Holatlar bo‘yicha">
          <HBarList items={statuses.map((s) => ({ label: orderStatusLabel[s.status as OrderStatus] ?? s.status, value: Number(s.orders_count), extra: p(Number(s.amount)) }))} />
        </Panel>
      </div>
      <Panel title="Davrlar bo‘yicha" padded={false} className="mb-4">
        <Table>
          <thead><tr><th>Davr</th><th className="text-right">Buyurtma</th><th className="text-right">Dona</th><th className="text-right">Mahsulotlar</th><th className="text-right">Yetkazish</th><th className="text-right">Chegirma</th><th className="text-right">Tushum</th><th className="text-right">Tannarx</th><th className="text-right">Yalpi foyda</th></tr></thead>
          <tbody>
            {sales.length === 0 && <EmptyRow cols={9} />}
            {sales.map((r) => (
              <tr key={r.period} className="tabular-nums">
                <td>{periodLabel(r.period)}</td>
                <td className="text-right">{r.orders_count}</td><td className="text-right">{r.items_sold}</td>
                <td className="text-right">{p(r.goods_revenue)}</td><td className="text-right">{p(r.shipping)}</td><td className="text-right">{p(r.discounts)}</td>
                <td className="text-right font-semibold">{p(r.revenue)}</td><td className="text-right">{p(r.cost_known)}</td><td className="text-right font-semibold text-emerald-700">{p(r.gross_profit)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel title="Mahsulotlar bo‘yicha (eng ko‘p sotilgan)" padded={false}>
        <Table>
          <thead><tr><th>Mahsulot</th><th>SKU</th><th className="text-right">Dona</th><th className="text-right">Tushum</th><th className="text-right">Tannarx</th><th className="text-right">Yalpi foyda</th></tr></thead>
          <tbody>
            {products.length === 0 && <EmptyRow cols={6} />}
            {products.slice(0, 100).map((r, i) => (
              <tr key={r.product_id ?? i} className="tabular-nums">
                <td>{r.product_id ? <Link href={`/admin/products/${r.product_id}`} className="hover:text-brand">{r.product_name}</Link> : r.product_name}</td>
                <td className="text-muted">{r.sku ?? '—'}</td>
                <td className="text-right">{r.quantity}</td><td className="text-right">{p(r.revenue)}</td>
                <td className="text-right">{r.cost !== null ? p(r.cost) : '—'}</td><td className="text-right">{r.gross_profit !== null ? p(r.gross_profit) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <p className="mt-3 text-xs text-muted">Yalpi foyda = mahsulot tushumi (chegirmadan keyin) − tannarx. Tannarxi kiritilmagan mahsulotlar foydaga qo‘shilmaydi. Tannarx buyurtma paytidagi qiymat bo‘yicha olinadi.</p>
    </div>
  );
}
