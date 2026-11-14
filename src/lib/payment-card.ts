import { z } from 'zod';

/** Kartaga oʻtkazma uchun karta koʻrinishi (Ega toʻlov usulida kiritadi). */
export const CARD_THEMES = {
  dark: { label: 'Qora', bg: ['#2b3442', '#0d1117'], ink: '#ffffff' },
  blue: { label: 'Koʻk', bg: ['#2f7cf6', '#163f8c'], ink: '#ffffff' },
  green: { label: 'Yashil', bg: ['#1fa45a', '#0b5e33'], ink: '#ffffff' },
  purple: { label: 'Binafsha', bg: ['#8a3ffc', '#3d1680'], ink: '#ffffff' },
  gold: { label: 'Oltin', bg: ['#f2c55c', '#a4741c'], ink: '#2a1e04' },
} as const;
export type CardTheme = keyof typeof CARD_THEMES;
export const CARD_THEME_KEYS = Object.keys(CARD_THEMES) as CardTheme[];

export interface PaymentCard { number: string; holder: string; bank: string; theme: CardTheme }

export const cardDigits = (v: string) => v.replace(/\D/g, '');
/** 8600123412341234 → “8600 1234 1234 1234” */
export const formatCardNumber = (v: string) => cardDigits(v).replace(/(.{4})(?=.)/g, '$1 ');

export const cardSchema = z.object({
  number: z.string().transform(cardDigits).refine((v) => v.length >= 16 && v.length <= 19, 'Karta raqami 16 ta raqam boʻlsin'),
  holder: z.string().trim().max(60, 'Juda uzun').default(''),
  bank: z.string().trim().max(40, 'Juda uzun').default(''),
  theme: z.enum(CARD_THEME_KEYS as [CardTheme, ...CardTheme[]]).catch('dark'),
});

/** Bazadagi xom qiymat → karta (notoʻgʻri boʻlsa null). */
export function cleanCard(raw: unknown): PaymentCard | null {
  const r = cardSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export const RECEIPT_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Vercel soʻrov chegarasi ~4.5 MB: brauzer rasmni oldin kichraytiradi. */
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;
export const RECEIPT_MAX_PER_ORDER = 6;

/** Fayl boshidagi baytlar haqiqatan rasmmi (mime soxtalashtirilmagan). */
export function sniffImage(b: Uint8Array): (typeof RECEIPT_MIME)[number] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
