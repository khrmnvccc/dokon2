import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { PageHeader, Table, EmptyRow } from '@/components/admin/ui';
import { PartnerTabs } from '@/components/admin/partner-tabs';
import { Badge, Pagination } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { formatDate, formatPrice } from '@/lib/format';
import { hasService, partnerBalances, partnerTabCounts, profilesById } from '@/lib/data/partners';

export const metadata = { title: 'Hamkor hisoblari' };
const PAGE = 50;

interface E { id: string; partner_id: string; order_id: string; friend_id: string | null; base_amount: number; percent: number; amount: number; status: string; available_at: string; created_at: string }

/** Hisoblar: har hamkor balansi va har bir buyurtmadan hisoblangan komissiya. */
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; p?: string }> }) {
  await requirePagePermission('partners.manage');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const partnerId = /^[0-9a-f-]{36}$/.test(sp.p ?? '') ? sp.p! : null;
  const [counts, balances] = await Promise.all([partnerTabCounts(), partnerBalances()]);
  let rows: E[] = [];
  let total = 0;
  const orderNo = new Map<string, number>();
  if (hasService()) {
    const db = getServiceSupabase();
    let q = db.from('partner_earnings').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (partnerId) q = q.eq('partner_id', partnerId);
    const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
    rows = (data ?? []) as E[];
    total = count ?? 0;
    if (rows.length) {
      const { data: o } = await db.from('orders').select('id, number').in('id', rows.map((r) => r.order_id));
      for (const x of o ?? []) orderNo.set(String(x.id), Number(x.number));
    }
  }
  const people = await profilesById([...balances.map((b) => b.user_id), ...rows.flatMap((r) => [r.partner_id, r.friend_id ?? ''])]);
  const now = Date.now();
  const sum = (k: 'earned' | 'holding' | 'paid' | 'debt') => balances.reduce((a, b) => a + b[k], 0);
  return (
    <div>
      <PageHeader title="Hamkorlar" description="Hisoblar — hamkorlar balansi va har bir buyurtmadan hisoblangan komissiya." />
      <PartnerTabs active="earnings" counts={counts} />

      <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface-solid">
        <h2 className="px-4 pt-4 text-[15px] font-semibold">Balanslar</h2>
        <Table className="mt-2">
          <thead><tr><th>Hamkor</th><th className="text-right">Hisoblangan</th><th className="text-right">Tekshiruvda</th><th className="text-right">Toʻlangan</th><th className="text-right">Soʻralgan</th><th className="text-right">Qarz</th></tr></thead>
          <tbody>
            {balances.length === 0 && <EmptyRow cols={6} text="Hali hamkor yoʻq" />}
            {balances.map((b) => {
              const p = people.get(b.user_id);
              return (
                <tr key={b.user_id} className={cn(partnerId === b.user_id && 'bg-surface-2')}>
                  <td data-label="Hamkor"><Link href={`/admin/partners/earnings?p=${b.user_id}`} className="hover:underline"><span className="font-mono font-semibold num">{p?.client_no}</span> · {p?.full_name ?? 'Hamkor'}</Link>
                    {b.status === 'frozen' && <Badge className="ml-2">Muzlatilgan</Badge>}</td>
                  <td data-label="Hisoblangan" className="text-right font-mono num">{formatPrice(b.earned)}</td>
                  <td data-label="Tekshiruvda" className="text-right font-mono text-ink-3 num">{formatPrice(b.holding)}</td>
                  <td data-label="Toʻlangan" className="text-right font-mono num">{formatPrice(b.paid)}</td>
                  <td data-label="Soʻralgan" className="text-right font-mono num">{formatPrice(b.requested)}</td>
                  <td data-label="Qarz" className={cn('text-right font-mono font-semibold num', b.debt > 0 && 'text-warn')}>{formatPrice(b.debt)}</td>
                </tr>
              );
            })}
          </tbody>
          {balances.length > 1 && (
            <tfoot><tr className="border-t border-line font-semibold [&_td]:px-3 [&_td]:py-3 sm:[&_td]:px-4">
              <td>Jami</td><td className="text-right font-mono num">{formatPrice(sum('earned'))}</td><td className="text-right font-mono num">{formatPrice(sum('holding'))}</td>
              <td className="text-right font-mono num">{formatPrice(sum('paid'))}</td><td /><td className="text-right font-mono num">{formatPrice(sum('debt'))}</td>
            </tr></tfoot>
          )}
        </Table>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-[15px] font-semibold">Komissiyalar{partnerId && ' · tanlangan hamkor'}</h2>
          {partnerId && <Link href="/admin/partners/earnings" className="text-[13px] text-ink-3 hover:text-ink">Hammasini koʻrsatish</Link>}
        </div>
        <Table className="mt-2">
          <thead><tr><th>Hamkor</th><th>Doʻst</th><th>Buyurtma</th><th className="text-right">Summa</th><th className="text-right">Foiz</th><th className="text-right">Komissiya</th><th>Holat</th></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow cols={7} text="Hali komissiya yoʻq — hamkorning doʻsti buyurtmasi yetkazilganda paydo boʻladi" />}
            {rows.map((r) => {
              const hold = r.status === 'active' && new Date(r.available_at).getTime() > now;
              const p = people.get(r.partner_id);
              const f = r.friend_id ? people.get(r.friend_id) : undefined;
              return (
                <tr key={r.id}>
                  <td data-label="Hamkor"><span className="font-mono font-semibold num">{p?.client_no}</span> · {p?.full_name ?? '—'}</td>
                  <td data-label="Doʻst" className="text-ink-2"><span className="num">{f?.client_no}</span> · {f?.full_name ?? '—'}</td>
                  <td data-label="Buyurtma"><Link href={`/admin/orders/${r.order_id}`} className="font-medium text-[#1d4f80] hover:underline dark:text-white num">№{orderNo.get(r.order_id) ?? '…'}</Link></td>
                  <td data-label="Summa" className="text-right font-mono num">{formatPrice(Number(r.base_amount))}</td>
                  <td data-label="Foiz" className="text-right num">{Number(r.percent)}%</td>
                  <td data-label="Komissiya" className={cn('text-right font-mono font-semibold num', r.status === 'cancelled' && 'text-ink-3 line-through')}>{formatPrice(Number(r.amount))}</td>
                  <td data-label="Holat">{r.status === 'cancelled' ? <Badge tone="danger">Bekor (qaytarildi)</Badge> : hold
                    ? <Badge tone="warn">Tekshiruvda · {formatDate(r.available_at)} gacha</Badge> : <Badge tone="success">Mavjud</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE} makeHref={(p) => `/admin/partners/earnings?${new URLSearchParams({ ...(partnerId ? { p: partnerId } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`} />
    </div>
  );
}
