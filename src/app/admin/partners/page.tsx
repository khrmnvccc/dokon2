import Link from 'next/link';
import { Search } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader, StatCard, Table, EmptyRow } from '@/components/admin/ui';
import { PartnerTabs } from '@/components/admin/partner-tabs';
import { PersonCell } from '@/components/admin/person-cell';
import { AddPartnerButton, PartnerActions } from '@/components/admin/partners-ui';
import { Badge, Pagination } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { formatPrice } from '@/lib/format';
import { PARTNER_STATUS } from '@/lib/referral';
import { partnerTabCounts } from '@/lib/data/partners';

export const metadata = { title: 'Hamkorlar' };

const FILTERS = [
  { key: 'partners', label: 'Hamkorlar', sum: 'partners' },
  { key: 'zero', label: 'Natijasiz', sum: 'zero' },
  { key: 'progress', label: 'Yoʻlda', sum: 'progress' },
] as const;
const PAGE = 50;

interface Row {
  user_id: string; client_no: number; full_name: string | null; phone: string | null; partner_status: string | null; commission_percent: number | null;
  friends: number; qualified: number; sales: number; orders: number; earned: number; available: number; paid: number; requested: number;
}
type Summary = Record<string, number>;

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; page?: string }> }) {
  await requirePagePermission('partners.manage');
  const sp = await searchParams;
  const f = FILTERS.some((x) => x.key === sp.f) ? sp.f! : 'partners';
  const q = (sp.q ?? '').slice(0, 80);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await getServerSupabase();
  const [{ data, error }, counts] = await Promise.all([
    supabase.rpc('admin_referral_board', { p_filter: f, p_q: q, p_limit: PAGE, p_offset: (page - 1) * PAGE }),
    partnerTabCounts(),
  ]);
  if (error) console.error('referral board', error.message);
  const board = (data ?? { rows: [], total: 0, summary: {} }) as { rows: Row[]; total: number; summary: Summary };
  const s = board.summary;
  const href = (p: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const merged = { f, q, ...p };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== '' && !(k === 'f' && v === 'partners') && !(k === 'page' && String(v) === '1')) u.set(k, String(v));
    return `/admin/partners${u.size ? `?${u}` : ''}`;
  };
  return (
    <div>
      <PageHeader title="Hamkorlar" description="Doʻst taklif qilib savdo olib kelayotgan mijozlar va ularning hisob-kitobi."
        actions={<AddPartnerButton defaultPercent={Number(s.percent ?? 3)} />} />
      <PartnerTabs active="partners" counts={counts} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Hamkorlar" value={Number(s.partners ?? 0)} format="number" hint={`${s.zero ?? 0} natijasiz · ${s.progress ?? 0} yoʻlda`} />
        <StatCard label="Ular olib kelgan savdo" value={Number(s.sales ?? 0)} format="money" hint={`${s.sales_orders ?? 0} ta yetkazilgan buyurtma`} />
        <StatCard label="Hisoblangan komissiya" value={Number(s.commission ?? 0)} format="money" hint={`${s.percent ?? 3}% · tekshiruvda ${formatPrice(Number(s.holding ?? 0))}`} />
        <StatCard label="Qarz (toʻlanmagan)" value={Number(s.debt ?? 0)} format="money" tone={Number(s.debt) > 0 ? 'warn' : undefined} hint={`${s.frozen ?? 0} muzlatilgan`} />
        <StatCard label="Yechish soʻrovlari" value={Number(s.requests ?? 0)} format="number" href={Number(s.requests) > 0 ? '/admin/partners/payouts' : undefined}
          hint={Number(s.requests) > 0 ? formatPrice(Number(s.requests_sum ?? 0)) : 'Hammasi koʻrib chiqilgan'} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">Reyting</h2>
            <p className="text-[13px] text-ink-3 num">{board.total} ta · olib kelgan savdo boʻyicha</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="relative">
              {f !== 'partners' && <input type="hidden" name="f" value={f} />}
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input name="q" defaultValue={q} placeholder="Ism, telefon yoki ID" aria-label="Qidirish"
                className="h-9 w-52 rounded-xl border border-line bg-surface-solid pl-9 pr-3 text-sm" />
            </form>
            {FILTERS.map((x) => (
              <Link key={x.key} href={href({ f: x.key, page: undefined })} aria-current={f === x.key ? 'true' : undefined}
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors',
                  f === x.key ? 'border-[#1d4f80]/30 bg-[#1d4f80]/10 text-[#1d4f80] dark:text-white' : 'border-line text-ink-3 hover:text-ink-2')}>
                {x.label} · <span className="num">{Number(s[x.sum] ?? 0)}</span>
              </Link>
            ))}
          </div>
        </div>
        <Table>
          <thead><tr>
            <th>Mijoz</th><th>Holat</th><th className="text-right">Doʻstlar</th><th className="text-right">Savdo</th>
            <th className="text-right">Komissiya</th><th className="text-right">Qarz</th><th className="text-right">Foiz</th><th />
          </tr></thead>
          <tbody>
            {board.rows.length === 0 && <EmptyRow cols={8} text={q ? 'Hech narsa topilmadi' : f === 'progress' ? 'Hali hech kim doʻst taklif qilmagan' : 'Yozuv yoʻq'} />}
            {board.rows.map((r) => {
              const debt = Math.max(Number(r.available) - Number(r.paid), 0);
              const st = r.partner_status ? PARTNER_STATUS[r.partner_status] : null;
              return (
                <tr key={r.user_id}>
                  <td data-label="Mijoz"><PersonCell id={r.user_id} clientNo={r.client_no} name={r.full_name} phone={r.phone} /></td>
                  <td data-label="Holat">{st ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge>Yoʻlda</Badge>}</td>
                  <td data-label="Doʻstlar" className="text-right num"><b>{r.qualified}</b><span className="text-ink-3"> / {r.friends}</span></td>
                  <td data-label="Savdo" className="text-right font-mono num">{formatPrice(Number(r.sales))}</td>
                  <td data-label="Komissiya" className="text-right font-mono num">{r.partner_status ? formatPrice(Number(r.earned)) : '—'}</td>
                  <td data-label="Qarz" className={cn('text-right font-mono num', debt > 0 && 'text-warn')}>{r.partner_status ? formatPrice(debt) : '—'}</td>
                  <td data-label="Foiz" className="text-right num">{r.commission_percent !== null ? `${Number(r.commission_percent)}%` : '—'}</td>
                  <td className="text-right">
                    {(r.partner_status === 'active' || r.partner_status === 'frozen') && (
                      <PartnerActions userId={r.user_id} name={`${r.client_no} · ${r.full_name ?? 'Hamkor'}`} percent={Number(r.commission_percent ?? 0)} status={r.partner_status} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      <Pagination page={page} total={board.total} pageSize={PAGE} makeHref={(p) => href({ page: p })} />
    </div>
  );
}
