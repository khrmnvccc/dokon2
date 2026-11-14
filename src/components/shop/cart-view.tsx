'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, Minus, Plus, ShoppingCart, Tag, Trash2, Truck, X } from 'lucide-react';
import { useApp, useCart, useL } from '@/components/providers';
import { useConfirm } from '@/components/ui/dialog';
import { Button, buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { myActiveCoupons } from '@/lib/actions/referral';
import { couponErrorText, lineErrorText, type PricedLine, type QuoteResult } from '@/lib/pricing';
import { ProductImage } from './product-image';
import { useQuote } from './use-quote';

const COUPON_KEY = 'dk_coupon';

export function readSavedCoupon(): string | null {
  try {
    return sessionStorage.getItem(COUPON_KEY);
  } catch {
    return null;
  }
}
export function saveCoupon(code: string | null) {
  try {
    if (code) sessionStorage.setItem(COUPON_KEY, code);
    else sessionStorage.removeItem(COUPON_KEY);
  } catch {}
}

export function CartView() {
  const L = useL();
  const { t } = useApp();
  const cart = useCart();
  const confirm = useConfirm();
  const [coupon, setCoupon] = useState<string | null>(() => (typeof window === 'undefined' ? null : readSavedCoupon()));
  const { quote, loading, error } = useQuote(cart.items, cart.ready, coupon, null);

  if (!cart.ready || (loading && !quote && cart.items.length)) return <CartSkeleton />;

  if (!cart.items.length) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-8 w-8" />}
        title={t('cart.empty')}
        text={t('cart.emptyText')}
        action={<Link href="/catalog" className={buttonClass('primary')}>{t('nav.catalog')}</Link>}
      />
    );
  }

  const applyCoupon = (code: string | null) => {
    setCoupon(code);
    saveCoupon(code);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">
          {t('cart.title')} <span className="text-base font-medium text-ink-3">({cart.count})</span>
        </h1>
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-danger"
          onClick={async () => (await confirm({ title: L("Savatchani tozalash?"), text: L("Barcha mahsulotlar olib tashlanadi."), confirmText: L("Tozalash"), danger: true })) && cart.clear()}
        >
          <Trash2 className="h-4 w-4" /> {L("Tozalash")}
        </button>
      </div>
      {error && <p className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        <ul className="space-y-3">
          {(quote?.lines ?? []).map((line) => (
            <CartLine key={`${line.productId}:${line.variantId ?? ''}`} line={line} />
          ))}
        </ul>
        <aside className="space-y-3 lg:sticky lg:top-24">
          <CouponBox applied={quote?.coupon?.code ?? null} requested={coupon} error={quote?.couponError ?? null} onApply={applyCoupon} />
          {quote && <Summary quote={quote} loading={loading} />}
        </aside>
      </div>
    </div>
  );
}

function CartLine({ line }: { line: PricedLine }) {
  const { price } = useApp();
  const cart = useCart();
  const max = line.available ?? 999;
  const unavailable = line.error === 'unavailable' || line.error === 'variant_required';
  return (
    <li className={cn('flex gap-3 rounded-xl border border-line bg-surface p-3 shadow-soft sm:gap-4 sm:p-4', unavailable && 'opacity-75')}>
      <Link href={line.slug ? `/product/${line.slug}` : '#'} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-28">
        <ProductImage src={line.imageUrl} alt={line.name} sizes="112px" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={line.slug ? `/product/${line.slug}` : '#'} className="line-clamp-2 text-sm font-medium hover:text-primary sm:text-[15px]">{line.name}</Link>
            {line.variantName && <p className="mt-0.5 text-xs text-ink-3">{line.variantName}</p>}
          </div>
          <button onClick={() => cart.remove(line.productId, line.variantId)} className="-m-1 rounded-lg p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger" aria-label="O‘chirish">
            <X className="h-5 w-5" />
          </button>
        </div>
        {line.error && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
            <AlertTriangle className="h-3.5 w-3.5" />
            {lineErrorText[line.error]}
            {line.error === 'insufficient_stock' && line.available ? ` — mavjud: ${line.available} dona` : ''}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
          {!unavailable ? (
            <div className="flex items-center rounded-xl border border-line">
              <button
                className="flex h-9 w-9 items-center justify-center text-ink-2 disabled:opacity-40"
                onClick={() => cart.setQuantity(line.productId, line.variantId, line.quantity - 1)}
                disabled={line.quantity <= 1}
                aria-label="Kamaytirish"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-9 text-center text-sm font-semibold" aria-live="polite">{line.quantity}</span>
              <button
                className="flex h-9 w-9 items-center justify-center text-ink-2 disabled:opacity-40"
                onClick={() => cart.setQuantity(line.productId, line.variantId, line.quantity + 1)}
                disabled={line.quantity >= max}
                aria-label="Ko‘paytirish"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className="text-right">
            <div className="text-base font-semibold sm:text-lg">{price(line.unitPrice * line.quantity)}</div>
            {line.originalPrice > line.unitPrice && <div className="text-xs text-ink-3 line-through">{price(line.originalPrice * line.quantity)}</div>}
            {line.quantity > 1 && <div className="text-xs text-ink-3">{price(line.unitPrice)} × {line.quantity}</div>}
          </div>
        </div>
      </div>
    </li>
  );
}

export function CouponBox({ applied, requested, error, onApply }: { applied: string | null; requested: string | null; error: QuoteResult['couponError']; onApply: (code: string | null) => void }) {
  const L = useL();
  const [value, setValue] = useState('');
  const [mine, setMine] = useState<{ code: string; value: number; percent?: boolean; min_order_amount: number }[]>([]);
  useEffect(() => {
    let alive = true;
    myActiveCoupons().then((c) => { if (alive) setMine(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-success-soft px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-success"><Tag className="h-4 w-4" /> {applied} {L("qo‘llandi")}</span>
        <button className="text-success underline" onClick={() => onApply(null)}>{L("Bekor qilish")}</button>
      </div>
    );
  }
  return (
    <form
      data-tour="coupon"
      className="rounded-xl border border-line bg-surface p-4 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        const code = value.trim().toUpperCase();
        if (code) onApply(code);
      }}
    >
      <label htmlFor="coupon" className="mb-2 block text-sm font-semibold">{L("Promo-kod")}</label>
      <div className="flex gap-2">
        <Input id="coupon" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Masalan: XUSH10" maxLength={32} autoComplete="off" className="uppercase" />
        <Button type="submit" variant="secondary" disabled={!value.trim()}>{L("Qo‘llash")}</Button>
      </div>
      {requested && error && <p className="mt-2 text-xs font-medium text-danger">{L(couponErrorText[error])}</p>}
      {mine.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-ink-3">{L("Kuponlarim")}</p>
          <div className="flex flex-wrap gap-2">
            {mine.map((c) => (
              <button key={c.code} type="button" onClick={() => onApply(c.code)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-primary-soft px-3 py-1.5 text-[13px] font-semibold text-primary transition active:scale-95">
                <Tag className="size-3.5" />{c.percent ? `${c.value}%` : `${new Intl.NumberFormat('ru-RU').format(c.value).replace(/\s/g, ' ')} ${L("soʻm")}`}
                {c.min_order_amount > 0 && <span className="font-normal text-ink-3">· {L("Min.")} {new Intl.NumberFormat('ru-RU').format(c.min_order_amount).replace(/\s/g, ' ')}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

function Summary({ quote, loading }: { quote: QuoteResult; loading: boolean }) {
  const L = useL();
  const { t, price } = useApp();
  const blocked = quote.hasErrors || quote.belowMinimum;
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4 shadow-soft transition sm:p-5', loading && 'opacity-70')}>
      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between"><dt className="text-ink-3">{t('cart.subtotal')}</dt><dd className="font-medium">{price(quote.subtotal)}</dd></div>
        {quote.discount > 0 && (
          <div className="flex justify-between text-success"><dt>{t('cart.discount')}</dt><dd className="font-medium">−{price(quote.discount)}</dd></div>
        )}
        <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
          <dt className="font-semibold">{t('cart.total')}</dt>
          <dd className="font-semibold">{price(quote.subtotal - quote.discount)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-ink-3">{L("Yetkazib berish narxi keyingi bosqichda hisoblanadi")}</p>
      {quote.amountToFreeShipping > 0 && (
        <div className="mt-4 rounded-lg bg-primary-soft p-3 text-xs text-primary">
          <p className="flex items-center gap-1.5 font-semibold"><Truck className="h-4 w-4" /> {t('cart.toFree', { amount: price(quote.amountToFreeShipping) })}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((quote.freeShippingThreshold - quote.amountToFreeShipping) / quote.freeShippingThreshold) * 100)}%` }} />
          </div>
        </div>
      )}
      {quote.belowMinimum && <p className="mt-3 text-xs font-medium text-warn">{t('cart.minOrder', { amount: price(quote.minOrderAmount) })}</p>}
      {quote.hasErrors && <p className="mt-3 text-xs font-medium text-danger">{L("Davom etish uchun belgilangan mahsulotlarni to‘g‘rilang yoki olib tashlang")}</p>}
      <Link
        data-tour="checkout"
        href={blocked ? '#' : '/checkout'}
        aria-disabled={blocked}
        onClick={(e) => blocked && e.preventDefault()}
        className={buttonClass('primary', 'lg', cn('mt-4 w-full', blocked && 'pointer-events-none opacity-50'))}
      >
        {t('cart.checkout')}
      </Link>
      <Link href="/catalog" className="mt-2 block text-center text-sm font-medium text-primary hover:underline">{t('cart.continue')}</Link>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
