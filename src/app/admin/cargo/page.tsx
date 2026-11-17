import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseSettings } from '@/lib/settings-schema';
import { formatDateTime } from '@/lib/format';
import { PageHeader, Panel, StatCard, Table, EmptyRow } from '@/components/admin/ui';
import { CargoBulkForm, CargoSettings } from '@/components/admin/cargo-ui';

export const metadata = { title: 'Kargo' };

export default async function CargoPage() {
  const ctx = await requirePagePermission('orders.write');
  const supabase = await getServerSupabase();
  const [{ data: setRows }, { data: active }, { data: events }] = await Promise.all([
    supabase.from('site_settings').select('key, value').eq('key', 'cargo'),
    supabase.from('orders').select('cargo_stage').in('status', ['confirmed', 'processing', 'shipped', 'arrived']).limit(5000),
    supabase.from('cargo_events').select('id, stage, note, created_at, orders(id, number, tracking_number)').order('created_at', { ascending: false }).limit(30),
  ]);
  const cfg = parseSettings(setRows ?? []).cargo;
  const label = (k: string | null) => cfg.stages.find((s) => s.key === k)?.label ?? (k ? k : 'Belgilanmagan');
  const counts = new Map<string, number>();
  for (const o of active ?? []) counts.set(o.cargo_stage ?? '', (counts.get(o.cargo_stage ?? '') ?? 0) + 1);
  return (
    <div>
      <PageHeader title="Kargo" description="Yuk qayerdaligi: bosqichni bitta buyurtmada yoki butun partiya uchun trek raqamlari bilan yangilang. Mijoz saytda va botda koʻradi" />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Belgilanmagan" value={String(counts.get('') ?? 0)} hint="faol buyurtmalar" />
        {cfg.stages.map((s) => <StatCard key={s.key} label={s.label} value={String(counts.get(s.key) ?? 0)} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr] xl:items-start">
        <div className="grid gap-4">
          <CargoBulkForm stages={cfg.stages} />
          <Panel title="Oxirgi yangilanishlar" padded={false}>
            <Table>
              <thead><tr><th>Buyurtma</th><th>Bosqich</th><th>Vaqt</th></tr></thead>
              <tbody>
                {(events ?? []).length === 0 && <EmptyRow cols={3} text="Hali yangilanish yoʻq" />}
                {(events ?? []).map((e) => {
                  const o = (Array.isArray(e.orders) ? e.orders[0] : e.orders) as { id: string; number: number; tracking_number: string | null } | null;
                  return (
                    <tr key={e.id}>
                      <td>{o ? <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-primary">№{o.number}</Link> : '—'}<span className="block text-xs text-ink-3">{o?.tracking_number ?? ''}</span></td>
                      <td>{label(e.stage)}{e.note && <span className="block text-xs text-ink-3">{e.note}</span>}</td>
                      <td className="whitespace-nowrap text-ink-3">{formatDateTime(e.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Panel>
        </div>
        {ctx.permissions.has('settings.write') ? <CargoSettings initial={cfg} /> : <Panel title="Sozlamalar"><p className="text-sm text-ink-3">Bosqichlarni oʻzgartirish uchun “Sozlamalar” ruxsati kerak.</p></Panel>}
      </div>
    </div>
  );
}
