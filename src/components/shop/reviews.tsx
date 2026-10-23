'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { submitReview } from '@/lib/actions/shop';
import { useApp } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { cn } from '@/components/ui/cn';

export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const { user } = useApp();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (!user) {
    return (
      <p className="rounded-2xl bg-slate-50 p-4 text-sm text-muted">
        Sharh qoldirish uchun <Link href={`/login?next=/product/${slug}`} className="font-semibold text-brand">tizimga kiring</Link>.
      </p>
    );
  }
  if (done) return <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">Rahmat! Sharhingiz qabul qilindi.</p>;

  return (
    <form
      className="space-y-3 rounded-2xl bg-slate-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) {
          toast('Iltimos, baho qo‘ying', 'info');
          return;
        }
        start(async () => {
          const res = await submitReview({ productId, rating, body });
          if (res.ok) {
            setDone(true);
            toast(res.message ?? 'Saqlandi');
          } else toast(res.error, 'error');
        });
      }}
    >
      <div className="text-sm font-semibold">Mahsulotni baholang</div>
      <div className="flex gap-1" role="radiogroup" aria-label="Baho">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} yulduz`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)} className="p-0.5">
            <Star className={cn('h-7 w-7 transition', i <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
          </button>
        ))}
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Mahsulot haqida fikringiz (ixtiyoriy)" aria-label="Sharh matni" />
      <Button type="submit" loading={pending}>Sharhni yuborish</Button>
    </form>
  );
}
