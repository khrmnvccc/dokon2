import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseSettings } from '@/lib/settings-schema';
import { formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { IMPORT_STATUSES, importStatusLabel, importStatusTone, linkHost, type ImportRequestRow, type ImportStatus } from '@/lib/import-requests';
import { PageHeader, Panel, Table, EmptyRow } from '@/components/admin/ui';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { ImportSettings } from '@/components/admin/import-settings';

export const metadata = { title: 'Buyurtma asosida' };

export default async function ImportRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requirePagePermission('orders.read');
  const sp = await searchParams;
  const status = IMPORT_STATUSES.includes(sp.status as ImportStatus) ? (sp.status as ImportStatus) : null;
  const supabase = await getServerSupabase();
  let q = supabase.from('import_requests').select('id, number, customer_name, customer_phone, title, links, images, quantity, status, quote, created_at').order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  const [{ data }, { data: counts }, { data: setRows }] = await Promise.all([
    q,
    supabase.from('import_requests').select('status').in('status', ['new', 'quoted']).limit(5000),
    supabase.from('site_settings').select('key, value').eq('key', 'import_requests'),
  ]);
  const rows = (data ?? []) as ImportRequestRow[];
  const open = { new: 0, quoted: 0 } as Record<string, number>;
  for (const c of counts ?? []) open[c.status as string] = (open[c.status as string] ?? 0) + 1;
  const tabs: (ImportStatus | null)[] = [null, ...IMPORT_STATUSES];
  return (
    <div>
      <PageHeader title="Buyurtma asosida (Xitoydan)" description="Mijozlar havola yoki rasm yuboradi — siz narx berasiz, mijoz rozi boʻlsa buyurtma oʻzi yaratiladi" />
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <Link key={t ?? 'all'} href={t ? `?status=${t}` : '?'} className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium', status === t ? 'bg-primary text-primary-fg' : 'bg-surface text-ink-2 shadow-soft')}>
            {t ? importStatusLabel[t] : 'Barchasi'}{t && open[t] ? <span className="num text-[11px] opacity-80">{open[t]}</span> : null}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_400px] xl:items-start">
        <Panel padded={false}>
          <Table>
            <thead><tr><th>№</th><th>Mijoz</th><th>Mahsulot</th><th className="text-right">Narx</th><th>Holat</th></tr></thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={5} text="Soʻrovlar yoʻq" />}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/admin/import-requests/${r.id}`} className="font-medium text-primary">№{r.number}</Link><span className="block text-xs text-ink-3">{formatDateTime(r.created_at)}</span></td>
                  <td>{r.customer_name}<span className="block text-xs text-ink-3">{formatUzPhone(r.customer_phone)}</span></td>
                  <td className="max-w-64"><span className="block truncate">{r.title || r.links.map(linkHost).join(', ') || 'Rasm boʻyicha'}</span><span className="text-xs text-ink-3">{r.quantity} dona{r.images.length ? ` · ${r.images.length} rasm` : ''}</span></td>
                  <td className="text-right tabular-nums">{r.quote ? formatPrice(r.quote.total) : '—'}</td>
                  <td><Badge tone={importStatusTone[r.status]}>{importStatusLabel[r.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <ImportSettings initial={parseSettings(setRows ?? []).import_requests} canEdit={ctx.permissions.has('settings.write')} />
      </div>
    </div>
  );
}
