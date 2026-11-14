'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { CARD_THEMES, formatCardNumber, type PaymentCard } from '@/lib/payment-card';
import { cn } from '@/components/ui/cn';

/** Bank kartasi koʻrinishi: raqam katta harflarda, nusxalash tugmasi bilan. Admin oldindan koʻrish va saytda bir xil. */
export function CardVisual({ card, copyLabel = 'Nusxalash', copiedLabel = 'Nusxalandi', className }: { card: PaymentCard; copyLabel?: string; copiedLabel?: string; className?: string }) {
  const t = CARD_THEMES[card.theme] ?? CARD_THEMES.dark;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(card.number); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* raqam koʻrinib turadi */ }
  };
  return (
    <div className={cn('relative aspect-[1.586] w-full max-w-sm overflow-hidden rounded-2xl p-5 shadow-lg', className)}
      style={{ background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})`, color: t.ink }}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-8 size-48 rounded-full bg-white/5" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-semibold tracking-wide opacity-90">{card.bank || ' '}</span>
          <span aria-hidden className="h-7 w-10 rounded-md bg-gradient-to-br from-[#f5d77a] to-[#b98a2e] opacity-90" />
        </div>
        <div className="mt-auto">
          <p className="num whitespace-nowrap text-[clamp(1.05rem,5.6vw,1.45rem)] font-semibold tracking-[0.08em]">{formatCardNumber(card.number)}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wider opacity-85">{card.holder || ' '}</span>
            <button type="button" onClick={copy}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur transition hover:bg-white/30">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? copiedLabel : copyLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
