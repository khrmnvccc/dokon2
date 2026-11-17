import 'server-only';
// Onlayn toʻlov (Click / Payme). Kalitlar Ega tomonidan admin panelda kiritiladi (app_meta 'payments').
// Kalit kiritilmagan yoki oʻchirilgan provayder “ulanmagan” hisoblanadi va checkout'da koʻrinmaydi.
// Toʻlov holatini faqat provayderning serverdan-serverga soʻrovi (imzo/kalit bilan) oʻzgartiradi — soxta “toʻlandi” yoʻq.

import type { PaymentMethod } from '@/lib/types';
import { SITE_URL } from '@/lib/env';
import { getPaymentKeys, providerReady, type PaymentKeys } from './config';

export type OnlineProvider = 'click' | 'payme';
export const PROVIDER_LABEL: Record<string, string> = { click: 'Click', payme: 'Payme', uzum: 'Uzum' };

/** Checkout'da koʻrsatish mumkin bo'lgan to'lov usuli: offline yoki ulangan onlayn provayder */
export function isPaymentMethodUsable(method: PaymentMethod, keys: PaymentKeys): boolean {
  if (!method.is_active) return false;
  if (method.kind !== 'online') return true;
  return providerReady(keys, method.provider);
}

export async function usablePaymentMethods(methods: PaymentMethod[]) {
  const keys = await getPaymentKeys();
  return methods.filter((m) => isPaymentMethodUsable(m, keys));
}

/** Provayderning toʻlov sahifasi havolasi. Summa — soʻmda. */
export function providerPayUrl(keys: PaymentKeys, provider: OnlineProvider, order: { number: number; total: number }, returnPath: string): string | null {
  const back = `${SITE_URL}${returnPath}`;
  if (provider === 'payme') {
    const k = keys.payme;
    const params = `m=${k.merchant_id};ac.${k.account_field}=${order.number};a=${Math.round(order.total * 100)};c=${back};l=uz`;
    const host = k.test_mode ? 'https://checkout.test.paycom.uz' : 'https://checkout.paycom.uz';
    return `${host}/${Buffer.from(params).toString('base64')}`;
  }
  if (provider === 'click') {
    const k = keys.click;
    const q = new URLSearchParams({
      service_id: k.service_id, merchant_id: k.merchant_id, amount: String(order.total), transaction_param: String(order.number), return_url: back,
    });
    if (k.merchant_user_id) q.set('merchant_user_id', k.merchant_user_id);
    return `https://my.click.uz/services/pay?${q}`;
  }
  return null;
}
