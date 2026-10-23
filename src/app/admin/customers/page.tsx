import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { buildHref, pageParam } from '@/lib/admin/query';
import { formatDate, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { Badge, Pagination } from '@/components/ui/misc';
import { PageHeader, FilterBar, FilterField, Table, EmptyRow, inputSm } from '@/components/admin/ui';

export const metadata = { title: 'Mijozlar' };
const PAGE = 30;
interface Row { id: string; full_name: string | null; phone: string | null; email: string | null; is_blocked: boolean; created_at: string; orders_count: number; total_spent: number; last_order_at: string | null }

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePagePermission('customers.read');
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('admin_customers', { p_q: sp.q ?? null, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  const res = (data ?? { items: [], total: 0 }) as { items: Row[]; total: number };
  return (
    <div>
      <PageHeader title="Mijozlar" description={`${res.total} ta ro‘yxatdan o‘tgan foydalanuvchi`} />
      <FilterBar resetHref="/admin/customers">
        <FilterField label="Qidiruv"><input name="q" defaultValue={sp.q} placeholder="Ism, telefon, email" className={`${inputSm} w-64`} /></FilterField>
      </FilterBar>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <Table>
          <thead><tr><th>Mijoz</th><th>Telefon</th><th className="text-right">Buyurtmalar</th><th className="text-right">Xaridlar summasi</th><th>Oxirgi buyurtma</th><th>Ro‘yxatdan o‘tgan</th></tr></thead>
          <tbody>
            {res.items.length === 0 && <EmptyRow cols={6} />}
            {res.items.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/customers/${c.id}`} className="font-medium hover:text-brand">{c.full_name || 'Ismsiz'}</Link> {c.is_blocked && <Badge tone="red">Bloklangan</Badge>}<div className="text-xs text-muted">{c.email}</div></td>
                <td>{formatUzPhone(c.phone) || '—'}</td>
                <td className="text-right tabular-nums">{c.orders_count}</td>
                <td className="text-right tabular-nums">{formatPrice(c.total_spent)}</td>
                <td className="text-muted">{formatDate(c.last_order_at) || '—'}</td>
                <td className="text-muted">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Pagination page={page} total={res.total} pageSize={PAGE} makeHref={(p) => buildHref('/admin/customers', sp, { page: p })} />
    </div>
  );
}
