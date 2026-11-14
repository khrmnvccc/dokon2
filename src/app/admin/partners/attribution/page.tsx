import Link from 'next/link';
import { Search } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { PageHeader, Table, EmptyRow } from '@/components/admin/ui';
import { PartnerTabs } from '@/components/admin/partner-tabs';
import { PersonCell } from '@/components/admin/person-cell';
import { LinkReferralButton, UnlinkButton } from '@/components/admin/partners-ui';
import { Badge, Pagination } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { formatDateTime } from '@/lib/format';
import { REFERRAL_STATUS, SOURCE_LABEL } from '@/lib/referral';
import { hasService, partnerTabCounts, profilesById } from '@/lib/data/partners';

export const metadata = { title: 'Atributsiya' };
const PAGE = 50;
const STATUSES = ['joined', 'ordered', 'qualified'] as const;

interface Ref { friend_id: string; referrer_id: string; source: string; status: string; first_order_id: string | null; qualified_order_id: string | null; qualified_at: string | null; created_at: string }

/** Kim kimni olib kelgan: har bir taklif qilingan mijoz, manbasi va holati. */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; s?: string; page?: string }> }) {
  await requirePagePermission('partners.manage');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((x) => x === sp.s) ?? null;
  const qNo = /^\d{1,12}$/.test((sp.q ?? '').trim()) ? Number(sp.q) : null;
  let rows: Ref[] = [];
  let total = 0;
  const counts = await partnerTabCounts();
  if (hasService()) {
    const db = getServiceSupabase();
    let query = db.from('referrals').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (qNo) {
      const { data: p } = await db.from('profiles').select('id').eq('client_no', qNo).maybeSingle();
      query = p ? query.or(`friend_id.eq.${p.id},referrer_id.eq.${p.id}`) : query.eq('friend_id', '00000000-0000-0000-0000-000000000000');
    }
    const { data, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
    rows = (data ?? []) as Ref[];
    total = count ?? 0;
  }
  const people = await profilesById(rows.flatMap((r) => [r.friend_id, r.referrer_id]));
  const href = (p: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, s: status ?? undefined, ...p })) if (v !== undefined && v !== '' && !(k === 'page' && String(v) === '1')) u.set(k, String(v));
    return `/admin/partners/attribution${u.size ? `?${u}` : ''}`;
  };
  return (
    <div>
      <PageHeader title="Hamkorlar" description="Atributsiya — har bir yangi mijozni kim olib kelgani." actions={<LinkReferralButton />} />
      <PartnerTabs active="attribution" counts={counts} />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <form method="get" className="relative">
            {status && <input type="hidden" name="s" value={status} />}
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input name="q" defaultValue={sp.q ?? ''} inputMode="numeric" placeholder="Mijoz ID" aria-label="Mijoz ID boʻyicha"
              className="h-9 w-40 rounded-xl border border-line bg-surface-solid pl-9 pr-3 text-sm" />
          </form>
          {[null, ...STATUSES].map((x) => (
            <Link key={x ?? 'all'} href={href({ s: x ?? undefined, page: undefined })}
              className={cn('inline-flex h-9 items-center rounded-xl border px-3 text-[13px] font-semibold',
                status === x ? 'border-[#1d4f80]/30 bg-[#1d4f80]/10 text-[#1d4f80] dark:text-white' : 'border-line text-ink-3 hover:text-ink-2')}>
              {x ? REFERRAL_STATUS[x].label : 'Hammasi'}
            </Link>
          ))}
          <span className="ml-auto text-[13px] text-ink-3 num">{total} ta</span>
        </div>
        <Table>
          <thead><tr><th>Yangi mijoz</th><th>Taklif qilgan</th><th>Manba</th><th>Holat</th><th>Qoʻshildi</th><th>Buyurtma</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow cols={7} text="Hali taklif orqali kelgan mijoz yoʻq" />}
            {rows.map((r) => {
              const f = people.get(r.friend_id);
              const ref = people.get(r.referrer_id);
              const st = REFERRAL_STATUS[r.status];
              const order = r.qualified_order_id ?? r.first_order_id;
              return (
                <tr key={r.friend_id}>
                  <td data-label="Yangi mijoz"><PersonCell id={r.friend_id} clientNo={f?.client_no} name={f?.full_name} phone={f?.phone} /></td>
                  <td data-label="Taklif qilgan"><PersonCell id={r.referrer_id} clientNo={ref?.client_no} name={ref?.full_name} /></td>
                  <td data-label="Manba" className="text-ink-2">{SOURCE_LABEL[r.source] ?? r.source}</td>
                  <td data-label="Holat"><Badge tone={st?.tone}>{st?.label ?? r.status}</Badge></td>
                  <td data-label="Qoʻshildi" className="text-ink-3 num">{formatDateTime(r.created_at)}</td>
                  <td data-label="Buyurtma">{order ? <Link href={`/admin/orders/${order}`} className="font-medium text-[#1d4f80] hover:underline dark:text-white">Ochish</Link> : <span className="text-ink-3">—</span>}</td>
                  <td className="text-right">{r.status !== 'qualified' && <UnlinkButton friendId={r.friend_id} />}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE} makeHref={(p) => href({ page: p })} />
    </div>
  );
}
