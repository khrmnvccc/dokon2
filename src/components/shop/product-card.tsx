'use client';

import Link from 'next/link';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import type { ProductCard as ProductCardType } from '@/lib/types';
import { discountPercent } from '@/lib/format';
import { useApp, useCart, useWishlist } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Rating } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { ProductImage } from './product-image';

export function ProductCard({ product, priority }: { product: ProductCardType; priority?: boolean }) {
  const { t, price } = useApp();
  const cart = useCart();
  const wishlist = useWishlist();
  const toast = useToast();
  const discount = discountPercent(product.price, product.compare_at_price);
  const outOfStock = product.track_stock && product.stock <= 0;
  const inCart = cart.has(product.id);
  const liked = wishlist.ids.has(product.id);
  const href = `/product/${product.slug}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <Link href={href} className="relative block aspect-square overflow-hidden" tabIndex={-1} aria-hidden>
        <ProductImage
          src={product.image_url}
          alt={product.name}
          priority={priority}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className={cn('transition duration-300 group-hover:scale-[1.04]', outOfStock && 'opacity-60')}
        />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {discount > 0 && <span className="rounded-lg bg-accent px-2 py-0.5 text-xs font-bold text-white">−{discount}%</span>}
          {product.is_new && <span className="rounded-lg bg-brand px-2 py-0.5 text-xs font-bold text-white">{t('product.new')}</span>}
          {product.is_bestseller && <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{t('product.hit')}</span>}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => wishlist.toggle(product.id)}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105"
        aria-label={liked ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga qo‘shish'}
        aria-pressed={liked}
      >
        <Heart className={cn('h-[18px] w-[18px]', liked ? 'fill-red-500 text-red-500' : 'text-slate-600')} />
      </button>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn('text-base font-extrabold sm:text-lg', discount > 0 ? 'text-accent' : 'text-ink')}>{price(product.price)}</span>
          {discount > 0 && <span className="text-xs text-muted line-through">{price(product.compare_at_price)}</span>}
        </div>
        <Link href={href} className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-700 hover:text-brand sm:text-sm">
          {product.name}
        </Link>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Rating value={Number(product.rating_avg)} count={product.rating_count} />
          {outOfStock ? (
            <span className="text-xs font-medium text-red-600">{t('product.outOfStock')}</span>
          ) : product.track_stock && product.stock <= 5 ? (
            <span className="text-xs font-medium text-amber-600">{t('product.lowStock', { n: product.stock })}</span>
          ) : null}
        </div>
        <div className="mt-auto pt-2.5">
          {product.has_variants ? (
            <Link href={href} className="flex h-10 w-full items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700 hover:bg-brand-100">
              {t('product.choose')}
            </Link>
          ) : (
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => {
                cart.add(product.id, null, 1);
                toast(`${product.name.slice(0, 40)} — savatchaga qo‘shildi`);
              }}
              className={cn(
                'flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400',
                inCart ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-brand text-white hover:bg-brand-600',
              )}
            >
              {inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {outOfStock ? t('product.outOfStock') : inCart ? t('product.inCart') : t('product.addToCart')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardType[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

export function ProductRail({ products }: { products: ProductCardType[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="skeleton aspect-square" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-5 w-2/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-9 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
