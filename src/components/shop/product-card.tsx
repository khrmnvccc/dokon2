'use client';

import Link from 'next/link';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import type { ProductCard as ProductCardType } from '@/lib/types';
import { discountPercent } from '@/lib/format';
import { useApp, useCart, useWishlist, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Rating } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { ProductImage } from './product-image';

export function ProductCard({ product, priority }: { product: ProductCardType; priority?: boolean }) {
  const L = useL();
  const { t, price } = useApp();
  const cart = useCart();
  const wishlist = useWishlist();
  const toast = useToast();
  const discount = discountPercent(product.price, product.compare_at_price);
  const outOfStock = product.track_stock && product.stock <= 0;
  const inCart = cart.has(product.id);
  const liked = wishlist.ids.has(product.id);
  const href = `/product/${product.slug}`;

  // Kassa 1.13: Card uslubi (rounded-xl, shisha, shadow-soft), rasm tepada (aspect-square, rounded-lg),
  // nom 15px, narx katta .num, "Savatga" primary tugma.
  return (
    <article className="group relative flex flex-col rounded-xl border border-line bg-surface p-2 shadow-soft anim-rise sm:p-2.5">
      <Link href={href} className="relative block aspect-square overflow-hidden rounded-lg bg-surface-2" tabIndex={-1} aria-hidden>
        <ProductImage
          src={product.image_url}
          alt={product.name}
          priority={priority}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className={cn('transition duration-300 group-hover:scale-[1.03]', outOfStock && 'opacity-60')}
        />
        {/* Koʻpi bilan 2 ta belgi, bir qatorda: chegirma + (Xit yoki Yangi) — rasm ustida tartibsizlik boʻlmasin */}
        <div className="absolute left-1.5 right-10 top-1.5 flex flex-wrap items-start gap-1">
          {discount > 0 && <span className="rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-semibold text-white num sm:text-xs">−{discount}%</span>}
          {product.is_bestseller ? (
            <span className="rounded-full bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-bg sm:text-xs">{t('product.hit')}</span>
          ) : product.is_new ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-fg sm:text-xs">{t('product.new')}</span>
          ) : null}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => wishlist.toggle(product.id)}
        className="absolute right-3.5 top-3.5 flex size-8 items-center justify-center rounded-full border border-line bg-surface glass transition-transform active:scale-95"
        aria-label={liked ? L("Sevimlilardan olib tashlash") : L("Sevimlilarga qoʻshish")}
        aria-pressed={liked}
      >
        <Heart className={cn('size-4', liked ? 'fill-danger text-danger' : 'text-ink-2')} />
      </button>

      <div className="flex flex-1 flex-col px-1 pb-0.5 pt-2.5 sm:px-1.5">
        <Link href={href} className="line-clamp-2 text-[13px] font-medium leading-snug text-ink hover:text-primary sm:text-[15px]">
          {product.name}
        </Link>
        <div className="mt-1 flex min-h-[18px] items-center justify-between gap-2">
          {product.rating_count > 0 ? <Rating value={Number(product.rating_avg)} count={product.rating_count} /> : <span />}
          {outOfStock ? (
            <span className="text-xs font-medium text-danger">{t('product.outOfStock')}</span>
          ) : product.track_stock && product.stock <= 5 ? (
            <span className="text-xs font-medium text-warn">{t('product.lowStock', { n: product.stock })}</span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold tracking-tight text-ink num sm:text-lg">{price(product.price)}</span>
          {discount > 0 && <span className="text-xs text-ink-3 line-through num">{price(product.compare_at_price)}</span>}
        </div>
        <div className="mt-auto pt-2.5">
          {product.has_variants ? (
            <Link href={href} className="flex h-9 w-full items-center justify-center rounded-lg border border-line bg-surface text-sm font-medium text-ink shadow-soft transition-all hover:bg-surface-2 active:scale-[0.98]">
              {t('product.choose')}
            </Link>
          ) : (
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => {
                cart.add(product.id, null, 1);
                toast(`${product.name.slice(0, 40)} — savatga qoʻshildi`);
              }}
              className={cn(
                'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium shadow-soft transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
                inCart ? 'bg-success-soft text-success' : 'bg-primary text-primary-fg hover:opacity-90',
              )}
            >
              {inCart ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
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
        <div key={i} className="rounded-xl border border-line bg-surface p-2 shadow-soft sm:p-2.5">
          <div className="skeleton aspect-square !rounded-lg" />
          <div className="space-y-2 px-1 pt-3">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-9 w-full !rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
