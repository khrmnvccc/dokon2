import { describe, expect, it } from 'vitest';
import { buildCategoryChain, computeQuote, effectivePrice, validateCoupon, type PricingProduct, type PricingVariant } from '@/lib/pricing';
import type { Coupon, Promotion, ShippingMethod } from '@/lib/types';

const cats = [
  { id: 'root', parent_id: null },
  { id: 'phones', parent_id: 'root' },
  { id: 'clothes', parent_id: null },
];
const chain = buildCategoryChain(cats);

const product = (over: Partial<PricingProduct> = {}): PricingProduct => ({
  id: 'p1', name: 'Telefon', slug: 'telefon', price: 1_000_000, compare_at_price: null, cost_price: 700_000, category_id: 'phones',
  stock: 10, track_stock: true, has_variants: false, is_active: true, image_url: null, sku: 'T1', ...over,
});
const promo = (over: Partial<Promotion> = {}): Promotion => ({
  id: 'pr', title: 'Aksiya', slug: 'a', description: null, image_url: null, discount_type: 'percent', value: 10, scope: 'all',
  category_ids: [], product_ids: [], starts_at: null, ends_at: null, is_active: true, sort_order: 0, ...over,
});
const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  id: 'c', code: 'XUSH10', description: null, discount_type: 'percent', value: 10, max_discount: null, min_order_amount: 0, scope: 'all',
  category_ids: [], product_ids: [], starts_at: null, ends_at: null, usage_limit: null, per_user_limit: null, used_count: 0, is_active: true, ...over,
});
const courier: ShippingMethod = { id: 's', name: 'Kuryer', description: null, kind: 'courier', price: 25_000, free_from: null, eta: null, requires_address: true, is_active: true, sort_order: 0 };

function quote(opts: Partial<Omit<Parameters<typeof computeQuote>[0], 'products' | 'variants'>> & { products?: PricingProduct[]; variants?: PricingVariant[] } = {}) {
  const products = opts.products ?? [product()];
  return computeQuote({
    lines: opts.lines ?? [{ productId: 'p1', quantity: 2 }],
    products: new Map(products.map((p) => [p.id, p])),
    variants: new Map((opts.variants ?? []).map((v) => [v.id, v])),
    promotions: opts.promotions ?? [],
    chain,
    coupon: opts.coupon,
    couponRequested: opts.couponRequested,
    shippingMethod: opts.shippingMethod ?? courier,
    freeShippingThreshold: opts.freeShippingThreshold ?? 0,
    minOrderAmount: opts.minOrderAmount ?? 0,
  });
}

describe('kategoriya zanjiri', () => {
  it('ota kategoriyalarni qaytaradi', () => {
    expect(chain('phones')).toEqual(['phones', 'root']);
    expect(chain(null)).toEqual([]);
  });
  it('sikldan himoyalangan', () => {
    const loop = buildCategoryChain([{ id: 'a', parent_id: 'b' }, { id: 'b', parent_id: 'a' }]);
    expect(loop('a')).toEqual(['a', 'b']);
  });
});

describe('effectivePrice', () => {
  it('eng katta aksiyani qo‘llaydi va eski narxni ko‘rsatadi', () => {
    const r = effectivePrice(product(), [promo({ value: 10 }), promo({ id: 'p2', value: 15, scope: 'category', category_ids: ['root'] })], chain);
    expect(r.price).toBe(850_000);
    expect(r.compareAt).toBe(1_000_000);
    expect(r.promotion?.id).toBe('p2');
  });
  it('muddati o‘tgan aksiya qo‘llanmaydi', () => {
    const r = effectivePrice(product(), [promo({ ends_at: '2000-01-01T00:00:00Z' })], chain);
    expect(r.price).toBe(1_000_000);
    expect(r.compareAt).toBeNull();
  });
  it('qat’iy summali chegirma narxdan oshmaydi', () => {
    expect(effectivePrice(product({ price: 5000 }), [promo({ discount_type: 'fixed', value: 10_000 })], chain).price).toBe(0);
  });
  it('boshqa mahsulotga tegishli aksiya qo‘llanmaydi', () => {
    expect(effectivePrice(product(), [promo({ scope: 'product', product_ids: ['other'] })], chain).price).toBe(1_000_000);
  });
});

describe('computeQuote', () => {
  it('oddiy hisob: mahsulot + yetkazib berish', () => {
    const q = quote();
    expect(q.subtotal).toBe(2_000_000);
    expect(q.shipping).toBe(25_000);
    expect(q.total).toBe(2_025_000);
    expect(q.costTotal).toBe(1_400_000);
    expect(q.hasErrors).toBe(false);
  });
  it('bepul yetkazib berish chegarasi', () => {
    expect(quote({ freeShippingThreshold: 1_500_000 }).shipping).toBe(0);
    const q = quote({ freeShippingThreshold: 3_000_000 });
    expect(q.shipping).toBe(25_000);
    expect(q.amountToFreeShipping).toBe(1_000_000);
  });
  it('omborda yetarli bo‘lmasa xato', () => {
    const q = quote({ lines: [{ productId: 'p1', quantity: 11 }] });
    expect(q.lines[0].error).toBe('insufficient_stock');
    expect(q.hasErrors).toBe(true);
  });
  it('nofaol mahsulot sotilmaydi', () => {
    const q = quote({ products: [product({ is_active: false })] });
    expect(q.lines[0].error).toBe('unavailable');
    expect(q.subtotal).toBe(0);
  });
  it('variantli mahsulotda variant majburiy', () => {
    const q = quote({ products: [product({ has_variants: true })] });
    expect(q.lines[0].error).toBe('variant_required');
  });
  it('variant narxi va qoldig‘i ishlatiladi', () => {
    const variant: PricingVariant = { id: 'v1', product_id: 'p1', name: 'Qora', sku: 'T1-B', price: 1_200_000, compare_at_price: null, stock: 1, is_active: true };
    const q = quote({ products: [product({ has_variants: true })], variants: [variant], lines: [{ productId: 'p1', variantId: 'v1', quantity: 1 }] });
    expect(q.lines[0].unitPrice).toBe(1_200_000);
    expect(q.lines[0].sku).toBe('T1-B');
    const q2 = quote({ products: [product({ has_variants: true })], variants: [variant], lines: [{ productId: 'p1', variantId: 'v1', quantity: 2 }] });
    expect(q2.lines[0].error).toBe('insufficient_stock');
  });
  it('boshqa mahsulotning varianti qabul qilinmaydi', () => {
    const variant: PricingVariant = { id: 'v1', product_id: 'other', name: 'X', sku: null, price: 1, compare_at_price: null, stock: 5, is_active: true };
    const q = quote({ products: [product({ has_variants: true })], variants: [variant], lines: [{ productId: 'p1', variantId: 'v1', quantity: 1 }] });
    expect(q.lines[0].error).toBe('unavailable');
  });
  it('bir xil qatorlar birlashtiriladi', () => {
    const q = quote({ lines: [{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 2 }] });
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].quantity).toBe(3);
  });
  it('kupon: foiz, maksimal chegirma va proporsional taqsimot', () => {
    const p2 = product({ id: 'p2', price: 500_000, category_id: 'clothes', cost_price: null });
    const q = quote({ products: [product(), p2], lines: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }], coupon: coupon({ max_discount: 100_000 }), couponRequested: true });
    expect(q.coupon?.discount).toBe(100_000);
    expect(q.lines.reduce((s, l) => s + l.couponDiscount, 0)).toBe(100_000);
    expect(q.total).toBe(1_500_000 - 100_000 + 25_000);
    expect(q.costTotal).toBeNull();
  });
  it('kupon: minimal summa va qamrov', () => {
    expect(quote({ coupon: coupon({ min_order_amount: 5_000_000 }), couponRequested: true }).couponError).toBe('min_order');
    expect(quote({ coupon: coupon({ scope: 'category', category_ids: ['clothes'] }), couponRequested: true }).couponError).toBe('not_applicable');
    expect(quote({ coupon: null, couponRequested: true }).couponError).toBe('not_found');
  });
  it('minimal buyurtma summasi', () => {
    expect(quote({ minOrderAmount: 3_000_000 }).belowMinimum).toBe(true);
  });
  it('olib ketishda yetkazish bepul', () => {
    expect(quote({ shippingMethod: { ...courier, kind: 'pickup', price: 10_000 } }).shipping).toBe(0);
  });
});

describe('validateCoupon', () => {
  it('holatlarni aniqlaydi', () => {
    expect(validateCoupon(coupon())).toBeNull();
    expect(validateCoupon(coupon({ is_active: false }))).toBe('inactive');
    expect(validateCoupon(coupon({ usage_limit: 5, used_count: 5 }))).toBe('limit_reached');
    expect(validateCoupon(coupon({ starts_at: '2999-01-01T00:00:00Z' }))).toBe('not_started');
    expect(validateCoupon(coupon({ ends_at: '2000-01-01T00:00:00Z' }))).toBe('expired');
  });
});
