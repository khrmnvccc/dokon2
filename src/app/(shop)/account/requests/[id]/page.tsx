import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { getL } from '@/lib/i18n/server';
import { requireUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getPaymentMethods } from '@/lib/data/public';
import { usablePaymentMethods } from '@/lib/payments';
import { formatDateTime, formatPrice } from '@/lib/format';
import { importStatusLabel, importStatusTone, linkHost, quoteExpired, type ImportRequestRow } from '@/lib/import-requests';
import { signImages } from '@/lib/import-requests-server';
import { Badge } from '@/components/ui/misc';
import { ImportAccept } from '@/components/import/accept';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Soʻrov' };

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const L = await getL();
  const user = await requireUser(`/account/requests/${id}`);
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('import_requests').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
  const r = data as ImportRequestRow | null;
  if (!r) notFound();
  const [images, methods] = await Promise.all([
    process.env.SUPABASE_SERVICE_ROLE_KEY ? signImages(r.images) : Promise.resolve([]),
    r.status === 'quoted' ? usablePaymentMethods(await getPaymentMethods()) : Promise.resolve([]),
  ]);
  const q = r.quote;
  const expired = quoteExpired(q);
  return (
    <div className="space-y-4">
      <Link href="/account/requests" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ChevronLeft className="size-4" />{L('Soʻrovlarim')}</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{L('Soʻrov')} №{r.number}</h1>
        <Badge tone={importStatusTone[r.status]}>{L(importStatusLabel[r.status])}</Badge>
      </div>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-soft">
        {r.title && <p className="font-medium">{r.title}</p>}
        <p className="text-sm text-ink-3">{formatDateTime(r.created_at)} · {r.quantity} {L('dona')}</p>
        {r.links.length > 0 && (
          <ul className="space-y-1">
            {r.links.map((l) => (
              <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"><ExternalLink className="size-3.5 shrink-0" /><span className="truncate">{linkHost(l)} · {l}</span></a></li>
            ))}
          </ul>
        )}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt="" className="size-24 rounded-xl border border-line object-cover" /></a>
            ))}
          </div>
        )}
        {r.description && <p className="whitespace-pre-line text-sm">{r.description}</p>}
      </section>

      {r.status === 'new' && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm">{L('Narxini hisoblayapmiz. Tayyor boʻlishi bilan doʻkon botiga va shu sahifaga yozamiz.')}</p>}
      {r.status === 'rejected' && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{L('Rad etildi')}{r.reject_reason ? `: ${r.reject_reason}` : ''}</p>}

      {q && (r.status === 'quoted' || r.status === 'accepted') && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <h2 className="mb-3 font-semibold">{L('Narx')}</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-ink-3">{q.name || r.title || L('Mahsulot')} × {r.quantity}</dt><dd className="num">{formatPrice(q.item_price * r.quantity)}</dd></div>
            {q.service_fee > 0 && <div className="flex justify-between gap-3"><dt className="text-ink-3">{L('Xizmat haqi')}</dt><dd className="num">{formatPrice(q.service_fee)}</dd></div>}
            {q.cargo_fee > 0 && <div className="flex justify-between gap-3"><dt className="text-ink-3">{L('Kargo (yetkazib kelish)')}</dt><dd className="num">{formatPrice(q.cargo_fee)}</dd></div>}
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-semibold"><dt>{L('Jami')}</dt><dd className="num">{formatPrice(q.total)}</dd></div>
          </dl>
          {q.days && <p className="mt-2 text-sm text-ink-3">{L('Kelish muddati')}: {q.days}</p>}
          {q.note && <p className="mt-2 whitespace-pre-line text-sm">{q.note}</p>}
          {r.status === 'quoted' && q.valid_until && <p className="mt-2 text-xs text-ink-3">{L('Narx amal qiladi')}: {formatDateTime(q.valid_until)} {L('gacha')}</p>}
          {r.status === 'accepted' && r.order_id && <Link href={`/account/orders/${r.order_id}`} className="mt-3 inline-block text-sm font-medium text-primary">{L('Buyurtmani ochish')} →</Link>}
        </section>
      )}

      {(r.status === 'new' || r.status === 'quoted') && (
        <ImportAccept id={r.id} canAccept={r.status === 'quoted' && !expired} expired={expired}
          methods={methods.filter((m) => !m.installment).map((m) => ({ id: m.id, name: m.name, description: m.description }))} />
      )}
    </div>
  );
}
