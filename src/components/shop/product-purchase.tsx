'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Minus, Plus, ShoppingCart, Truck, ShieldCheck } from 'lucide-react';
import type { ProductVariant } from '@/lib/types';
import { discountPercent } from '@/lib/format';
import { useApp, useCart, useWishlist } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';

interface Props {
  product: { id: string; name: string; price: number; compare_at_price: number | null; stock: number; track_stock: boolean; has_variants: boolean };
  variants: ProductVariant[];
  freeShippingFrom: number;
}

export function ProductPurchase({ product, variants, freeShippingFrom }: Props) {
  const { t, price } = useApp();
  const cart = useCart();
  const wishlist = useWishlist();
  const toast = useToast();
  const router = useRouter();
  const colors = useMemo(() => [...new Map(variants.filter((v) => v.color).map((v) => [v.color!, v.color_hex])).entries()], [variants]);
  const sizes = useMemo(() => [...new Set(variants.filter((v) => v.size).map((v) => v.size!))], [variants]);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0][0] : null);
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [plainVariant, setPlainVariant] = useState<string | null>(null);

  const usesAttributes = colors.length > 0 || sizes.length > 0;
  const variant = product.has_variants
    ? usesAttributes
      ? variants.find((v) => (colors.length ? v.color === color : true) && (sizes.length ? v.size === size : true)) ?? null
      : variants.find((v) => v.id === plainVariant) ?? null
    : null;

  const unitPrice = variant?.price ?? product.price;
  const compareAt = variant ? variant.compare_at_price : product.compare_at_price;
  const discount = discountPercent(unitPrice, compareAt);
  const available = product.has_variants ? (variant ? variant.stock : null) : product.track_stock ? product.stock : 999;
  const outOfStock = available !== null && available <= 0;
  const needsChoice = product.has_variants && !variant;
  const liked = wishlist.ids.has(product.id);

  const isAvailable = (c: string | null, s: string | null) =>
    variants.some((v) => (c === null || v.color === c) && (s === null || v.size === s) && v.stock > 0);

  const add = (goToCart: boolean) => {
    if (needsChoice) {
      toast('Iltimos, variantni tanlang', 'info');
      return;
    }
    cart.add(product.id, variant?.id ?? null, qty);
    if (goToCart) router.push('/cart');
    else toast('Savatchaga qo‘shildi');
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn('text-3xl font-extrabold', discount > 0 ? 'text-accent' : 'text-ink')}>{price(unitPrice)}</span>
          {discount > 0 && (
            <>
              <span className="text-lg text-muted line-through">{price(compareAt)}</span>
              <span className="rounded-lg bg-accent px-2 py-0.5 text-sm font-bold text-white">−{discount}%</span>
            </>
          )}
        </div>
        <p className={cn('mt-1.5 text-sm font-medium', outOfStock ? 'text-red-600' : available !== null && available <= 5 ? 'text-amber-600' : 'text-emerald-600')}>
          {needsChoice ? 'Variantni tanlang' : outOfStock ? t('product.outOfStock') : available !== null && available <= 5 ? t('product.lowStock', { n: available }) : t('product.inStock')}
        </p>
      </div>

      {colors.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Rang: <span className="font-normal text-muted">{color ?? 'tanlanmagan'}</span></legend>
          <div className="flex flex-wrap gap-2">
            {colors.map(([name, hex]) => (
              <button key={name} type="button" onClick={() => setColor(name)} aria-pressed={color === name}
                className={cn('flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm', color === name ? 'border-brand bg-brand-50' : 'border-line', !isAvailable(name, size) && 'opacity-45')}>
                <span className="h-5 w-5 rounded-full border border-slate-300" style={{ background: hex ?? '#ccc' }} />{name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {sizes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">O‘lcham: <span className="font-normal text-muted">{size ?? 'tanlanmagan'}</span></legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const ok = isAvailable(color, s);
              return (
                <button key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s} disabled={!ok}
                  className={cn('h-11 min-w-12 rounded-xl border-2 px-3 text-sm font-semibold', size === s ? 'border-brand bg-brand-50' : 'border-line', !ok && 'cursor-not-allowed line-through opacity-40')}>
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {product.has_variants && !usesAttributes && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Variant</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button key={v.id} type="button" onClick={() => setPlainVariant(v.id)} disabled={v.stock <= 0} aria-pressed={plainVariant === v.id}
                className={cn('rounded-xl border-2 px-3 py-2 text-sm', plainVariant === v.id ? 'border-brand bg-brand-50' : 'border-line', v.stock <= 0 && 'opacity-40')}>
                {v.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-12 items-center rounded-xl border border-line bg-white">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-12 w-11 items-center justify-center text-slate-600 disabled:opacity-40" disabled={qty <= 1} aria-label="Kamaytirish"><Minus className="h-4 w-4" /></button>
          <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(available ?? 99, q + 1))} className="flex h-12 w-11 items-center justify-center text-slate-600 disabled:opacity-40" disabled={available !== null && qty >= available} aria-label="Ko‘paytirish"><Plus className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={() => wishlist.toggle(product.id)} className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white" aria-label="Sevimlilar" aria-pressed={liked}>
          <Heart className={cn('h-5 w-5', liked ? 'fill-red-500 text-red-500' : 'text-slate-600')} />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={() => add(false)} disabled={outOfStock}>
          <ShoppingCart className="h-5 w-5" /> {t('product.addToCart')}
        </Button>
        <Button size="lg" variant="accent" onClick={() => add(true)} disabled={outOfStock}>
          {t('product.buyNow')}
        </Button>
      </div>

      <ul className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        <li className="flex gap-2"><Truck className="h-5 w-5 shrink-0 text-brand" />{freeShippingFrom > 0 ? `${price(freeShippingFrom)} dan ortiq buyurtmalarga bepul yetkazib berish` : 'Tez yetkazib berish'}</li>
        <li className="flex gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-brand" />Sifat kafolati va 14 kun ichida qaytarish</li>
      </ul>
    </div>
  );
}
