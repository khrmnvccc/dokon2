import Link from 'next/link';
import Image from 'next/image';
import { Quote } from 'lucide-react';
import type { PublicReview, ReviewStats } from '@/lib/data/public';
import { formatDate } from '@/lib/format';
import { Stars } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { isUnoptimizable } from './product-image';

/** Bitta sharh kartasi: muallif, yulduzlar, matn va qaysi mahsulotga yozilgani. */
export function ReviewCard({ review, buyerLabel, className, clamp }: { review: PublicReview; buyerLabel: string; className?: string; clamp?: boolean }) {
  const name = review.author_name?.trim() || buyerLabel;
  return (
    <article className={cn('flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-soft', className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <time className="text-xs text-ink-3" dateTime={review.created_at}>{formatDate(review.created_at)}</time>
        </div>
        <Stars value={review.rating} className="shrink-0 [&_svg]:size-3.5" />
      </div>
      {review.body ? (
        <p className={cn('mb-3 mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-2', clamp && 'line-clamp-4')}>
          <Quote className="mr-1 inline size-3.5 -translate-y-0.5 text-ink-3" aria-hidden />{review.body}
        </p>
      ) : <div className="h-3" />}
      {review.product && (
        <Link href={`/product/${review.product.slug}`} className="mt-auto flex items-center gap-2.5 border-t border-line pt-3 text-[13px] text-ink-2 hover:text-primary">
          <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            {review.product.image_url && <Image src={review.product.image_url} alt="" fill sizes="36px" className="object-cover" unoptimized={isUnoptimizable(review.product.image_url)} />}
          </span>
          <span className="line-clamp-1 font-medium">{review.product.name}</span>
        </Link>
      )}
    </article>
  );
}

/** Umumiy baho: katta raqam, yulduzlar va har bir yulduz boʻyicha chiziq. */
export function ReviewSummary({ stats, countLabel, compact }: { stats: ReviewStats; countLabel: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-5 rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-5', compact && 'p-3 sm:p-4')}>
      <div className="shrink-0 text-center">
        <div className="text-4xl font-semibold tracking-tight text-ink num">{stats.avg.toFixed(1)}</div>
        <Stars value={stats.avg} className="mt-1 justify-center [&_svg]:size-3.5" />
        <div className="mt-1 text-xs text-ink-3 num">{countLabel}</div>
      </div>
      {!compact && (
        <ul className="min-w-0 flex-1 space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((n) => {
            const pct = stats.count ? Math.round((stats.stars[n] / stats.count) * 100) : 0;
            return (
              <li key={n} className="flex items-center gap-2 text-xs text-ink-3">
                <span className="w-3 text-right num">{n}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-[var(--yandex)]" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-8 text-right num">{stats.stars[n]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
