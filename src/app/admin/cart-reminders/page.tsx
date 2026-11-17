import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseSettings } from '@/lib/settings-schema';
import { profilesById } from '@/lib/data/partners';
import { formatDateTime, formatNumber, formatPrice } from '@/lib/format';
import { PageHeader, Panel, StatCard, Table, EmptyRow } from '@/components/admin/ui';
import { PersonCell } from '@/components/admin/person-cell';
import { Badge } from '@/components/ui/misc';
import { CartReminderSettings } from '@/components/admin/cart-reminder-settings';

export const metadata = { title: 'Savat eslatmasi' };

interface Row { id: string; user_id: string; step: number; items_count: number; cart_total: number; sent_at: string; coupon_id: string | null; recovered_order_id: string | null; coupons: { code: string } | { code: string }[] | null; orders: { number: number; total: number } | { number: number; total: number }[] | null }
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function CartRemindersPage() {
  const ctx = await requirePagePermission('coupons.write');
  const supabase = await getServerSupabase();
  const { data: setRows } = await supabase.from('site_settings').select('key, value').eq('key', 'cart_reminder');
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  let rows: Row[] = [];
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await getServiceSupabase().from('cart_reminders')
      .select('id, user_id, step, items_count, cart_total, sent_at, coupon_id, recovered_order_id, coupons(code), orders(number, total)')
      .gte('sent_at', since).order('sent_at', { ascending: false }).limit(500);
    rows = (data ?? []) as Row[];
  }
  const people = await profilesById(rows.slice(0, 100).map((r) => r.user_id));
  const recovered = rows.filter((r) => r.recovered_order_id);
  const revenue = recovered.reduce((s, r) => s + Number(one(r.orders)?.total ?? 0), 0);
  const users = new Set(rows.map((r) => r.user_id)).size;
  return (
    <div>
      <PageHeader title="Savat eslatmasi" description="Savatda mahsulot qoldirgan mijozlarga botdan eslatma va kupon. Oxirgi 30 kun" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Yuborilgan eslatmalar" value={formatNumber(rows.length)} hint={`${users} ta mijoz`} />
        <StatCard label="Qaytgan xaridlar" value={formatNumber(recovered.length)} hint={users ? `${Math.round((recovered.length / users) * 100)}% mijoz qaytdi` : undefined} />
        <StatCard label="Qaytgan tushum" value={formatPrice(revenue)} />
        <StatCard label="Berilgan kuponlar" value={formatNumber(rows.filter((r) => r.coupon_id).length)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:items-start">
        <Panel title="Oxirgi eslatmalar" padded={false}>
          <Table>
            <thead><tr><th>Mijoz</th><th>Vaqt</th><th className="text-right">Savat</th><th>Kupon</th><th>Natija</th></tr></thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={5} text="Hali eslatma yuborilmagan" />}
              {rows.slice(0, 100).map((r) => {
                const p = people.get(r.user_id);
                const o = one(r.orders);
                return (
                  <tr key={r.id}>
                    <td><PersonCell id={r.user_id} clientNo={p?.client_no} name={p?.full_name} phone={p?.phone} /></td>
                    <td className="whitespace-nowrap text-ink-3">{formatDateTime(r.sent_at)} · {r.step}-eslatma</td>
                    <td className="text-right tabular-nums">{formatPrice(r.cart_total)}<span className="block text-xs text-ink-3">{r.items_count} dona</span></td>
                    <td className="font-mono text-xs">{one(r.coupons)?.code ?? '—'}</td>
                    <td>{o && r.recovered_order_id ? <Link href={`/admin/orders/${r.recovered_order_id}`}><Badge tone="success">№{o.number} · {formatPrice(o.total)}</Badge></Link> : <span className="text-xs text-ink-3">kutilmoqda</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
        <CartReminderSettings initial={parseSettings(setRows ?? []).cart_reminder} canEdit={ctx.permissions.has('settings.write')} />
      </div>
    </div>
  );
}
