import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { buildHref, pageParam } from '@/lib/admin/query';
import { formatDateTime } from '@/lib/format';
import { Pagination, Stars, Badge } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { PageHeader } from '@/components/admin/ui';
import { ReviewActions, ReviewReply } from '@/components/admin/review-actions';

export const metadata = { title: 'Sharhlar' };
const PAGE = 20;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; rating?: string; page?: string }> }) {
  await requirePagePermission('reviews.moderate');
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await getServerSupabase();
  let q = supabase.from('reviews').select('id, rating, body, author_name, is_approved, created_at, product_id, reply, products(name, slug)', { count: 'exact' });
  if (sp.status === 'hidden') q = q.eq('is_approved', false);
  if (sp.status === 'visible') q = q.eq('is_approved', true);
  if (sp.rating && /^[1-5]$/.test(sp.rating)) q = q.eq('rating', Number(sp.rating));
  const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const tabs = [{ k: undefined, l: 'Barchasi' }, { k: 'visible', l: 'Ko‘rinadigan' }, { k: 'hidden', l: 'Yashirilgan' }];
  return (
    <div>
      <PageHeader title="Sharhlar" description="Sharhlar darhol chiqadi. Javob yozing — u sharh ostida “Doʻkon javobi” boʻlib chiqadi va mijozga xabar boradi." />
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.l} href={buildHref('/admin/reviews', sp, { status: t.k ?? null, page: null })} className={cn('rounded-full px-3 py-1.5 text-sm font-medium', sp.status === t.k ? 'bg-primary text-primary-fg shadow-soft' : 'bg-surface ring-1 ring-line')}>{t.l}</Link>
        ))}
        {[1, 2, 3, 4, 5].map((r) => (
          <Link key={r} href={buildHref('/admin/reviews', sp, { rating: sp.rating === String(r) ? null : r, page: null })} className={cn('rounded-full px-3 py-1.5 text-sm font-medium', sp.rating === String(r) ? 'bg-warn text-white' : 'bg-surface ring-1 ring-line')}>{r}★</Link>
        ))}
      </div>
      <ul className="space-y-3">
        {(data ?? []).length === 0 && <li className="rounded-xl border border-line bg-surface p-10 text-center text-ink-3">Sharh yo‘q</li>}
        {(data ?? []).map((r) => {
          const product = (Array.isArray(r.products) ? r.products[0] : r.products) as { name: string; slug: string } | null;
          return (
            <li key={r.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Stars value={r.rating} /> <span className="text-sm font-semibold">{r.author_name ?? 'Xaridor'}</span> {!r.is_approved && <Badge>Yashirilgan</Badge>}</div>
                  {product && <Link href={`/product/${product.slug}`} target="_blank" className="text-xs text-primary">{product.name}</Link>}
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{r.body || <i className="text-ink-3">Matnsiz</i>}</p>
                  <p className="mt-1 text-xs text-ink-3">{formatDateTime(r.created_at)}</p>
                  <ReviewReply id={r.id} reply={r.reply as string | null} />
                </div>
                <ReviewActions id={r.id} approved={r.is_approved} />
              </div>
            </li>
          );
        })}
      </ul>
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} makeHref={(p) => buildHref('/admin/reviews', sp, { page: p })} />
    </div>
  );
}
