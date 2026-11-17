import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';

// Click / Payme kalitlari. Ega admin panelda kiritadi (Sozlamalar → Yetkazish va toʻlov → Onlayn toʻlov).
// Faqat bazadagi yopiq app_meta 'payments' da turadi, brauzerga hech qachon qaytarilmaydi.

export interface ClickKeys { enabled: boolean; service_id: string; merchant_id: string; merchant_user_id: string; secret_key: string }
export interface PaymeKeys { enabled: boolean; merchant_id: string; key: string; test_key: string; test_mode: boolean; account_field: string }
export interface PaymentKeys { click: ClickKeys; payme: PaymeKeys }

export const EMPTY_KEYS: PaymentKeys = {
  click: { enabled: false, service_id: '', merchant_id: '', merchant_user_id: '', secret_key: '' },
  payme: { enabled: false, merchant_id: '', key: '', test_key: '', test_mode: false, account_field: 'order_id' },
};

const META_KEY = 'payments';
let cache: { value: PaymentKeys; until: number } | null = null;

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function cleanKeys(raw: unknown): PaymentKeys {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const c = r.click ?? {};
  const p = r.payme ?? {};
  return {
    click: {
      enabled: c.enabled === true, service_id: str(c.service_id, 20), merchant_id: str(c.merchant_id, 20),
      merchant_user_id: str(c.merchant_user_id, 20), secret_key: str(c.secret_key),
    },
    payme: {
      enabled: p.enabled === true, merchant_id: str(p.merchant_id, 40), key: str(p.key), test_key: str(p.test_key),
      test_mode: p.test_mode === true, account_field: /^[a-z_]{2,30}$/.test(str(p.account_field)) ? str(p.account_field) : 'order_id',
    },
  };
}

export async function getPaymentKeys(): Promise<PaymentKeys> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return EMPTY_KEYS;
  if (cache && cache.until > Date.now()) return cache.value;
  const { data } = await getServiceSupabase().from('app_meta').select('value').eq('key', META_KEY).maybeSingle();
  const value = cleanKeys(data?.value);
  cache = { value, until: Date.now() + 20_000 };
  return value;
}

export async function savePaymentKeys(keys: PaymentKeys) {
  const { error } = await getServiceSupabase().from('app_meta').upsert({ key: META_KEY, value: keys, updated_at: new Date().toISOString() });
  cache = null;
  if (error) throw error;
}

export const clickReady = (k: ClickKeys) => k.enabled && Boolean(k.service_id && k.merchant_id && k.secret_key);
export const paymeReady = (k: PaymeKeys) => k.enabled && Boolean(k.merchant_id && (k.test_mode ? k.test_key : k.key));

export function providerReady(keys: PaymentKeys, provider: string | null | undefined) {
  if (provider === 'click') return clickReady(keys.click);
  if (provider === 'payme') return paymeReady(keys.payme);
  return false;
}

/** Brauzerga beriladigan holat: sirlar oʻrniga faqat “kiritilgan / yoʻq”. */
export function publicKeyStatus(keys: PaymentKeys) {
  return {
    click: {
      enabled: keys.click.enabled, ready: clickReady(keys.click), service_id: keys.click.service_id, merchant_id: keys.click.merchant_id,
      merchant_user_id: keys.click.merchant_user_id, hasSecret: Boolean(keys.click.secret_key),
    },
    payme: {
      enabled: keys.payme.enabled, ready: paymeReady(keys.payme), merchant_id: keys.payme.merchant_id, test_mode: keys.payme.test_mode,
      account_field: keys.payme.account_field, hasKey: Boolean(keys.payme.key), hasTestKey: Boolean(keys.payme.test_key),
    },
  };
}
export type PaymentKeyStatus = ReturnType<typeof publicKeyStatus>;
