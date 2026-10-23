import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import { Badge } from '@/components/ui/misc';
import { PageHeader, Panel, StatCard, Table, EmptyRow } from '@/components/admin/ui';
import { BlockCustomer } from '@/components/admin/block-customer';
import type { Order, Profile } from '@/lib/types';

export const metadata = { title: 'Mijoz' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission('customers.read');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getServerSupabase();
  const [{ data: profile }, { data: orders }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    ctx.permissions.has('orders.read')
      ? supabase.from('orders').select('id, number, status, total, created_at, items_count').eq('user_id', id).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
    supabase.from('user_roles').select('role').eq('user_id', id),
  ]);
  if (!profile) notFound();
  const p = profile as Profile;
  const list = (orders ?? []) as Order[];
  const spent = list.filter((o) => !['cancelled', 'returned'].includes(o.status)).reduce((s, o) => s + Number(o.total), 0);
  return (
    <div>
      <PageHeader title={p.full_name || 'Ismsiz mijoz'} back={{ href: '/admin/customers', label: 'Mijozlar' }}
        description={<>{p.email} · {formatUzPhone(p.phone)} {p.is_blocked && <Badge tone="red">Bloklangan</Badge>} {(roles ?? []).length > 0 && <Badge tone="violet">Xodim</Badge>}</>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Buyurtmalar" value={list.length} />
        <StatCard label="Xaridlar summasi" value={formatPrice(spent)} />
        <StatCard label="O‘rtacha chek" value={formatPrice(list.length ? Math.round(spent / Math.max(1, list.filter((o) => !['cancelled', 'returned'].includes(o.status)).length)) : 0)} />
        <StatCard label="Ro‘yxatdan o‘tgan" value={formatDate(p.created_at)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
        <Panel title="Buyurtmalar" padded={false}>
          <Table>
            <thead><tr><th>№</th><th>Sana</th><th className="text-right">Summa</th><th>Holat</th></tr></thead>
            <tbody>
              {list.length === 0 && <EmptyRow cols={4} text="Buyurtma yo‘q" />}
              {list.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand">#{o.number}</Link></td>
                  <td className="text-muted">{formatDateTime(o.created_at)}</td>
                  <td className="text-right tabular-nums">{formatPrice(o.total)}</td>
                  <td><Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <div className="space-y-4">
          {ctx.permissions.has('customers.block') && (
            <Panel title="Hisob holati">
              <BlockCustomer userId={p.id} blocked={p.is_blocked} reason={p.blocked_reason} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
