import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/ui';
import { DiscountTabs } from '@/components/admin/discount-tabs';
import { Table, EmptyRow } from '@/components/admin/ui';
import { formatDateTime, formatPrice } from '@/lib/format';

export const metadata = { title: 'Ishlatilgan kuponlar' };

/** Qaysi promo-kod qaysi buyurtmada qancha chegirma berdi (oxirgi 200 ta). */
export default async function Page() {
  await requirePagePermission('coupons.write');
  // coupon_redemptions jadvalida RLS siyosati yoʻq (faqat server): ruxsat yuqorida tekshirildi.
  const { data } = !process.env.SUPABASE_SERVICE_ROLE_KEY ? { data: [] } : await getServiceSupabase()
    .from('coupon_redemptions')
    .select('id, amount, phone, created_at, coupons(code), orders(id, number)')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Array<{ id: string; amount: number; phone: string | null; created_at: string; coupons: { code: string } | null; orders: { id: string; number: number } | null }>;
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <div>
      <PageHeader title="Aksiyalar" description="Promo-kodlar qaysi buyurtmalarda ishlatilgani." />
      <DiscountTabs active="/admin/coupons/used" />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
        <Table>
          <thead><tr><th>Kod</th><th>Buyurtma</th><th>Telefon</th><th className="text-right">Chegirma</th><th>Vaqt</th></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow cols={5} />}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono font-semibold">{r.coupons?.code ?? '—'}</code></td>
                <td>{r.orders ? <Link href={`/admin/orders/${r.orders.id}`} className="font-medium text-[#1d4f80] hover:underline dark:text-white num">№{r.orders.number}</Link> : '—'}</td>
                <td className="text-ink-2 num">{r.phone ?? '—'}</td>
                <td className="text-right font-mono num">{formatPrice(r.amount)}</td>
                <td className="text-ink-3 num">{formatDateTime(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="border-t border-line px-4 py-2.5 text-xs text-ink-3 num">{rows.length} ta · jami {formatPrice(total)}</div>
      </div>
    </div>
  );
}
