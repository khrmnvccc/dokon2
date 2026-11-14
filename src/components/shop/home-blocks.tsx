import { getL } from '@/lib/i18n/server';
import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';
import Image from 'next/image';
import type { Category, ProductCard } from '@/lib/types';
import type { SiteSettings } from '@/lib/settings-schema';
import { SectionHeader } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { DynamicIcon } from './dynamic-icon';
import { ProductRail } from './product-card';
import { ReviewCard, ReviewSummary } from './review-card';
import type { PublicReview, ReviewStats } from '@/lib/data/public';
import { isUnoptimizable } from './product-image';

export async function CategoryGrid({ categories, title }: { categories: Category[]; title: string }) {
  const L = await getL();
  if (!categories.length) return null;
  return (
    <section>
      <SectionHeader title={title} href="/catalog" linkText={L("Barchasi")} />
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 md:grid-cols-6 lg:grid-cols-9">
        {categories.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} className="group flex w-[88px] shrink-0 flex-col items-center gap-2 rounded-[20px] p-1.5 text-center anim-rise transition sm:w-auto">
            <span className="relative flex size-[68px] items-center justify-center overflow-hidden rounded-[22px] border border-line/70 bg-gradient-to-br from-surface to-surface-2 text-primary shadow-soft transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lg)]">
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

export async function ProductSection({ title, products, href }: { title: string; products: ProductCard[]; href: string }) {
  const L = await getL();
  if (!products.length) return null;
  return (
    <section>
      <SectionHeader title={title} href={href} linkText={L("Barchasi")} />
      <ProductRail products={products} />
    </section>
  );
}

export function Advantages({ items, title }: { items: SiteSettings['advantages']; title: string }) {
  if (!items.length) return null;
  return (
    <section aria-label={title}>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {items.map((a) => (
          <div key={a.title} className="flex flex-col items-start gap-2.5 rounded-[22px] border border-line/70 bg-surface p-3.5 shadow-soft anim-rise sm:flex-row sm:items-center sm:gap-3 sm:p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary sm:size-11">
              <DynamicIcon name={a.icon} className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-snug tracking-tight sm:text-[15px]">{a.title}</div>
              <div className="mt-0.5 text-xs leading-snug text-ink-3 sm:text-[13px]">{a.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Bosh sahifa: “Mijozlar fikri” — umumiy baho va oxirgi matnli sharhlar (gorizontal lenta). */
export async function ReviewsSection({ title, reviews, stats }: { title: string; reviews: PublicReview[]; stats: ReviewStats }) {
  const L = await getL();
  if (!reviews.length) {
    // Hali sharh yoʻq: blok baribir koʻrinadi — xaridorlarni baho berishga chaqiradi.
    return (
      <section>
        <Link href={stats.count ? '/reviews' : '/account/orders?status=delivered'} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-soft transition hover:shadow-[var(--shadow-lg)]">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--yandex)_18%,transparent)] text-[var(--yandex)]"><Star className="size-5 fill-current" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold tracking-tight">{title}</span>
            <span className="block text-[13px] text-ink-3">{stats.count ? `${stats.avg.toFixed(1)} ★ · ${stats.count} ${L("ta sharh")}` : L("Xarid qilgan mahsulotingizga baho bering — fikringiz boshqalarga yordam beradi")}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-ink-3" />
        </Link>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader title={title} href="/reviews" linkText={L("Barchasi")} />
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        <div className="w-[55%] shrink-0 snap-start sm:hidden lg:block lg:w-auto">
          <Link href="/reviews" className="block h-full [&>div]:h-full [&>div]:justify-center"><ReviewSummary stats={stats} countLabel={`${stats.count} ${L("ta sharh")}`} compact /></Link>
        </div>
        {reviews.slice(0, 6).map((r, i) => (
          <div key={r.id} className={cn('w-[80%] shrink-0 snap-start', i < 2 ? 'sm:w-auto' : i === 2 ? 'sm:hidden lg:block lg:w-auto' : 'sm:hidden')}>
            <ReviewCard review={r} buyerLabel={L("Xaridor")} replyLabel={L("Doʻkon javobi")} clamp />
          </div>
        ))}
      </div>
    </section>
  );
}
