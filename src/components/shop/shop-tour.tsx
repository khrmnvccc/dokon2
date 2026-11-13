'use client';

import { usePathname } from 'next/navigation';
import { Grid2x2, Package, Search, ShoppingCart, Store } from 'lucide-react';
import { Tour, type TourStep } from '@/components/tour';

const STEPS: TourStep[] = [
  { title: 'Xush kelibsiz! 👋', icon: <Store className="size-5" />, text: 'Qanday xarid qilishni 4 qadamda koʻrsatamiz. Roʻyxatdan oʻtish shart emas.' },
  { target: 'search', title: 'Qidiring', icon: <Search className="size-5" />, text: 'Mahsulot nomini yozing — mos variantlar darhol chiqadi.' },
  { target: 'catalog', title: 'Yoki katalogdan tanlang', icon: <Grid2x2 className="size-5" />, text: 'Hamma boʻlimlar shu yerda: narx va brend boʻyicha saralash mumkin.' },
  { target: 'cart', title: 'Savat', icon: <ShoppingCart className="size-5" />, text: 'Yoqqanini savatga qoʻshing. Rasmiylashtirishda faqat ism, telefon va manzil soʻraladi. Promo-kod boʻlsa — shu yerda kiritasiz.' },
  { target: 'orders', title: 'Buyurtmani kuzating', icon: <Package className="size-5" />, text: 'Buyurtma holatini shu yerda koʻrasiz. Telegram botimiz orqali kirsangiz, holati xabar boʻlib keladi.' },
];

/** Xaridorga birinchi kirishda bosh sahifada qisqa yoʻl-yoʻriq. */
export function ShopTour() {
  const pathname = usePathname();
  if (pathname !== '/') return null;
  return <Tour id="shop" steps={STEPS} delay={1200} />;
}
