import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquareText } from 'lucide-react';
import { getL } from '@/lib/i18n/server';
import { getReviewStats, getReviewsPage } from '@/lib/data/public';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { ReviewCard, ReviewSummary } from '@/components/shop/review-card';
import { EmptyState, Pagination } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Mijozlar fikri', description: 'Xaridorlarimizning mahsulotlar haqidagi sharhlari va baholari', alternates: { canonical: '/reviews' } };

const PER_PAGE = 18;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const L = await getL();
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const [stats, { items, total }] = await Promise.all([getReviewStats(), getReviewsPage(page, PER_PAGE)]);

  return (
    <>
      <Breadcrumbs items={[{ name: L('Mijozlar fikri') }]} />
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight sm:text-3xl">{L('Mijozlar fikri')}</h1>
      {stats.count === 0 ? (
        <EmptyState
          icon={<MessageSquareText className="size-6" />}
          title={L('Hali sharhlar yoʻq')}
          text={L('Xarid qilgan mahsulotingiz sahifasida baho qoldiring — birinchi boʻling!')}
          action={<Link href="/catalog" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg">{L('Katalog')}</Link>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
          <div className="space-y-3 lg:sticky lg:top-24">
            <ReviewSummary stats={stats} countLabel={`${stats.count} ${L('ta sharh')}`} />
            <p className="px-1 text-[13px] text-ink-3">{L('Sharhlarni mahsulotni sotib olgan xaridorlar yozadi. Oʻz fikringizni mahsulot sahifasida qoldiring.')}</p>
          </div>
          <div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => <ReviewCard key={r.id} review={r} buyerLabel={L('Xaridor')} replyLabel={L('Doʻkon javobi')} />)}
            </div>
            <div className="mt-6">
              <Pagination page={page} total={total} pageSize={PER_PAGE} makeHref={(p) => (p === 1 ? '/reviews' : `/reviews?page=${p}`)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
