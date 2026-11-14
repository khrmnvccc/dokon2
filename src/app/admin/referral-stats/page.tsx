import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader, Panel, StatCard, Table, EmptyRow } from '@/components/admin/ui';
import { cn } from '@/components/ui/cn';
import { formatPrice } from '@/lib/format';
import { COUPON_SOURCE_LABEL, SOURCE_LABEL } from '@/lib/referral';

export const metadata = { title: 'Foydalanish' };

const PERIODS = [{ d: 7, label: '7 kun' }, { d: 30, label: '30 kun' }, { d: 90, label: '90 kun' }] as const;

interface Usage {
  joined: number; ordered: number; qualified: number; referrers: number; users: number;
  by_source: Record<string, number>; events: Record<string, number>;
  coupons: Record<string, { count: number; sum: number }>; redeemed: { count?: number; sum?: number }; sales: { count?: number; sum?: number };
  daily: { day: string; joined: number }[]; top: { client_no: number; full_name: string | null; friends: number; qualified: number }[];
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const fmtDay = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

function Funnel({ steps }: { steps: { label: string; value: number; hint?: string }[] }) {
  const top = Math.max(steps[0]?.value ?? 0, 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{s.label}</span>
            <span className="num"><b className="text-[17px]">{s.value}</b>{i > 0 && <span className="ml-1.5 text-xs text-ink-3">{pct(s.value, steps[i - 1].value)}%</span>}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-[#1d4f80] dark:bg-white/80" style={{ width: `${Math.max((s.value / top) * 100, s.value ? 3 : 0)}%`, opacity: 1 - i * 0.22 }} />
          </div>
          {s.hint && <p className="mt-1 text-xs text-ink-3">{s.hint}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Marketing → Foydalanish: doʻst taklifi qanchalik ishlayapti (davr boʻyicha). */
export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requirePagePermission('partners.manage');
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p.d) === sp.d)?.d ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('admin_referral_usage', { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) console.error('referral usage', error.message);
  const u = (data ?? {}) as Partial<Usage>;
  const ev = u.events ?? {};
  const coupons = u.coupons ?? {};
  const daily = new Map((u.daily ?? []).map((x) => [x.day, x.joined]));
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() + (i + 1) * 86_400_000 + 5 * 3600_000);
    const key = d.toISOString().slice(0, 10);
    return { key, value: daily.get(key) ?? 0 };
  });
  const maxDay = Math.max(...series.map((s) => s.value), 1);
  const issuedSum = Object.values(coupons).reduce((a, c) => a + Number(c.sum ?? 0), 0);
  const issuedCount = Object.values(coupons).reduce((a, c) => a + Number(c.count ?? 0), 0);
  return (
    <div>
      <PageHeader title="Foydalanish" description={`Doʻstni taklif qilish dasturi: ${fmtDay(from)} — ${fmtDay(to)}`}
        filters={
          <div className="flex rounded-xl border border-line bg-surface p-0.5">
            {PERIODS.map((p) => (
              <Link key={p.d} href={p.d === 30 ? '/admin/referral-stats' : `/admin/referral-stats?d=${p.d}`}
                className={cn('rounded-[10px] px-3 py-1.5 text-[13px] font-semibold', p.d === days ? 'bg-[#1d4f80] text-white' : 'text-ink-3 hover:text-ink')}>{p.label}</Link>
            ))}
          </div>
        } />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Taklif orqali kelganlar" value={Number(u.joined ?? 0)} format="number" hint={`${u.referrers ?? 0} kishi taklif qildi`} />
        <StatCard label="Shartni bajarganlar" value={Number(u.qualified ?? 0)} format="number" hint={`${pct(Number(u.qualified ?? 0), Number(u.joined ?? 0))}% kelganlardan`} />
        <StatCard label="Doʻstlar olib kelgan savdo" value={Number(u.sales?.sum ?? 0)} format="money" hint={`${u.sales?.count ?? 0} ta yetkazilgan buyurtma`} />
        <StatCard label="Berilgan kuponlar" value={issuedSum} format="money" hint={`${issuedCount} ta · ishlatildi ${u.redeemed?.count ?? 0} ta (${formatPrice(Number(u.redeemed?.sum ?? 0))})`} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Taklifdan xaridgacha" subtitle="Shu davrda qoʻshilgan doʻstlar qayergacha yetdi">
          <Funnel steps={[
            { label: 'Roʻyxatdan oʻtdi', value: Number(u.joined ?? 0) },
            { label: 'Birinchi buyurtma', value: Number(u.ordered ?? 0) },
            { label: 'Shart bajarildi', value: Number(u.qualified ?? 0), hint: 'Buyurtmasi qoidadagi holatga yetdi — taklif qilganga kupon berildi' },
          ]} />
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            {Object.entries(SOURCE_LABEL).map(([k, label]) => (
              <span key={k} className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-ink-2">{label}: <b className="num">{u.by_source?.[k] ?? 0}</b></span>
            ))}
          </div>
        </Panel>
        <Panel title="Mijozlar harakati" subtitle={`${u.users ?? 0} mijoz taklif sahifasini ishlatdi`}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'view', label: 'Sahifani ochdi' }, { k: 'share', label: 'Ulashish bosildi' },
              { k: 'copy', label: 'Havola nusxalandi' }, { k: 'open', label: 'Havola orqali kirildi' },
            ].map((x) => (
              <div key={x.k} className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs text-ink-3">{x.label}</p>
                <p className="mt-1 text-xl font-semibold num">{ev[x.k] ?? 0}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium text-ink-3">Kuponlar turi boʻyicha</p>
            <ul className="space-y-1.5 text-sm">
              {['referral', 'welcome', 'gift'].map((k) => (
                <li key={k} className="flex justify-between gap-3"><span className="text-ink-2">{COUPON_SOURCE_LABEL[k]}</span>
                  <span className="num"><b>{coupons[k]?.count ?? 0}</b> ta · {formatPrice(Number(coupons[k]?.sum ?? 0))}</span></li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <Panel title="Kunlik qoʻshilganlar" className="mb-5">
        <div className="flex h-32 items-end gap-[2px]" role="img" aria-label="Kunlik qoʻshilgan doʻstlar">
          {series.map((s) => (
            <div key={s.key} title={`${s.key}: ${s.value}`} className="flex-1 rounded-t bg-[#1d4f80]/80 dark:bg-white/70"
              style={{ height: `${(s.value / maxDay) * 100}%`, minHeight: s.value ? 4 : 1, opacity: s.value ? 1 : 0.15 }} />
          ))}
        </div>
      </Panel>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid">
        <h2 className="px-4 pt-4 text-[15px] font-semibold">Eng faol taklif qiluvchilar</h2>
        <Table className="mt-2">
          <thead><tr><th>Mijoz</th><th className="text-right">Taklif qilgan</th><th className="text-right">Shartni bajargan</th></tr></thead>
          <tbody>
            {(u.top ?? []).length === 0 && <EmptyRow cols={3} text="Bu davrda taklif yoʻq" />}
            {(u.top ?? []).map((t) => (
              <tr key={t.client_no}>
                <td data-label="Mijoz"><span className="font-mono font-semibold num">{t.client_no}</span> · {t.full_name ?? 'Mijoz'}</td>
                <td data-label="Taklif qilgan" className="text-right num">{t.friends}</td>
                <td data-label="Shartni bajargan" className="text-right font-semibold num">{t.qualified}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
