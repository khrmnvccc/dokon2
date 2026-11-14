import Link from 'next/link';
import Image from 'next/image';
import { Quote } from 'lucide-react';
import type { PublicReview, ReviewStats } from '@/lib/data/public';
import { formatDate } from '@/lib/format';
import { Stars } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { isUnoptimizable } from './product-image';

/** Bitta sharh kartasi: muallif, yulduzlar, matn va qaysi mahsulotga yozilgani. */
export function ReviewCard({ review, buyerLabel, replyLabel = 'Doʻkon javobi', className, clamp, compact }: { review: PublicReview; buyerLabel: string; replyLabel?: string; className?: string; clamp?: boolean; compact?: boolean }) {
  const name = review.author_name?.trim() || buyerLabel;
  return (
    <article className={cn('flex h-full flex-col rounded-[22px] border border-line/70 bg-surface shadow-soft', compact ? 'p-3' : 'p-4', className)}>
      <div className="flex items-center gap-3">
        <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary', compact ? 'size-7 text-xs' : 'size-9 text-sm')}>{name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-semibold text-ink', compact ? 'text-[13px]' : 'text-sm')}>{name}</p>
          <time className={cn('text-ink-3', compact ? 'text-[11px]' : 'text-xs')} dateTime={review.created_at}>{formatDate(review.created_at)}</time>
        </div>
        <Stars value={review.rating} className={cn('shrink-0', compact ? '[&_svg]:size-3' : '[&_svg]:size-3.5')} />
      </div>
      {review.body ? (
        <p className={cn('whitespace-pre-line leading-relaxed text-ink-2', compact ? 'mb-2 mt-2 text-[13px]' : 'mb-3 mt-3 text-sm', clamp && (compact ? 'line-clamp-2' : 'line-clamp-4'))}>
          <Quote className="mr-1 inline size-3.5 -translate-y-0.5 text-ink-3" aria-hidden />{review.body}
        </p>
      ) : <div className={compact ? 'h-2' : 'h-3'} />}
      {review.reply && !compact && (
        <div className="mb-3 rounded-lg border-l-2 border-primary bg-primary-soft/40 px-3 py-2 text-[13px]">
          <p className="text-[11px] font-semibold text-primary">{replyLabel}</p>
          <p className={cn('whitespace-pre-line text-ink-2', clamp && 'line-clamp-3')}>{review.reply}</p>
        </div>
      )}
      {review.product && (
        <Link href={`/product/${review.product.slug}`} className={cn('mt-auto flex items-center gap-2.5 border-t border-line text-ink-2 hover:text-primary', compact ? 'pt-2 text-[12px]' : 'pt-3 text-[13px]')}>
          <span className={cn('relative shrink-0 overflow-hidden rounded-lg bg-surface-2', compact ? 'size-6' : 'size-9')}>
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
