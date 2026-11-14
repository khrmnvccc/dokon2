import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { PageHeader, Table, EmptyRow } from '@/components/admin/ui';
import { PartnerTabs } from '@/components/admin/partner-tabs';
import { PersonCell } from '@/components/admin/person-cell';
import { ApplicationActions } from '@/components/admin/partners-ui';
import { Badge } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/format';
import { PARTNER_STATUS } from '@/lib/referral';
import { hasService, partnerTabCounts, profilesById } from '@/lib/data/partners';
import { getReferralSettings } from '@/lib/referral-server';

export const metadata = { title: 'Hamkorlik arizalari' };

interface P { user_id: string; status: string; commission_percent: number; applied_at: string; decided_at: string | null }

/** Hamkorlik arizalari (avtomatik qabul oʻchirilganda) va oxirgi qarorlar. */
export default async function Page() {
  await requirePagePermission('partners.manage');
  const [counts, cfg] = await Promise.all([partnerTabCounts(), getReferralSettings()]);
  let pending: P[] = [];
  let decided: P[] = [];
  const qualified = new Map<string, number>();
  if (hasService()) {
    const db = getServiceSupabase();
    const [{ data: a }, { data: b }] = await Promise.all([
      db.from('partners').select('user_id, status, commission_percent, applied_at, decided_at').eq('status', 'pending').order('applied_at').limit(200),
      db.from('partners').select('user_id, status, commission_percent, applied_at, decided_at').neq('status', 'pending').order('decided_at', { ascending: false, nullsFirst: false }).limit(30),
    ]);
    pending = (a ?? []) as P[];
    decided = (b ?? []) as P[];
    if (pending.length) {
      const { data: r } = await db.from('referrals').select('referrer_id').eq('status', 'qualified').in('referrer_id', pending.map((x) => x.user_id));
      for (const x of r ?? []) qualified.set(String(x.referrer_id), (qualified.get(String(x.referrer_id)) ?? 0) + 1);
    }
  }
  const people = await profilesById([...pending, ...decided].map((x) => x.user_id));
  return (
    <div>
      <PageHeader title="Hamkorlar" description={cfg.partner.auto
        ? 'Avtomatik qabul yoqilgan: bosqichlarni tugatgan mijoz darhol hamkor boʻladi. Qoʻlda tasdiqlash uchun Qoidalarda oʻchiring.'
        : 'Bosqichlarni tugatgan mijozlar arizasi. Qabul qilsangiz — doʻstlari xaridlaridan foiz oladi.'} />
      <PartnerTabs active="applications" counts={counts} />
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
          <h2 className="px-4 pt-4 text-[15px] font-semibold">Koʻrib chiqilishi kerak</h2>
          <Table className="mt-2">
            <thead><tr><th>Mijoz</th><th className="text-right">Shartni bajargan doʻstlar</th><th>Ariza vaqti</th><th className="text-right">Qaror</th></tr></thead>
            <tbody>
              {pending.length === 0 && <EmptyRow cols={4} text="Yangi ariza yoʻq" />}
              {pending.map((x) => {
                const p = people.get(x.user_id);
                return (
                  <tr key={x.user_id}>
                    <td data-label="Mijoz"><PersonCell id={x.user_id} clientNo={p?.client_no} name={p?.full_name} phone={p?.phone} /></td>
                    <td data-label="Doʻstlar" className="text-right font-semibold num">{qualified.get(x.user_id) ?? 0}</td>
                    <td data-label="Vaqt" className="text-ink-3 num">{formatDateTime(x.applied_at)}</td>
                    <td className="text-right"><ApplicationActions userId={x.user_id} percent={Number(x.commission_percent)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
          <h2 className="px-4 pt-4 text-[15px] font-semibold">Oxirgi qarorlar</h2>
          <Table className="mt-2">
            <thead><tr><th>Mijoz</th><th>Holat</th><th className="text-right">Foiz</th><th>Qaror vaqti</th></tr></thead>
            <tbody>
              {decided.length === 0 && <EmptyRow cols={4} text="Hali qaror yoʻq" />}
              {decided.map((x) => {
                const p = people.get(x.user_id);
                const st = PARTNER_STATUS[x.status];
                return (
                  <tr key={x.user_id}>
                    <td data-label="Mijoz"><PersonCell id={x.user_id} clientNo={p?.client_no} name={p?.full_name} /></td>
                    <td data-label="Holat"><Badge tone={st?.tone}>{st?.label ?? x.status}</Badge></td>
                    <td data-label="Foiz" className="text-right num">{Number(x.commission_percent)}%</td>
                    <td data-label="Vaqt" className="text-ink-3 num">{formatDateTime(x.decided_at)}</td>
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
