import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { PageHeader, Table, EmptyRow } from '@/components/admin/ui';
import { PartnerTabs } from '@/components/admin/partner-tabs';
import { PersonCell } from '@/components/admin/person-cell';
import { PayoutActions, RecordPayoutButton } from '@/components/admin/partners-ui';
import { Badge } from '@/components/ui/misc';
import { formatDateTime, formatPrice } from '@/lib/format';
import { PAYOUT_STATUS } from '@/lib/referral';
import { hasService, partnerBalances, partnerTabCounts, personLabel, profilesById } from '@/lib/data/partners';

export const metadata = { title: 'Pul yechish' };

interface P { id: string; partner_id: string; amount: number; card: string | null; status: string; note: string | null; requested_at: string; decided_at: string | null }

/** Yechimlar: hamkorlarning pul yechish soʻrovlari va toʻlovlar tarixi. */
export default async function Page() {
  await requirePagePermission('partners.manage');
  const [counts, balances] = await Promise.all([partnerTabCounts(), partnerBalances()]);
  let open: P[] = [];
  let history: P[] = [];
  if (hasService()) {
    const db = getServiceSupabase();
    const [{ data: a }, { data: b }] = await Promise.all([
      db.from('partner_payouts').select('*').eq('status', 'requested').order('requested_at').limit(200),
      db.from('partner_payouts').select('*').neq('status', 'requested').order('decided_at', { ascending: false, nullsFirst: false }).limit(100),
    ]);
    open = (a ?? []) as P[];
    history = (b ?? []) as P[];
  }
  const people = await profilesById([...open, ...history].map((x) => x.partner_id).concat(balances.map((b) => b.user_id)));
  const bal = new Map(balances.map((b) => [b.user_id, b]));
  return (
    <div>
      <PageHeader title="Hamkorlar" description="Yechimlar — hamkor soʻragan pulni oʻtkazib, “Toʻlandi” deb belgilang."
        actions={<RecordPayoutButton partners={balances.filter((b) => b.free > 0).map((b) => ({ id: b.user_id, label: personLabel(people.get(b.user_id)), free: b.free }))} />} />
      <PartnerTabs active="payouts" counts={counts} />
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
          <h2 className="px-4 pt-4 text-[15px] font-semibold">Soʻrovlar</h2>
          <Table className="mt-2">
            <thead><tr><th>Hamkor</th><th className="text-right">Summa</th><th>Karta</th><th className="text-right">Qarz (balans)</th><th>Soʻralgan</th><th /></tr></thead>
            <tbody>
              {open.length === 0 && <EmptyRow cols={6} text="Yangi soʻrov yoʻq" />}
              {open.map((x) => {
                const p = people.get(x.partner_id);
                return (
                  <tr key={x.id}>
                    <td data-label="Hamkor"><PersonCell id={x.partner_id} clientNo={p?.client_no} name={p?.full_name} phone={p?.phone} /></td>
                    <td data-label="Summa" className="text-right font-mono font-semibold num">{formatPrice(Number(x.amount))}</td>
                    <td data-label="Karta" className="font-mono text-ink-2 num">{x.card ?? '—'}</td>
                    <td data-label="Qarz" className="text-right font-mono text-ink-3 num">{formatPrice(bal.get(x.partner_id)?.debt ?? 0)}</td>
                    <td data-label="Soʻralgan" className="text-ink-3 num">{formatDateTime(x.requested_at)}</td>
                    <td className="text-right"><PayoutActions id={x.id} amount={Number(x.amount)} card={x.card} /></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
          <h2 className="px-4 pt-4 text-[15px] font-semibold">Tarix</h2>
          <Table className="mt-2">
            <thead><tr><th>Hamkor</th><th className="text-right">Summa</th><th>Holat</th><th>Izoh</th><th>Vaqt</th></tr></thead>
            <tbody>
              {history.length === 0 && <EmptyRow cols={5} text="Hali toʻlov yoʻq" />}
              {history.map((x) => {
                const st = PAYOUT_STATUS[x.status];
                return (
                  <tr key={x.id}>
                    <td data-label="Hamkor">{personLabel(people.get(x.partner_id))}</td>
                    <td data-label="Summa" className="text-right font-mono num">{formatPrice(Number(x.amount))}</td>
                    <td data-label="Holat"><Badge tone={st?.tone}>{st?.label ?? x.status}</Badge></td>
                    <td data-label="Izoh" className="text-ink-2">{x.note ?? '—'}</td>
                    <td data-label="Vaqt" className="text-ink-3 num">{formatDateTime(x.decided_at ?? x.requested_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
