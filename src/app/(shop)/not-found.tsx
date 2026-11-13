import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';
import { SearchBox } from '@/components/shop/header-client';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-soft text-primary"><SearchX className="h-10 w-10" /></div>
      <p className="mt-6 text-5xl font-semibold text-primary">404</p>
      <h1 className="mt-2 text-[22px] font-semibold tracking-tight sm:text-2xl">Sahifa topilmadi</h1>
      <p className="mt-2 text-ink-3">Bu sahifa o‘chirilgan yoki manzil noto‘g‘ri kiritilgan. Kerakli mahsulotni qidirib ko‘ring.</p>
      <SearchBox className="mt-6 w-full" />
      <div className="mt-6 flex gap-2">
        <Link href="/" className={buttonClass('primary')}>Bosh sahifa</Link>
        <Link href="/catalog" className={buttonClass('outline')}>Katalog</Link>
      </div>
    </div>
  );
}
