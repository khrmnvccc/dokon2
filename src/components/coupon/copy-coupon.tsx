'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { CouponCard, type CouponCardProps } from './coupon-card';

/** Ochiq kupon: bosilganda kod nusxalanadi, checkout'da kiritiladi. */
export function CopyCoupon({ code, card, description }: { code: string; card: CouponCardProps; description: string | null }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); } catch { /* eski brauzer: kod baribir koʻrinib turadi */ }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <div>
      <button type="button" onClick={copy} className="block w-full text-left transition-transform active:scale-[0.99]" aria-label={`${code} kodini nusxalash`}>
        <CouponCard {...card} action={done ? 'Nusxalandi' : 'Nusxalash'} />
      </button>
      <div className="mt-2 flex items-center justify-between gap-2 px-1 text-sm">
        <span className="text-ink-3">{description || 'Checkout’da kodni kiriting'}</span>
        <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-2.5 py-1 font-mono text-[13px] font-bold text-ink">
          {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}{code}
        </button>
      </div>
    </div>
  );
}
