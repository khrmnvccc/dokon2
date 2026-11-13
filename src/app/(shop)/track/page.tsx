import type { Metadata } from 'next';
import { TrackForm } from '@/components/shop/track-form';

export const metadata: Metadata = { title: 'Buyurtmani kuzatish', description: 'Buyurtma raqami va telefon orqali buyurtma holatini bilib oling' };

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-[22px] font-semibold tracking-tight sm:text-2xl">Buyurtmani kuzatish</h1>
      <p className="mb-5 text-ink-3">Buyurtma raqami va buyurtmada ko‘rsatilgan telefon raqamini kiriting.</p>
      <TrackForm />
    </div>
  );
}
