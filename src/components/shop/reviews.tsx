'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/dialog';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { submitReview } from '@/lib/actions/shop';
import { useApp, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { cn } from '@/components/ui/cn';

export function ReviewForm({ productId, slug, onDone }: { productId: string; slug: string; onDone?: () => void }) {
  const L = useL();
  const { user } = useApp();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (!user) {
    return (
      <p className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-3">
        {L("Sharh qoldirish uchun")} <Link href={`/login?next=/product/${slug}`} className="font-semibold text-primary">{L("tizimga kiring")}</Link>.
      </p>
    );
  }
  if (done) return <p className="rounded-2xl bg-success-soft p-4 text-sm font-medium text-success">{L("Rahmat! Sharhingiz qabul qilindi.")}</p>;

  return (
    <form
      className="space-y-3 rounded-2xl bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) {
          toast(L("Iltimos, baho qo‘ying"), 'info');
          return;
        }
        start(async () => {
          const res = await submitReview({ productId, rating, body });
          if (res.ok) {
            setDone(true);
            toast(res.message ?? L("Saqlandi"));
            onDone?.();
          } else toast(res.error, 'error');
        });
      }}
    >
      <div className="text-sm font-semibold">{L("Mahsulotni baholang")}</div>
      <div className="flex gap-1" role="radiogroup" aria-label="Baho">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} yulduz`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)} className="p-0.5">
            <Star className={cn('h-7 w-7 transition', i <= (hover || rating) ? 'fill-yandex text-yandex' : 'text-ink-3')} />
          </button>
        ))}
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder={L("Mahsulot haqida fikringiz (ixtiyoriy)")} aria-label={L("Sharh matni")} />
      <Button type="submit" loading={pending}>{L("Sharhni yuborish")}</Button>
    </form>
  );
}

/** Buyurtma sahifasida: “Baho berish” — shu joyning oʻzida oyna ochiladi (mahsulot sahifasiga oʻtmasdan). */
export function RateItemButton({ productId, slug, name }: { productId: string; slug: string; name: string }) {
  const L = useL();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-lg bg-warn-soft px-2.5 text-xs font-semibold text-warn hover:opacity-90">
        <Star className="size-3.5" aria-hidden /> {L("Baho berish")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={L("Baho berish")} description={name}>
        <ReviewForm productId={productId} slug={slug} onDone={() => { router.refresh(); setTimeout(() => setOpen(false), 900); }} />
      </Modal>
    </>
  );
}
