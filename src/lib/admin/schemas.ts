import { z } from 'zod';

const toNumber = (v: unknown) => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  const cleaned = v.replace(/[\s,']/g, '');
  return cleaned === '' ? undefined : Number(cleaned);
};

/** So'm (butun son). "1 250 000" ham qabul qilinadi */
export const money = z.preprocess(toNumber, z.number({ invalid_type_error: 'Raqam kiriting', required_error: 'Narxni kiriting' }).int('Butun son kiriting').min(0, 'Manfiy bo‘lishi mumkin emas').max(1_000_000_000_000));
export const optMoney = z.preprocess((v) => (v === '' || v === null ? null : toNumber(v)), money.nullable().optional()).transform((v) => v ?? null);
export const intField = (min = 0, max = 1_000_000) => z.preprocess(toNumber, z.number({ invalid_type_error: 'Raqam kiriting' }).int().min(min).max(max));
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
export const slugSchema = z.string().trim().toLowerCase().min(1, 'Slug kiriting').max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Faqat lotin harflari, raqam va chiziqcha (masalan: qizil-koylak)');
const uuidOrNull = z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable());
const dateOrNull = z.preprocess((v) => (v === '' || v == null ? null : v), z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)).nullable())
  // datetime-local qiymati (vaqt zonasisiz) Toshkent vaqti deb qabul qilinadi
  .transform((v) => (v ? new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(v) ? v : `${v}:00+05:00`).toISOString() : null));
const hex = z.preprocess((v) => (v === '' ? null : v), z.string().regex(/^#[0-9a-fA-F]{6}$/, '#RRGGBB').nullable());

export const variantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Nomi').max(120),
  sku: optText(64),
  color: optText(40),
  color_hex: hex.optional(),
  size: optText(20),
  price: optMoney,
  compare_at_price: optMoney,
  stock: intField(0, 1_000_000),
  is_active: z.boolean(),
});

export const imageSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().trim().min(1).max(1000),
  storage_path: optText(500),
  alt: optText(200),
  is_primary: z.boolean(),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, 'Nomini kiriting').max(200),
    slug: slugSchema,
    short_description: optText(300),
    description: optText(20000),
    category_id: uuidOrNull,
    brand: optText(80),
    sku: optText(64),
    barcode: optText(64),
    price: money,
    compare_at_price: optMoney,
    cost_price: optMoney,
    stock: intField(0, 1_000_000),
    low_stock_threshold: intField(0, 100_000),
    track_stock: z.boolean(),
    is_active: z.boolean(),
    is_featured: z.boolean(),
    is_bestseller: z.boolean(),
    is_new: z.boolean(),
    weight_grams: z.preprocess((v) => (v === '' || v == null ? null : toNumber(v)), z.number().int().min(0).max(1_000_000).nullable()),
    attributes: z.array(z.object({ name: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) })).max(40),
    seo_title: optText(120),
    seo_description: optText(300),
    images: z.array(imageSchema).max(15),
    variants: z.array(variantSchema).max(100),
  })
  .refine((d) => d.compare_at_price === null || d.compare_at_price > d.price, { path: ['compare_at_price'], message: 'Eski narx joriy narxdan katta bo‘lishi kerak' });
export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nomini kiriting').max(120),
  slug: slugSchema,
  parent_id: uuidOrNull,
  description: optText(1000),
  image_url: optText(1000),
  icon: optText(40),
  sort_order: intField(-10000, 10000),
  is_active: z.boolean(),
  show_on_home: z.boolean(),
  seo_title: optText(120),
  seo_description: optText(300),
});

const placement = z.enum(['home_hero', 'home_middle', 'home_promo', 'catalog_top', 'sale_page']);
export const bannerSchema = z.object({
  title: optText(120),
  subtitle: optText(200),
  image_url: z.string().trim().min(1, 'Rasm yuklang').max(1000),
  mobile_image_url: optText(1000),
  button_text: optText(40),
  link_url: optText(500),
  placement,
  bg_color: hex.optional(),
  text_color: hex.optional(),
  starts_at: dateOrNull,
  ends_at: dateOrNull,
  is_active: z.boolean(),
  sort_order: intField(-10000, 10000),
});

const discountBase = {
  discount_type: z.enum(['percent', 'fixed']),
  value: intField(1, 1_000_000_000),
  scope: z.enum(['all', 'category', 'product']),
  category_ids: z.array(z.string().uuid()).max(200),
  product_ids: z.array(z.string().uuid()).max(500),
  starts_at: dateOrNull,
  ends_at: dateOrNull,
  is_active: z.boolean(),
};
type DiscountShape = { discount_type: string; value: number; scope: string; category_ids: string[]; product_ids: string[]; starts_at: string | null; ends_at: string | null };
const discountRefine = <T extends DiscountShape, I>(s: z.ZodType<T, z.ZodTypeDef, I>) =>
  s
    .refine((d) => d.discount_type !== 'percent' || d.value <= 100, { path: ['value'], message: 'Foiz 100 dan oshmasin' })
    .refine((d) => d.scope !== 'category' || d.category_ids.length > 0, { path: ['category_ids'], message: 'Kategoriyani tanlang' })
    .refine((d) => d.scope !== 'product' || d.product_ids.length > 0, { path: ['product_ids'], message: 'Mahsulotni tanlang' })
    .refine((d) => !d.starts_at || !d.ends_at || d.starts_at < d.ends_at, { path: ['ends_at'], message: 'Tugash sanasi boshlanishdan keyin bo‘lsin' });

export const promotionSchema = discountRefine(z.object({
  title: z.string().trim().min(2, 'Nomini kiriting').max(120),
  slug: slugSchema,
  description: optText(1000),
  image_url: optText(1000),
  sort_order: intField(-10000, 10000),
  ...discountBase,
}));

export const couponSchema = discountRefine(z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, '3-32 belgi: lotin harf, raqam, - yoki _'),
  description: optText(300),
  max_discount: optMoney,
  min_order_amount: money,
  usage_limit: z.preprocess((v) => (v === '' || v == null ? null : toNumber(v)), z.number().int().min(1).nullable()),
  per_user_limit: z.preprocess((v) => (v === '' || v == null ? null : toNumber(v)), z.number().int().min(1).nullable()),
  ...discountBase,
}));

export const pageSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1, 'Sarlavha kiriting').max(160),
  content: z.string().max(50000),
  seo_title: optText(120),
  seo_description: optText(300),
  is_published: z.boolean(),
});

export const shippingMethodSchema = z.object({
  name: z.string().trim().min(1, 'Nomini kiriting').max(80),
  description: optText(300),
  kind: z.enum(['courier', 'pickup', 'post']),
  price: money,
  free_from: optMoney,
  eta: optText(80),
  requires_address: z.boolean(),
  is_active: z.boolean(),
  sort_order: intField(-1000, 1000),
});

export const paymentMethodSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/, 'Faqat lotin kichik harf, raqam, _').max(40),
  name: z.string().trim().min(1, 'Nomini kiriting').max(80),
  description: optText(300),
  instructions: optText(1000),
  kind: z.enum(['cash', 'card_on_delivery', 'bank_transfer', 'online']),
  provider: z.preprocess((v) => (v === '' ? null : v), z.enum(['click', 'payme', 'uzum']).nullable()),
  is_active: z.boolean(),
  sort_order: intField(-1000, 1000),
}).refine((d) => d.kind !== 'online' || d.provider, { path: ['provider'], message: 'Onlayn to‘lov uchun provayderni tanlang' });
