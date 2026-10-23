import type { Metadata } from 'next';
import { CartView } from '@/components/shop/cart-view';

export const metadata: Metadata = { title: 'Savatcha', robots: { index: false } };

export default function CartPage() {
  return <CartView />;
}
