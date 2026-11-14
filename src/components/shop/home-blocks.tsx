import { getL } from '@/lib/i18n/server';
import Link from 'next/link';
import Image from 'next/image';
import type { Category, ProductCard } from '@/lib/types';
import type { SiteSettings } from '@/lib/settings-schema';
import { SectionHeader } from '@/components/ui/misc';
import { DynamicIcon } from './dynamic-icon';
import { ProductRail } from './product-card';
import { isUnoptimizable } from './product-image';

export async function CategoryGrid({ categories, title }: { categories: Category[]; title: string }) {
  const L = await getL();
  if (!categories.length) return null;
  return (
    <section>
      <SectionHeader title={title} href="/catalog" linkText={L("Barchasi")} />
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 md:grid-cols-6 lg:grid-cols-9">
        {categories.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} className="group flex w-24 shrink-0 flex-col items-center gap-2 rounded-xl border border-line bg-surface p-3 text-center shadow-soft anim-rise transition-colors hover:bg-surface-2 sm:w-auto">
            <span className="relative flex size-14 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-ink-2">
              {c.image_url ? (
                <Image src={c.image_url} alt="" fill sizes="64px" className="object-cover" unoptimized={isUnoptimizable(c.image_url)} />
              ) : (
                <DynamicIcon name={c.icon} className="size-6" />
              )}
            </span>
            <span className="line-clamp-2 text-xs font-medium leading-tight text-ink">{c.name}</span>
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
          <div key={a.title} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-soft anim-rise">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-primary">
              <DynamicIcon name={a.icon} className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-tight">{a.title}</div>
              <div className="text-[13px] text-ink-3">{a.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
