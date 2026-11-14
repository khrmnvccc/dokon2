import { getL } from '@/lib/i18n/server';
import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';
import Image from 'next/image';
import type { Category, ProductCard } from '@/lib/types';
import type { SectionSize, SiteSettings } from '@/lib/settings-schema';
import { SectionHeader } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { DynamicIcon } from './dynamic-icon';
import { ProductRail } from './product-card';
import { ReviewCard } from './review-card';
import type { PublicReview, ReviewStats } from '@/lib/data/public';
import { isUnoptimizable } from './product-image';

export async function CategoryGrid({ categories, title, size = 'md' }: { categories: Category[]; title: string; size?: SectionSize }) {
  const L = await getL();
  if (!categories.length) return null;
  return (
    <section>
      <SectionHeader title={title} href="/catalog" linkText={L("Barchasi")} />
      <div className={cn('no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:overflow-visible sm:px-0', size === 'sm' ? 'sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12' : size === 'lg' ? 'sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6' : 'sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9')}>
        {categories.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} className={cn('group flex shrink-0 flex-col items-center gap-2 rounded-[20px] p-1.5 text-center anim-rise transition sm:w-auto', size === 'sm' ? 'w-[72px]' : size === 'lg' ? 'w-[104px]' : 'w-[88px]')}>
            <span className={cn('relative flex items-center justify-center overflow-hidden border border-line/70 bg-gradient-to-br from-surface to-surface-2 text-primary shadow-soft transition duration-300 group-hover:-translate-y-0.5', size === 'sm' ? 'size-14 rounded-[18px]' : size === 'lg' ? 'size-[88px] rounded-[26px]' : 'size-[68px] rounded-[22px]')}>
              {c.image_url ? (
                <Image src={c.image_url} alt="" fill sizes="64px" className="object-cover" unoptimized={isUnoptimizable(c.image_url)} />
              ) : (
                <DynamicIcon name={c.icon} className="size-6" />
              )}
            </span>
            <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-ink">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export async function ProductSection({ title, products, href, size = 'md' }: { title: string; products: ProductCard[]; href: string; size?: SectionSize }) {
  const L = await getL();
  if (!products.length) return null;
  return (
    <section>
      <SectionHeader title={title} href={href} linkText={L("Barchasi")} />
      <ProductRail products={products} size={size} />
    </section>
  );
}

export function Advantages({ items, title, size = 'md' }: { items: SiteSettings['advantages']; title: string; size?: SectionSize }) {
  if (!items.length) return null;
  if (size === 'sm') {
    return (
      <section aria-label={title} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
        {items.map((a) => (
          <span key={a.title} className="flex shrink-0 items-center gap-2 rounded-full border border-line/70 bg-surface py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold shadow-soft">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-primary"><DynamicIcon name={a.icon} className="size-4" /></span>
            {a.title}
          </span>
        ))}
      </section>
    );
  }
  const lg = size === 'lg';
  return (
    <section aria-label={title}>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {items.map((a) => (
          <div key={a.title} className={cn('flex flex-col items-start gap-2.5 rounded-[22px] border border-line/70 bg-surface shadow-soft anim-rise', lg ? 'p-5 sm:p-6' : 'p-3.5 sm:flex-row sm:items-center sm:gap-3 sm:p-4')}>
            <span className={cn('flex shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary', lg ? 'size-12 sm:size-14' : 'size-10 sm:size-11')}>
              <DynamicIcon name={a.icon} className={lg ? 'size-6' : 'size-5'} />
            </span>
            <div className="min-w-0">
              <div className={cn('font-semibold leading-snug tracking-tight', lg ? 'text-base sm:text-lg' : 'text-sm sm:text-[15px]')}>{a.title}</div>
              <div className={cn('mt-0.5 leading-snug text-ink-3', lg ? 'text-[13px] sm:text-sm' : 'text-xs sm:text-[13px]')}>{a.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Bosh sahifa: “Mijozlar fikri” — umumiy baho va oxirgi matnli sharhlar (gorizontal lenta). */
export async function ReviewsSection({ title, reviews, stats, size = 'md' }: { title: string; reviews: PublicReview[]; stats: ReviewStats; size?: SectionSize }) {
  const L = await getL();
  if (!reviews.length || size === 'sm') {
    // Ixcham koʻrinish (yoki hali sharh yoʻq): bitta qator — umumiy baho va havola.
    return (
      <section>
        <Link href={stats.count ? '/reviews' : '/account/orders?status=delivered'} className="flex items-center gap-3 rounded-[22px] border border-line/70 bg-surface p-3.5 shadow-soft transition hover:bg-surface-2">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--yandex)_18%,transparent)] text-[var(--yandex)]"><Star className="size-5 fill-current" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold tracking-tight">{title}</span>
            <span className="block text-[13px] text-ink-3">{stats.count ? `${stats.avg.toFixed(1)} ★ · ${stats.count} ${L("ta sharh")}` : L("Xarid qilgan mahsulotingizga baho bering — fikringiz boshqalarga yordam beradi")}</span>
          </span>
          {reviews.length > 0 && (
            <span className="hidden -space-x-2 sm:flex">
              {reviews.slice(0, 4).map((r) => (
                <span key={r.id} className="flex size-8 items-center justify-center rounded-full border-2 border-surface bg-primary-soft text-xs font-semibold text-primary">{(r.author_name?.trim() || 'X').charAt(0).toUpperCase()}</span>
              ))}
            </span>
          )}
          <ChevronRight className="size-5 shrink-0 text-ink-3" />
        </Link>
      </section>
    );
  }
  const lg = size === 'lg';
  return (
    <section>
      <SectionHeader title={title} href="/reviews" linkText={stats.count ? `${stats.avg.toFixed(1)} ★ · ${L("Barchasi")}` : L("Barchasi")} />
      <div className={cn('no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0', lg ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-4')}>
        {reviews.slice(0, lg ? 6 : 4).map((r, i) => (
          <div key={r.id} className={cn('shrink-0 snap-start sm:w-auto', lg ? 'w-[82%]' : 'w-[68%]', !lg && i === 3 && 'sm:hidden lg:block', lg && i >= 4 && 'sm:hidden lg:block')}>
            <ReviewCard review={r} buyerLabel={L("Xaridor")} replyLabel={L("Doʻkon javobi")} clamp compact={!lg} />
          </div>
        ))}
      </div>
    </section>
  );
}
