import { z } from 'zod';
import { COUPON_THEME_KEYS, type CouponTheme } from '@/lib/coupon-design';

// Doʻstni taklif qilish va hamkorlar: qoidalar (Ega boshqaradi), holat nomlari, havolalar.
// Sozlamalar app_meta 'referral' kalitida; bazadagi _referral_cfg() xuddi shu standartlar bilan oʻqiydi.

export const REF_COOKIE = 'dk_ref';
export const REF_PARAM_PREFIX = 'ref_';

const money = (max: number) => z.coerce.number().int().min(0).max(max);

export const stepSchema = z.object({
  friends: z.coerce.number().int().min(1, 'Kamida 1 doʻst').max(1000),
  amount: money(100_000_000),
  min_order: money(1_000_000_000),
});

export const referralSettingsSchema = z.object({
  enabled: z.boolean(),
  qualify_on: z.enum(['confirmed', 'delivered']),
  friend_min_order: money(1_000_000_000),
  coupon_days: z.coerce.number().int().min(1).max(365),
  steps: z.array(stepSchema).min(1, 'Kamida bitta bosqich').max(10, 'Koʻpi bilan 10 bosqich')
    .refine((s) => s.every((x, i) => i === 0 || x.friends > s[i - 1].friends), 'Har keyingi bosqichda doʻstlar soni oldingisidan koʻp boʻlsin'),
  welcome: z.object({
    enabled: z.boolean(),
    amount: money(100_000_000),
    min_order: money(1_000_000_000),
    days: z.coerce.number().int().min(1).max(365),
  }),
  partner: z.object({
    enabled: z.boolean(),
    auto: z.boolean(),
    percent: z.coerce.number().min(0).max(50),
    hold_days: z.coerce.number().int().min(0).max(90),
    min_payout: money(100_000_000),
  }),
  design: z.object({
    theme: z.enum(COUPON_THEME_KEYS as [CouponTheme, ...CouponTheme[]]).catch('blue'),
    badge: z.string().trim().max(6).catch(''),
  }),
});
export type ReferralSettings = z.infer<typeof referralSettingsSchema>;
export type ReferralStep = z.infer<typeof stepSchema>;

export const DEFAULT_REFERRAL: ReferralSettings = {
  enabled: true,
  qualify_on: 'delivered',
  friend_min_order: 0,
  coupon_days: 30,
  steps: [
    { friends: 1, amount: 10_000, min_order: 100_000 },
    { friends: 2, amount: 20_000, min_order: 200_000 },
    { friends: 3, amount: 30_000, min_order: 300_000 },
    { friends: 4, amount: 50_000, min_order: 500_000 },
    { friends: 5, amount: 100_000, min_order: 1_000_000 },
  ],
  welcome: { enabled: true, amount: 10_000, min_order: 100_000, days: 30 },
  partner: { enabled: true, auto: true, percent: 3, hold_days: 14, min_payout: 50_000 },
  design: { theme: 'blue', badge: '' },
};

/** Bazadagi xom qiymat → toʻliq sozlama (yetishmagan maydonlar standartdan). */
export function cleanReferralSettings(raw: unknown): ReferralSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const merged = {
    ...DEFAULT_REFERRAL, ...r,
    welcome: { ...DEFAULT_REFERRAL.welcome, ...(r.welcome as object | undefined) },
    partner: { ...DEFAULT_REFERRAL.partner, ...(r.partner as object | undefined) },
    design: { ...DEFAULT_REFERRAL.design, ...(r.design as object | undefined) },
  };
  const parsed = referralSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_REFERRAL;
}

/** “ref_1234” yoki “1234” → mijoz ID raqami. */
export function parseRefCode(raw: string | null | undefined): number | null {
  const s = String(raw ?? '').trim().toLowerCase().replace(/^ref_?/, '');
  if (!/^\d{1,12}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

export function shareLinks(clientNo: number, siteUrl: string, botName: string | null) {
  const site = `${siteUrl.replace(/\/$/, '')}/r/${clientNo}`;
  const bot = botName ? `https://t.me/${botName}?start=${REF_PARAM_PREFIX}${clientNo}` : null;
  return { main: bot ?? site, site, bot };
}

export const REFERRAL_STATUS: Record<string, { label: string; tone: 'neutral' | 'warn' | 'success' }> = {
  joined: { label: 'Roʻyxatdan oʻtdi', tone: 'neutral' },
  ordered: { label: 'Buyurtma berdi', tone: 'warn' },
  qualified: { label: 'Shart bajarildi', tone: 'success' },
};

export const PARTNER_STATUS: Record<string, { label: string; tone: 'neutral' | 'warn' | 'success' | 'danger' }> = {
  pending: { label: 'Ariza', tone: 'warn' },
  active: { label: 'Faol', tone: 'success' },
  frozen: { label: 'Muzlatilgan', tone: 'neutral' },
  rejected: { label: 'Rad etilgan', tone: 'danger' },
};

export const PAYOUT_STATUS: Record<string, { label: string; tone: 'neutral' | 'warn' | 'success' | 'danger' }> = {
  requested: { label: 'Tekshiruvda', tone: 'warn' },
  paid: { label: 'Toʻlandi', tone: 'success' },
  rejected: { label: 'Rad etildi', tone: 'danger' },
};

export const SOURCE_LABEL: Record<string, string> = { bot: 'Telegram bot', link: 'Sayt havolasi', webapp: 'Mini-ilova', admin: 'Qoʻlda (admin)' };
export const COUPON_SOURCE_LABEL: Record<string, string> = { manual: 'Promo-kod', referral: 'Doʻst taklifi', welcome: 'Sovgʻa (taklif qilingan)', gift: 'Qoʻlda berilgan' };

/** Mijoz xatolari (bazadan) → tushunarli matn. */
export function referralErrorText(message: string | undefined): string {
  const m = message ?? '';
  if (m.includes('PAYOUT_PENDING')) return 'Oldingi soʻrovingiz hali koʻrib chiqilmoqda';
  if (m.includes('PAYOUT_CARD')) return 'Karta raqamini toʻliq yozing (16 raqam)';
  if (m.includes('PAYOUT_MIN')) return 'Summa minimal miqdordan kam';
  if (m.includes('PAYOUT_BALANCE')) return 'Balansda yetarli mablagʻ yoʻq';
  if (m.includes('PARTNER_INACTIVE')) return 'Hamkorlik faol emas';
  if (m.includes('PARTNER_NOT_READY')) return 'Avval barcha bosqichlarni bajaring';
  if (m.includes('PARTNER_DISABLED')) return 'Hamkorlik dasturi oʻchirilgan';
  if (m.includes('AUTH_REQUIRED')) return 'Avval tizimga kiring';
  return 'Bajarib boʻlmadi. Birozdan keyin qayta urinib koʻring';
}
