import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getRawSettings } from '@/lib/data/public';
import { formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { importStatusLabel, importStatusTone, linkHost, type ImportRequestRow } from '@/lib/import-requests';
import { signImages } from '@/lib/import-requests-server';
import { PageHeader, Panel } from '@/components/admin/ui';
import { Badge } from '@/components/ui/misc';
import { ImportQuoteForm } from '@/components/admin/import-quote';

export const metadata = { title: 'Soʻrov' };

export default async function ImportRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission('orders.read');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('import_requests').select('*').eq('id', id).maybeSingle();
  const r = data as ImportRequestRow | null;
  if (!r) notFound();
  const [images, settings, { data: order }] = await Promise.all([
    process.env.SUPABASE_SERVICE_ROLE_KEY ? signImages(r.images) : Promise.resolve([]),
    getRawSettings(),
    r.order_id ? supabase.from('orders').select('number, status, payment_status').eq('id', r.order_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const cfg = settings.import_requests;
  return (
    <div>
      <Link href="/admin/import-requests" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ChevronLeft className="size-4" />Barcha soʻrovlar</Link>
      <PageHeader title={`Soʻrov №${r.number}`} description={`${formatDateTime(r.created_at)} · ${r.customer_name} · ${formatUzPhone(r.customer_phone)}`}
        actions={<Badge tone={importStatusTone[r.status]}>{importStatusLabel[r.status]}</Badge>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_440px] xl:items-start">
        <div className="space-y-4">
          <Panel title="Mijoz soʻrovi">
            {r.title && <p className="mb-2 font-medium">{r.title}</p>}
            <p className="mb-3 text-sm text-ink-3">Soni: <b className="text-ink">{r.quantity} dona</b></p>
            {r.links.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {r.links.map((l) => (
                  <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"><ExternalLink className="size-3.5 shrink-0" /><b>{linkHost(l)}</b><span className="truncate">{l}</span></a></li>
                ))}
              </ul>
            )}
            {images.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt="" className="size-32 rounded-xl border border-line object-cover" /></a>
                ))}
              </div>
            )}
            {r.description && <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{r.description}</p>}
          </Panel>
          {r.status === 'accepted' && r.order_id && (
            <Panel title="Buyurtma">
              <Link href={`/admin/orders/${r.order_id}`} className="font-medium text-primary">№{order?.number ?? ''} — buyurtmani ochish →</Link>
              <p className="mt-1 text-sm text-ink-3">Mijoz {r.quote ? formatPrice(r.quote.total) : ''} narxga rozi boʻldi. Endi oddiy buyurtma kabi (toʻlov, kargo, yetkazish) boshqariladi.</p>
            </Panel>
          )}
          {r.status === 'rejected' && <Panel title="Rad etildi"><p className="text-sm">{r.reject_reason}</p></Panel>}
        </div>
        <ImportQuoteForm id={r.id} status={r.status} quantity={r.quantity} quote={r.quote} staffNote={r.staff_note ?? ''} title={r.title ?? ''}
          canEdit={ctx.permissions.has('orders.write')} rate={cfg.cny_rate} servicePercent={cfg.service_percent} defaultDays={cfg.default_days} />
      </div>
    </div>
  );
}
