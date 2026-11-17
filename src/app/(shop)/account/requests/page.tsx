import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Globe } from 'lucide-react';
import { getL } from '@/lib/i18n/server';
import { getCurrentProfile, requireUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { importStatusLabel, importStatusTone, linkHost, type ImportRequestRow } from '@/lib/import-requests';
import { Badge } from '@/components/ui/misc';
import { ImportRequestForm } from '@/components/import/request-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Xitoydan buyurtma' };

export default async function RequestsPage() {
  const L = await getL();
  const user = await requireUser('/account/requests');
  const [settings, profile, supabase] = await Promise.all([getSettings(), getCurrentProfile(), getServerSupabase()]);
  const cfg = settings.import_requests;
  if (!cfg.enabled) notFound();
  const { data } = await supabase.from('import_requests')
    .select('id, number, title, links, images, quantity, status, quote, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  const rows = (data ?? []) as Pick<ImportRequestRow, 'id' | 'number' | 'title' | 'links' | 'images' | 'quantity' | 'status' | 'quote' | 'created_at'>[];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Globe className="size-5 text-primary" /> {L(cfg.title)}</h1>
        <p className="mt-1 text-sm text-ink-3">{L('Kelish muddati')}: {cfg.default_days}</p>
      </div>
      <ImportRequestForm intro={cfg.intro} name={profile?.full_name ?? ''} phone={profile?.phone ? formatUzPhone(profile.phone) : ''} />
      {rows.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">{L('Mening soʻrovlarim')}</h2>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/account/requests/${r.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-soft transition hover:shadow-pop">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">№{r.number} · {r.title || r.links.map(linkHost).join(', ') || L('Rasm boʻyicha')}</p>
                    <p className="mt-0.5 text-xs text-ink-3">{formatDateTime(r.created_at)} · {r.quantity} {L('dona')}{r.images.length ? ` · ${r.images.length} ${L('rasm')}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={importStatusTone[r.status]}>{L(importStatusLabel[r.status])}</Badge>
                    {r.quote && r.status === 'quoted' && <p className="num mt-1 text-sm font-semibold">{formatPrice(r.quote.total)}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
