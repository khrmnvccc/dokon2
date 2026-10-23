import 'server-only';
// To'lov provayderlari uchun kengaytiriladigan arxitektura.
// Hozircha naqd va yetkazib berishda to'lov ishlaydi. Click/Payme ulanishi uchun merchant hisob va
// kalitlar kerak: ular .env.local orqali beriladi va provayder modulini yozish kerak (README ga qarang).
// Kalitlar bo'lmasa provayder "ulanmagan" hisoblanadi va checkout'da ko'rinmaydi. Soxta "to'landi" javobi yo'q.

import type { PaymentMethod } from '@/lib/types';

export interface PaymentSession {
  redirectUrl: string;
}

export interface PaymentProvider {
  id: 'click' | 'payme' | 'uzum';
  isConfigured(): boolean;
  /** To'lov sahifasiga yo'naltirish havolasini yaratish */
  createPayment(order: { id: string; number: number; total: number }): Promise<PaymentSession>;
}

class NotImplementedProvider implements PaymentProvider {
  // Integratsiya kodi yozilganda true qilinadi. Kalitlar bo'lsa ham, kod bo'lmasa ulanmagan hisoblanadi.
  private readonly implemented: boolean = false;
  constructor(public id: PaymentProvider['id'], private envKeys: string[]) {}
  isConfigured() {
    return this.implemented && this.envKeys.every((k) => Boolean(process.env[k]));
  }
  async createPayment(): Promise<PaymentSession> {
    throw new Error(`${this.id} to'lov provayderi hali ulanmagan`);
  }
}

export const providers: Record<PaymentProvider['id'], PaymentProvider> = {
  click: new NotImplementedProvider('click', ['CLICK_SERVICE_ID', 'CLICK_MERCHANT_ID', 'CLICK_SECRET_KEY']),
  payme: new NotImplementedProvider('payme', ['PAYME_MERCHANT_ID', 'PAYME_SECRET_KEY']),
  uzum: new NotImplementedProvider('uzum', ['UZUM_TERMINAL_ID', 'UZUM_API_KEY']),
};

/** Checkout'da ko'rsatish mumkin bo'lgan to'lov usuli: offline yoki ulangan onlayn provayder */
export function isPaymentMethodUsable(method: PaymentMethod): boolean {
  if (!method.is_active) return false;
  if (method.kind !== 'online') return true;
  return Boolean(method.provider && providers[method.provider]?.isConfigured());
}
