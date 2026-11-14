'use client';

import { GuidedTour } from '@/components/tour';
import type { Tours } from '@/lib/tours';

/** Doʻkondagi yoʻl-yoʻriq (matnlari admin panel → Sozlamalar → Yoʻl-yoʻriq). */
export function ShopTour({ tours }: { tours: Tours }) {
  return <GuidedTour scope="shop" tours={tours} />;
}
