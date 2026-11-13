import { z } from 'zod';

/** Kupon kartasi ranglari (videodagi “Ranglar”: asosiy, chipta, raqam, tugma). */
export const COUPON_THEMES = {
  red: { label: 'Qizil-oltin', main: ['#e0192d', '#a30c1b'], stub: ['#fff6d8', '#f6cf6e'], stubInk: '#b3121f', ink: '#ffffff', button: '#ffd34d', buttonInk: '#7a0a12', pill: '#ffd34d' },
  blue: { label: 'Koʻk', main: ['#2a7de1', '#163f7a'], stub: ['#eaf3ff', '#b9d4fa'], stubInk: '#174a8c', ink: '#ffffff', button: '#ffffff', buttonInk: '#174a8c', pill: '#cfe3ff' },
  green: { label: 'Yashil', main: ['#1fa45a', '#0f6a3a'], stub: ['#ecfbef', '#b9ebc6'], stubInk: '#0f6a3a', ink: '#ffffff', button: '#ffffff', buttonInk: '#0f6a3a', pill: '#c9f2d4' },
  dark: { label: 'Qora-oltin', main: ['#27313f', '#0f141b'], stub: ['#fff3d1', '#e9c36a'], stubInk: '#3a2a06', ink: '#ffe7a8', button: '#f2c55c', buttonInk: '#2a1e04', pill: '#f2c55c' },
  purple: { label: 'Binafsha', main: ['#8a3ffc', '#4b1d96'], stub: ['#f4ecff', '#d6c0ff'], stubInk: '#4b1d96', ink: '#ffffff', button: '#ffffff', buttonInk: '#4b1d96', pill: '#e3d4ff' },
} as const;
export type CouponTheme = keyof typeof COUPON_THEMES;
export const COUPON_THEME_KEYS = Object.keys(COUPON_THEMES) as CouponTheme[];

export interface CouponDesign { theme: CouponTheme; badge: string }
export const DEFAULT_DESIGN: CouponDesign = { theme: 'red', badge: '' };

export const designSchema = z.preprocess(
  (v) => (v && typeof v === 'object' ? v : {}),
  z.object({
    theme: z.enum(COUPON_THEME_KEYS as [CouponTheme, ...CouponTheme[]]).catch('red'),
    badge: z.string().trim().max(6, 'Koʻpi bilan 6 belgi').catch(''),
  }),
);

/** Bazadagi xom qiymatni xavfsiz dizaynga aylantiradi (notoʻgʻri qiymat — standart). */
export function cleanDesign(raw: unknown): CouponDesign {
  const r = designSchema.safeParse(raw);
  return r.success ? r.data : DEFAULT_DESIGN;
}

const num = (v: number) => new Intl.NumberFormat('ru-RU').format(v).replace(/\s/g, ' ');
const scopeShort = { all: 'Barcha mahsulot', category: 'Kategoriyalar', product: 'Tanlanganlar' } as const;

/** Kartadagi yozuvlar: raqam, birlik, eslatma. Admin va saytda bir xil. */
export function couponCardProps(x: { discount_type: string; value: number; scope?: string; ends_at: string | null; min_order_amount?: number; design?: unknown }, kind: string) {
  const days = x.ends_at ? Math.ceil((new Date(x.ends_at).getTime() - Date.now()) / 86_400_000) : null;
  return {
    design: cleanDesign(x.design),
    kind,
    value: x.discount_type === 'percent' ? String(x.value) : num(x.value),
    unit: x.discount_type === 'percent' ? '%' : 'soʻm',
    note: x.min_order_amount ? `Min. ${num(x.min_order_amount)} soʻm` : 'Har qanday buyurtmaga',
    tag: x.scope ? scopeShort[x.scope as keyof typeof scopeShort] : null,
    stubNote: days !== null && days > 0 ? `${days} kun` : null,
  };
}

