import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseSettings } from '@/lib/settings-schema';
import { profilesById } from '@/lib/data/partners';
import { formatDateTime, formatPrice } from '@/lib/format';
import { PageHeader, Panel, StatCard, Table, EmptyRow } from '@/components/admin/ui';
import { PersonCell } from '@/components/admin/person-cell';
import { BonusSettings, BonusAdjust } from '@/components/admin/bonus-ui';

export const metadata = { title: 'Bonus va keshbek' };

const KIND: Record<string, string> = { earn: 'Keshbek', spend: 'Ishlatildi', refund: 'Qaytdi (bekor)', reverse: 'Qaytarib olindi', adjust: 'Qoʻlda' };
interface Row { id: number; user_id: string; amount: number; kind: string; note: string | null; created_at: string; orders: { number: number } | { number: number }[] | null }

export default async function BonusAdminPage() {
  const ctx = await requirePagePermission('coupons.write');
  const supabase = await getServerSupabase();
  const { data: setRows } = await supabase.from('site_settings').select('key, value').eq('key', 'bonus');
  let rows: Row[] = [];
  let outstanding = 0;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const s = getServiceSupabase();
    const [{ data }, { data: all }] = await Promise.all([
      s.from('bonus_ledger').select('id, user_id, amount, kind, note, created_at, orders(number)').order('created_at', { ascending: false }).limit(200),
      s.from('bonus_ledger').select('amount').limit(100_000),
    ]);
    rows = (data ?? []) as Row[];
    outstanding = (all ?? []).reduce((a, r) => a + Number(r.amount), 0);
  }
  const since = Date.now() - 30 * 86_400_000;
  const recent = rows.filter((r) => new Date(r.created_at).getTime() >= since);
  const sum = (k: string) => recent.filter((r) => r.kind === k).reduce((a, r) => a + Math.abs(Number(r.amount)), 0);
  const people = await profilesById(rows.slice(0, 100).map((r) => r.user_id));
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v);
  return (
    <div>
      <PageHeader title="Bonus va keshbek" description="Yetkazilgan har xariddan mijozga bonus tushadi, keyingi xaridda u bilan toʻlaydi" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Mijozlardagi bonus" value={formatPrice(outstanding)} hint="jami qarzdorlik" />
        <StatCard label="Berilgan keshbek" value={formatPrice(sum('earn'))} hint="oxirgi 30 kun" />
        <StatCard label="Ishlatilgan bonus" value={formatPrice(sum('spend'))} hint="oxirgi 30 kun" />
        <StatCard label="Qoʻlda berilgan" value={formatPrice(recent.filter((r) => r.kind === 'adjust').reduce((a, r) => a + Number(r.amount), 0))} hint="oxirgi 30 kun" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:items-start">
        <Panel title="Oxirgi harakatlar" padded={false}>
          <Table>
            <thead><tr><th>Mijoz</th><th>Vaqt</th><th>Turi</th><th className="text-right">Summa</th></tr></thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={4} text="Hali bonus harakati yoʻq" />}
              {rows.slice(0, 100).map((r) => {
                const p = people.get(r.user_id);
                const o = one(r.orders);
                return (
                  <tr key={r.id}>
                    <td><PersonCell id={r.user_id} clientNo={p?.client_no} name={p?.full_name} phone={p?.phone} /></td>
                    <td className="whitespace-nowrap text-ink-3">{formatDateTime(r.created_at)}</td>
                    <td>{KIND[r.kind] ?? r.kind}{o ? ` · №${o.number}` : ''}{r.note && r.kind === 'adjust' ? <span className="block text-xs text-ink-3">{r.note}</span> : null}</td>
                    <td className={`text-right tabular-nums ${Number(r.amount) > 0 ? 'text-success' : ''}`}>{Number(r.amount) > 0 ? '+' : '−'}{formatPrice(Math.abs(Number(r.amount)))}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
        <div className="space-y-4">
          <BonusSettings initial={parseSettings(setRows ?? []).bonus} canEdit={ctx.permissions.has('settings.write')} />
          <BonusAdjust />
        </div>
      </div>
    </div>
  );
}
