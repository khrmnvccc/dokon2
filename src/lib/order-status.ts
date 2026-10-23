import type { OrderStatus, PaymentStatus } from './types';

export const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

export const orderStatusLabel: Record<OrderStatus, string> = {
  new: 'Yangi',
  confirmed: 'Tasdiqlandi',
  processing: 'Yig‘ilmoqda',
  shipped: 'Yo‘lda',
  delivered: 'Yetkazildi',
  cancelled: 'Bekor qilindi',
  returned: 'Qaytarildi',
};

export const orderStatusTone: Record<OrderStatus, 'blue' | 'violet' | 'amber' | 'brand' | 'green' | 'red' | 'gray'> = {
  new: 'blue',
  confirmed: 'violet',
  processing: 'amber',
  shipped: 'brand',
  delivered: 'green',
  cancelled: 'red',
  returned: 'gray',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: 'To‘lanmagan',
  paid: 'To‘langan',
  failed: 'Xato',
  refunded: 'Qaytarilgan',
};

/** Mijozga ko'rsatiladigan bosqichlar (bekor/qaytarilgan alohida) */
export const ORDER_STEPS: OrderStatus[] = ['new', 'confirmed', 'processing', 'shipped', 'delivered'];

/** SQL dagi order_transition_allowed bilan bir xil bo'lishi kerak (testlarda tekshiriladi) */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};
