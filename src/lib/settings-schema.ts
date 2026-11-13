import { z } from 'zod';
import { cleanBrand, DEFAULT_BRAND } from '@/lib/brand/config';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Rang #RRGGBB formatida bo‘lishi kerak');
const optUrl = z.string().trim().max(500).nullable().optional().transform((v) => (v ? v : null));
const link = z.object({ label: z.string().trim().min(1).max(60), href: z.string().trim().min(1).max(300) });

export const HOME_SECTION_KEYS = ['hero', 'categories', 'bestsellers', 'promo', 'new', 'sale', 'middle_banner', 'featured', 'advantages'] as const;

export const settingsSchemas = {
  // Brend va dizayn (kassa app_meta 'brand'): bitta JSON, server va brauzer bir xil cleanBrand() bilan tekshiradi.
  brand: z.unknown().transform((v) => cleanBrand(v)),
  // Oynalar (kassa app_meta 'pages'): har admin sahifasi uchun vaqtincha to'xtatish, kim ko'radi va menyudagi nomi.
  pages: z.record(
    z.string().regex(/^\/admin(\/[a-z-]+)*$/),
    z.object({
      paused: z.boolean().default(false),
      who: z.enum(['all', 'admins', 'owner']).default('all'),
      label: z.string().trim().max(30).default(''),
    }),
  ),
  store: z.object({
    name: z.string().trim().min(1).max(60),
    tagline: z.string().trim().max(120).default(''),
    logo_url: optUrl,
    favicon_url: optUrl,
    primary_color: hex,
    accent_color: hex,
  }),
  contact: z.object({
    phone: z.string().trim().max(30).default(''),
    phone2: z.string().trim().max(30).nullable().optional(),
    email: z.string().trim().max(120).default(''),
    address: z.string().trim().max(300).default(''),
    working_hours: z.string().trim().max(120).default(''),
    map_url: optUrl,
  }),
  social: z.object({
    telegram: optUrl,
    instagram: optUrl,
    facebook: optUrl,
    youtube: optUrl,
    tiktok: optUrl,
  }),
  home_sections: z
    .array(z.object({ key: z.enum(HOME_SECTION_KEYS), title: z.string().trim().max(80), enabled: z.boolean() }))
    .max(20),
  header_menu: z.array(link).max(12),
  footer: z.object({
    about_text: z.string().trim().max(500).default(''),
    copyright: z.string().trim().max(200).default(''),
    columns: z.array(z.object({ title: z.string().trim().min(1).max(60), links: z.array(link).max(10) })).max(5),
  }),
  checkout: z.object({
    min_order_amount: z.coerce.number().int().min(0),
    free_shipping_threshold: z.coerce.number().int().min(0),
    allow_guest_checkout: z.boolean(),
    order_note: z.string().trim().max(300).default(''),
  }),
  localization: z.object({
    default_language: z.enum(['uz', 'ru', 'zh']),
    languages: z.array(z.enum(['uz', 'ru', 'zh'])).min(1),
    currency: z.string().trim().min(3).max(3),
    currency_symbol: z.string().trim().min(1).max(10),
  }),
  seo: z.object({
    title: z.string().trim().min(1).max(120),
    title_template: z.string().trim().max(120).default('%s'),
    description: z.string().trim().max(300).default(''),
    keywords: z.string().trim().max(300).default(''),
    og_image_url: optUrl,
  }),
  maintenance: z.object({ enabled: z.boolean(), message: z.string().trim().max(300).default('') }),
  advantages: z.array(z.object({ icon: z.string().trim().max(40), title: z.string().trim().min(1).max(60), text: z.string().trim().max(120) })).max(8),
  announcement: z.object({ enabled: z.boolean(), text: z.string().trim().max(200).default(''), link: optUrl }),
};

export type SettingsKey = keyof typeof settingsSchemas;
export type SiteSettings = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };

export const defaultSettings: SiteSettings = {
  brand: DEFAULT_BRAND,
  pages: {},
  store: { name: DEFAULT_BRAND.name, tagline: DEFAULT_BRAND.tagline, logo_url: null, favicon_url: null, primary_color: DEFAULT_BRAND.color, accent_color: '#ff9f0a' },
  contact: { phone: '', phone2: null, email: '', address: '', working_hours: '', map_url: null },
  social: { telegram: null, instagram: null, facebook: null, youtube: null, tiktok: null },
  home_sections: HOME_SECTION_KEYS.map((key) => ({ key, title: '', enabled: true })),
  header_menu: [],
  footer: { about_text: '', copyright: '', columns: [] },
  checkout: { min_order_amount: 0, free_shipping_threshold: 0, allow_guest_checkout: true, order_note: '' },
  localization: { default_language: 'uz', languages: ['uz'], currency: 'UZS', currency_symbol: 'soʻm' },
  seo: { title: 'Onlayn do‘kon', title_template: '%s', description: '', keywords: '', og_image_url: null },
  maintenance: { enabled: false, message: '' },
  advantages: [],
  announcement: { enabled: false, text: '', link: null },
};

/** Bazadagi xom qiymatlarni xavfsiz tarzda tiplangan sozlamalarga aylantiradi. Noto'g'ri qiymat — default. */
export function parseSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const result = { ...defaultSettings } as Record<SettingsKey, unknown>;
  for (const row of rows) {
    if (!(row.key in settingsSchemas)) continue;
    const key = row.key as SettingsKey;
    const parsed = settingsSchemas[key].safeParse(row.value);
    if (parsed.success) result[key] = parsed.data;
  }
  // Brend hali saqlanmagan eski do'kon: nom va shior "Do'kon" sozlamasidan olinadi.
  if (!rows.some((r) => r.key === 'brand')) {
    const store = result.store as SiteSettings['store'];
    result.brand = cleanBrand({ ...DEFAULT_BRAND, name: store.name, tagline: store.tagline });
  }
  return result as SiteSettings;
}
