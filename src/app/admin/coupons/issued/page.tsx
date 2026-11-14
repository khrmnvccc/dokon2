import Link from 'next/link';
import { Search } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { PageHeader, Table, EmptyRow } from '@/components/admin/ui';
import { DiscountTabs } from '@/components/admin/discount-tabs';
import { PersonCell } from '@/components/admin/person-cell';
import { GiftCouponButton, RevokeCouponButton } from '@/components/admin/partners-ui';
import { Badge, Pagination } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { COUPON_SOURCE_LABEL } from '@/lib/referral';
import { profilesById } from '@/lib/data/partners';

export const metadata = { title: 'Berilgan kuponlar' };
const PAGE = 50;
const SOURCES = ['referral', 'welcome', 'gift'] as const;
const STATES = { active: 'Faol', used: 'Ishlatilgan', expired: 'Muddati oʻtgan', revoked: 'Bekor qilingan' } as const;

interface C { id: string; code: string; description: string | null; value: number; min_order_amount: number; ends_at: string | null; used_count: number; usage_limit: number | null; is_active: boolean; owner_id: string; source: string; created_at: string }

function stateOf(c: C): keyof typeof STATES {
  if (c.used_count >= (c.usage_limit ?? 1)) return 'used';
  if (!c.is_active) return 'revoked';
  if (c.ends_at && new Date(c.ends_at).getTime() <= Date.now()) return 'expired';
  return 'active';
}
const TONE = { active: 'success', used: 'card', expired: 'neutral', revoked: 'danger' } as const;

/** Mijozlarga shaxsan berilgan kuponlar: doʻst taklifi bosqichlari, sovgʻa va qoʻlda berilganlar. */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; src?: string; page?: string }> }) {
  await requirePagePermission('coupons.write');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const src = SOURCES.find((x) => x === sp.src) ?? null;
  const q = (sp.q ?? '').trim();
  let rows: C[] = [];
  let total = 0;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = getServiceSupabase();
    let query = db.from('coupons').select('id, code, description, value, min_order_amount, ends_at, used_count, usage_limit, is_active, owner_id, source, created_at', { count: 'exact' })
      .not('owner_id', 'is', null).order('created_at', { ascending: false });
    if (src) query = query.eq('source', src);
    if (/^\d{1,12}$/.test(q)) {
      const { data: p } = await db.from('profiles').select('id').eq('client_no', Number(q)).maybeSingle();
      query = query.eq('owner_id', p?.id ?? '00000000-0000-0000-0000-000000000000');
    } else if (/^[A-Za-z0-9_-]{3,32}$/.test(q)) {
      query = query.eq('code', q.toUpperCase());
    }
    const { data, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
    rows = (data ?? []) as C[];
    total = count ?? 0;
  }
  const people = await profilesById(rows.map((r) => r.owner_id));
  const href = (p: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, src: src ?? undefined, ...p })) if (v !== undefined && v !== '' && !(k === 'page' && String(v) === '1')) u.set(k, String(v));
    return `/admin/coupons/issued${u.size ? `?${u}` : ''}`;
  };
  return (
    <div>
      <PageHeader title="Aksiyalar" description="Mijozlarga shaxsan berilgan kuponlar — faqat egasi ishlata oladi." actions={<GiftCouponButton />} />
      <DiscountTabs active="/admin/coupons/issued" />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <form method="get" className="relative">
            {src && <input type="hidden" name="src" value={src} />}
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input name="q" defaultValue={q} placeholder="Mijoz ID yoki kod" aria-label="Qidirish" className="h-9 w-48 rounded-xl border border-line bg-surface-solid pl-9 pr-3 text-sm" />
          </form>
          {[null, ...SOURCES].map((x) => (
            <Link key={x ?? 'all'} href={href({ src: x ?? undefined, page: undefined })}
              className={cn('inline-flex h-9 items-center rounded-xl border px-3 text-[13px] font-semibold',
                src === x ? 'border-[#1d4f80]/30 bg-[#1d4f80]/10 text-[#1d4f80] dark:text-white' : 'border-line text-ink-3 hover:text-ink-2')}>
              {x ? COUPON_SOURCE_LABEL[x] : 'Barcha manbalar'}
            </Link>
          ))}
          <span className="ml-auto text-[13px] text-ink-3 num">{total} ta</span>
        </div>
        <Table>
          <thead><tr><th>Mijoz</th><th>Kupon</th><th>Qayerdan</th><th>Berildi</th><th>Amal muddati</th><th>Holat</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow cols={7} text="Hali shaxsiy kupon berilmagan" />}
            {rows.map((r) => {
              const p = people.get(r.owner_id);
              const st = stateOf(r);
              return (
                <tr key={r.id}>
                  <td data-label="Mijoz"><PersonCell id={r.owner_id} clientNo={p?.client_no} name={p?.full_name} /></td>
                  <td data-label="Kupon"><code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-semibold">{r.code}</code>
                    <span className="ml-2 font-mono font-semibold num">{formatPrice(Number(r.value))}</span>
                    {Number(r.min_order_amount) > 0 && <span className="block text-xs text-ink-3">Min. {formatPrice(Number(r.min_order_amount))}</span>}</td>
                  <td data-label="Qayerdan"><span className="text-[#1d4f80] dark:text-white">{COUPON_SOURCE_LABEL[r.source] ?? r.source}</span>
                    {r.description && <span className="block text-xs text-ink-3">{r.description}</span>}</td>
                  <td data-label="Berildi" className="text-ink-3 num">{formatDateTime(r.created_at)}</td>
                  <td data-label="Muddat" className="num">{r.ends_at ? formatDate(r.ends_at) : '—'}</td>
                  <td data-label="Holat"><Badge tone={TONE[st]}>{STATES[st]}</Badge></td>
                  <td className="text-right">{st === 'active' && <RevokeCouponButton id={r.id} />}</td>
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
