import { z } from 'zod';
import { cleanBrand, DEFAULT_BRAND } from '@/lib/brand/config';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Rang #RRGGBB formatida bo‘lishi kerak');
const optUrl = z.string().trim().max(500).nullable().optional().transform((v) => (v ? v : null));
const link = z.object({ label: z.string().trim().min(1).max(60), href: z.string().trim().min(1).max(300) });

export const HOME_SECTION_KEYS = ['hero', 'categories', 'reviews', 'bestsellers', 'promo', 'new', 'sale', 'middle_banner', 'featured', 'advantages'] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];
/** Bosh sahifa bloki oʻlchami: sm — ixcham, md — oddiy, lg — katta. */
export const SECTION_SIZES = ['sm', 'md', 'lg'] as const;
export type SectionSize = (typeof SECTION_SIZES)[number];
export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: 'Asosiy slayder', categories: 'Kategoriyalar', bestsellers: 'Xit mahsulotlar', promo: 'Aksiya bannerlari', new: 'Yangi mahsulotlar',
  sale: 'Chegirmadagilar', middle_banner: 'Oʻrta banner', featured: 'Tavsiya etilganlar', reviews: 'Mijozlar fikri (sharhlar)', advantages: 'Afzalliklar',
};

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
    .array(z.object({ key: z.enum(HOME_SECTION_KEYS), title: z.string().trim().max(80), enabled: z.boolean(), size: z.enum(SECTION_SIZES).default('md') }))
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
    /** Kargo yoʻli: yetkazish checkoutda emas, buyurtma Oʻzbekistonga kelganda tanlanadi. */
    delivery_later: z.boolean().default(true),
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
  // Yordam markazi (Profil → Yordam markazi): Telegram kartasi, tez mavzular videolari, telefon.
  help_center: z.object({
    support_title: z.string().trim().max(60).default('Telegram qoʻllab-quvvatlash'),
    status: z.string().trim().max(60).default('Onlayn · hozir javob beradi'),
    reply_time: z.string().trim().max(20).default('~2 daq'),
    hours: z.string().trim().max(20).default('24 / 7'),
    phone: z.string().trim().max(30).default(''),
    phone_hours: z.string().trim().max(60).default(''),
    videos: z.object({
      order: z.object({ url: optUrl, duration: z.string().trim().max(8).default('') }).default({ url: null, duration: '' }),
      payment: z.object({ url: optUrl, duration: z.string().trim().max(8).default('') }).default({ url: null, duration: '' }),
      address: z.object({ url: optUrl, duration: z.string().trim().max(8).default('') }).default({ url: null, duration: '' }),
    }).default({}),
  }),
  // Har sahifadagi bloklar oʻlchami (tahrir rejimidagi S/M/L): {"product.gallery": "lg"}. md — saqlanmaydi.
  block_sizes: z.record(z.string().regex(/^[a-z0-9_.-]{1,60}$/), z.enum(['sm', 'lg'])).refine((r) => Object.keys(r).length <= 200),
  // Tashlab ketilgan savat: botdan eslatma (+ ixtiyoriy shaxsiy kupon). Marketing → Savat eslatmasi.
  cart_reminder: z.object({
    enabled: z.boolean().default(false),
    /** Savat oxirgi oʻzgarganidan necha soat keyin eslatiladi */
    delay_hours: z.coerce.number().int().min(1).max(168).default(3),
    /** Ikkinchi eslatma (0 — yoʻq): birinchisidan necha soat keyin */
    second_after_hours: z.coerce.number().int().min(0).max(336).default(24),
    min_cart_total: z.coerce.number().int().min(0).default(0),
    coupon: z.object({
      enabled: z.boolean().default(true),
      /** Qaysi eslatmada kupon beriladi: 1 — birinchisida, 2 — ikkinchisida */
      on_step: z.coerce.number().int().min(1).max(2).default(2),
      type: z.enum(['percent', 'fixed']).default('percent'),
      value: z.coerce.number().int().min(1).max(100_000_000).default(5),
      max_discount: z.coerce.number().int().min(0).default(0),
      min_order: z.coerce.number().int().min(0).default(0),
      days: z.coerce.number().int().min(1).max(90).default(3),
    }).default({}),
    /** Tunda yozmaslik (Toshkent vaqti) */
    quiet_from: z.coerce.number().int().min(0).max(23).default(22),
    quiet_to: z.coerce.number().int().min(0).max(23).default(9),
  }),
  // Ombor: kam qoldiq ogohlantirishi va “Kelganda xabar ber”. Katalog → Ombor → Sozlamalar.
  stock_alerts: z.object({
    low_alert: z.boolean().default(true),
    out_alert: z.boolean().default(true),
    include_variants: z.boolean().default(true),
    default_threshold: z.coerce.number().int().min(0).max(100_000).default(5),
    /** Kechki hisobotga kam qolganlar roʻyxati */
    in_daily_report: z.boolean().default(true),
    restock_enabled: z.boolean().default(true),
    /** Mahsulot sahifasida “Kelganda xabar ber” tugmasi */
    restock_button: z.boolean().default(true),
    /** Sevimlilarga qoʻshganlarga ham qayta kelganda xabar */
    restock_wishlist: z.boolean().default(true),
  }),
  // Tavsiyalar: mahsulot sahifasi va savatchada. Sozlamalar → Tavsiyalar.
  recommendations: z.object({
    similar_enabled: z.boolean().default(true),
    similar_title: z.string().trim().max(60).default('Bunga oʻxshash'),
    similar_limit: z.coerce.number().int().min(2).max(20).default(10),
    together_enabled: z.boolean().default(true),
    together_title: z.string().trim().max(60).default('Birga olinadi'),
    together_limit: z.coerce.number().int().min(2).max(20).default(8),
    cart_enabled: z.boolean().default(true),
    cart_title: z.string().trim().max(60).default('Bunga qoʻshib oling'),
    /** Sotuvi boʻlmasa — oʻsha kategoriyadagi xitlar bilan toʻldirish */
    fill_with_popular: z.boolean().default(true),
  }),
  // Kargo: yuk bosqichlari (mijoz koʻradi), trek boʻyicha kuzatish. Savdo → Kargo.
  cargo: z.object({
    enabled: z.boolean().default(true),
    notify: z.boolean().default(true),
    track_by_number: z.boolean().default(true),
    /** Tashuvchi saytidagi kuzatish havolasi: {{trek}} oʻrniga trek raqami qoʻyiladi (boʻsh — yoʻq) */
    carrier_url: z.string().trim().max(300).default(''),
    stages: z.array(z.object({
      key: z.string().regex(/^[a-z0-9_]{1,30}$/),
      label: z.string().trim().min(1).max(60),
      icon: z.enum(['warehouse', 'plane', 'truck', 'border', 'customs', 'pin', 'box', 'check']).default('box'),
      /** Shu bosqichda buyurtma holati ham oʻzgaradi */
      status: z.enum(['none', 'shipped', 'arrived']).default('none'),
    })).min(1).max(15),
  }),
  // Avtomatik hisobotlar (admin botiga). Hisobotlar → Avtomatik.
  reports_auto: z.object({
    daily: z.boolean().default(true),
    daily_hour: z.coerce.number().int().min(0).max(23).default(21),
    weekly: z.boolean().default(false),
    monthly: z.boolean().default(true),
    top_count: z.coerce.number().int().min(0).max(10).default(3),
  }),
  // Onlayn toʻlov (Click/Payme) — sirli boʻlmagan qismi. Kalitlar app_meta 'payments' da.
  online_payments: z.object({
    auto_confirm: z.boolean().default(true),
    redirect_after_checkout: z.boolean().default(true),
  }),
  // Sayt matnlarining ruscha tarjimasi: {"ru": {"announcement.text": "…"}} (Sozlamalar → Tarjimalar).
  translations: z.object({ ru: z.record(z.string().max(120), z.string().max(2000)).default({}) }),
};

export type SettingsKey = keyof typeof settingsSchemas;
export type SiteSettings = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };

export const defaultSettings: SiteSettings = {
  brand: DEFAULT_BRAND,
  pages: {},
  store: { name: DEFAULT_BRAND.name, tagline: DEFAULT_BRAND.tagline, logo_url: null, favicon_url: null, primary_color: DEFAULT_BRAND.color, accent_color: '#ff9f0a' },
  contact: { phone: '', phone2: null, email: '', address: '', working_hours: '', map_url: null },
  social: { telegram: null, instagram: null, facebook: null, youtube: null, tiktok: null },
  home_sections: HOME_SECTION_KEYS.map((key) => ({ key, title: '', enabled: true, size: 'md' as const })),
  header_menu: [],
  footer: { about_text: '', copyright: '', columns: [] },
  checkout: { min_order_amount: 0, free_shipping_threshold: 0, allow_guest_checkout: true, order_note: '', delivery_later: true },
  localization: { default_language: 'uz', languages: ['uz'], currency: 'UZS', currency_symbol: 'soʻm' },
  seo: { title: 'Onlayn do‘kon', title_template: '%s', description: '', keywords: '', og_image_url: null },
  maintenance: { enabled: false, message: '' },
  advantages: [],
  announcement: { enabled: false, text: '', link: null },
  translations: { ru: {} },
  cart_reminder: {
    enabled: false, delay_hours: 3, second_after_hours: 24, min_cart_total: 0, quiet_from: 22, quiet_to: 9,
    coupon: { enabled: true, on_step: 2, type: 'percent', value: 5, max_discount: 0, min_order: 0, days: 3 },
  },
  stock_alerts: {
    low_alert: true, out_alert: true, include_variants: true, default_threshold: 5, in_daily_report: true,
    restock_enabled: true, restock_button: true, restock_wishlist: true,
  },
  recommendations: {
    similar_enabled: true, similar_title: 'Bunga oʻxshash', similar_limit: 10,
    together_enabled: true, together_title: 'Birga olinadi', together_limit: 8,
    cart_enabled: true, cart_title: 'Bunga qoʻshib oling', fill_with_popular: true,
  },
  cargo: {
    enabled: true, notify: true, track_by_number: true, carrier_url: '',
    stages: [
      { key: 'china_warehouse', label: 'Xitoy omborida', icon: 'warehouse', status: 'none' },
      { key: 'sent', label: 'Xitoydan joʻnatildi', icon: 'truck', status: 'shipped' },
      { key: 'border', label: 'Chegarada', icon: 'border', status: 'none' },
      { key: 'customs', label: 'Bojxonada', icon: 'customs', status: 'none' },
      { key: 'tashkent', label: 'Toshkent omborida', icon: 'pin', status: 'arrived' },
    ],
  },
  reports_auto: { daily: true, daily_hour: 21, weekly: false, monthly: true, top_count: 3 },
  online_payments: { auto_confirm: true, redirect_after_checkout: true },
  block_sizes: {},
  help_center: {
    support_title: 'Telegram qoʻllab-quvvatlash', status: 'Onlayn · hozir javob beradi', reply_time: '~2 daq', hours: '24 / 7',
    phone: '', phone_hours: '',
    videos: { order: { url: null, duration: '' }, payment: { url: null, duration: '' }, address: { url: null, duration: '' } },
  },
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
  // Yangi qoʻshilgan bosh sahifa bloklari (masalan “Mijozlar fikri”) eski saqlangan roʻyxatda boʻlmasa — oxiridan qoʻshiladi.
  const sections = result.home_sections as SiteSettings['home_sections'];
  const missing = HOME_SECTION_KEYS.filter((k) => !sections.some((s) => s.key === k)).sort((a, b) => Number(b === 'reviews') - Number(a === 'reviews'));
  if (missing.length) {
    const next = [...sections];
    for (const key of missing) {
      // “Mijozlar fikri” koʻzga koʻrinadigan joyda: kategoriyalardan keyin (boʻlmasa — boshidagi bannerdan keyin).
      const after = key === 'reviews' ? Math.max(next.findIndex((s) => s.key === 'categories'), next.findIndex((s) => s.key === 'hero')) : -2;
      next.splice(after === -2 ? next.length : after + 1, 0, { key, title: '', enabled: true, size: 'md' });
    }
    result.home_sections = next;
  }
  // Brend hali saqlanmagan eski do'kon: nom va shior "Do'kon" sozlamasidan olinadi.
  if (!rows.some((r) => r.key === 'brand')) {
    const store = result.store as SiteSettings['store'];
    result.brand = cleanBrand({ ...DEFAULT_BRAND, name: store.name, tagline: store.tagline });
  }
  return result as SiteSettings;
}
