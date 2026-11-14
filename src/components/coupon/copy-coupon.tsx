'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check, Copy, Gift, X } from 'lucide-react';
import { CouponCard, type CouponCardProps } from './coupon-card';
import { useApp } from '@/components/providers';

/** Ochiq kupon: bosilganda kod nusxalanadi va sovgʻa qutisi ochiladi; checkout'da kiritiladi. */
export function CopyCoupon({ code, card, description }: { code: string; card: CouponCardProps; description: string | null }) {
  const [done, setDone] = useState(false);
  const [gift, setGift] = useState(false);
  const copy = async (withGift: boolean) => {
    try { await navigator.clipboard.writeText(code); } catch { /* eski brauzer: kod baribir koʻrinib turadi */ }
    setDone(true);
    if (withGift) setGift(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <div>
      <button type="button" onClick={() => copy(true)} className="block w-full text-left transition-transform active:scale-[0.99]" aria-label={`${code} kuponini olish`}>
        <CouponCard {...card} action={done ? 'Olindi' : 'Olish'} />
      </button>
      <div className="mt-2 flex items-center justify-between gap-2 px-1 text-sm">
        <span className="text-ink-3">{description || 'Checkout’da kodni kiriting'}</span>
        <button type="button" onClick={() => copy(false)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-2.5 py-1 font-mono text-[13px] font-bold text-ink">
          {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}{code}
        </button>
      </div>
      {gift && <GiftReveal code={code} value={card.unit === "%" ? `${card.value}%` : `${card.value} ${card.unit}`} onClose={() => setGift(false)} />}
    </div>
  );
}

const CONFETTI = ['#ff5a5f', '#ffb400', '#2f80c1', '#1f9d55', '#8b5cf6', '#ff7ab6'];

/** Sovgʻa qutisi: silkinadi, qopqogʻi ochiladi, konfetti sochiladi, kod koʻrinadi. */
function GiftReveal({ code, value, onClose }: { code: string; value: string; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const ru = useApp().lang === 'ru';
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 650);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => { clearTimeout(t); removeEventListener('keydown', onKey); };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4 anim-fade" role="dialog" aria-modal="true" aria-label="Kupon olindi" onClick={onClose}>
      <div className="relative w-full max-w-xs rounded-3xl bg-surface-solid px-5 pb-5 pt-8 text-center shadow-pop anim-pop" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Yopish" className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"><X className="size-4" /></button>
        <div className="relative mx-auto flex size-24 items-center justify-center">
          {open && CONFETTI.flatMap((c, k) => [0, 1].map((j) => (
            <span key={`${k}${j}`} className="confetti" style={{ background: c, ['--a' as string]: `${(k * 2 + j) * 30}deg`, ['--d' as string]: `${70 + ((k + j) % 3) * 18}px` }} />
          )))}
          <span className={open ? 'gift-open' : 'gift-shake'}>
            <span className="flex size-20 items-center justify-center rounded-[26%] bg-primary text-primary-fg shadow-pop"><Gift className="size-11" strokeWidth={1.8} /></span>
          </span>
        </div>
        <div className={open ? 'anim-rise' : 'invisible'}>
          <div className="mt-3 text-lg font-bold">{ru ? 'Купон ваш! 🎉' : 'Kupon sizniki! 🎉'}</div>
          <p className="mt-1 text-sm text-ink-3"><b className="text-ink">{value}</b> {ru ? 'скидка. Код скопирован — вставьте его в корзине в поле «Промокод».' : 'chegirma. Kod nusxalandi — savatda “Promo-kod”ga qoʻying.'}</p>
          <div className="mt-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft py-2.5 font-mono text-xl font-bold tracking-wider text-primary">{code}</div>
          <Link href="/catalog" onClick={onClose} className="mt-4 flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-fg">{ru ? 'За покупками' : 'Xaridni boshlash'}</Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
