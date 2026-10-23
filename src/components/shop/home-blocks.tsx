import Link from 'next/link';
import Image from 'next/image';
import type { Category, ProductCard } from '@/lib/types';
import type { SiteSettings } from '@/lib/settings-schema';
import { SectionHeader } from '@/components/ui/misc';
import { DynamicIcon } from './dynamic-icon';
import { ProductRail } from './product-card';
import { isUnoptimizable } from './product-image';

export function CategoryGrid({ categories, title }: { categories: Category[]; title: string }) {
  if (!categories.length) return null;
  return (
    <section>
      <SectionHeader title={title} href="/catalog" />
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 md:grid-cols-6 lg:grid-cols-9">
        {categories.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} className="group flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center shadow-card transition hover:-translate-y-0.5 sm:w-auto">
            <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-brand">
              {c.image_url ? (
                <Image src={c.image_url} alt="" fill sizes="64px" className="object-cover" unoptimized={isUnoptimizable(c.image_url)} />
              ) : (
                <DynamicIcon name={c.icon} className="h-7 w-7" />
              )}
            </span>
            <span className="line-clamp-2 text-xs font-semibold leading-tight text-slate-700 group-hover:text-brand">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ProductSection({ title, products, href }: { title: string; products: ProductCard[]; href: string }) {
  if (!products.length) return null;
  return (
    <section>
      <SectionHeader title={title} href={href} />
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
          <div key={a.title} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <DynamicIcon name={a.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold">{a.title}</div>
              <div className="text-xs text-muted">{a.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
