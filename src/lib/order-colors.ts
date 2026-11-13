import type { OrderStatus } from './types';

// Kapsula va badge ranglari faqat tokenlardan (kassa 1.2): to'lov turlari — Naqd yashil, Karta ko'k,
// Click sariq, Payme binafsha.
export const STATUS_COLOR: Record<OrderStatus, string> = {
  new: 'var(--card)',
  confirmed: 'var(--pochta)',
  processing: 'var(--yandex)',
  shipped: 'var(--primary)',
  delivered: 'var(--cash)',
  cancelled: 'var(--danger)',
  returned: 'var(--ink-3)',
};

export type PaymentTone = 'cash' | 'card' | 'yandex' | 'pochta';

export function paymentTone(m: { kind?: string | null; provider?: string | null; name?: string | null }): PaymentTone {
  const name = (m.name ?? '').toLowerCase();
  if (m.provider === 'click' || name.includes('click')) return 'yandex';
  if (m.provider === 'payme' || name.includes('payme')) return 'pochta';
  if (m.kind === 'cash' || name.includes('naqd')) return 'cash';
  return 'card';
}

export const toneColor = (t: PaymentTone) => `var(--${t})`;
