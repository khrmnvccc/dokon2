// Narx hisoblash: aksiyalar, kuponlar, yetkazib berish. Toza funksiyalar — ham UI, ham server (checkout) shu yerdan foydalanadi.
// Checkout'da barcha kirish ma'lumotlari serverda bazadan qayta o'qiladi, mijoz yuborgan narxlarga ishonilmaydi.
import type { Coupon, DiscountScope, DiscountType, Promotion, ShippingMethod } from './types';

export interface PricingProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  category_id: string | null;
  stock: number;
  track_stock: boolean;
  has_variants: boolean;
  is_active: boolean;
  image_url: string | null;
  sku: string | null;
}

export interface PricingVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock: number;
  is_active: boolean;
}

export interface CartLineInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export type LineError = 'unavailable' | 'variant_required' | 'out_of_stock' | 'insufficient_stock';

export interface PricedLine {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  available: number | null;
  unitPrice: number;
  originalPrice: number;
  costPrice: number | null;
  lineTotal: number;
  couponDiscount: number;
  categoryId: string | null;
  error: LineError | null;
}

export type CouponError = 'not_found' | 'inactive' | 'expired' | 'not_started' | 'limit_reached' | 'min_order' | 'not_applicable';

export interface QuoteResult {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  costTotal: number | null;
  coupon: { id: string; code: string; discount: number } | null;
  couponError: CouponError | null;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  minOrderAmount: number;
  belowMinimum: boolean;
  hasErrors: boolean;
}

interface Discountable {
  discount_type: DiscountType;
  value: number;
  scope: DiscountScope;
  category_ids: string[];
  product_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export type CategoryChain = (categoryId: string | null) => string[];

export function isWithinDates(item: { starts_at: string | null; ends_at: string | null }, now = new Date()): boolean {
  if (item.starts_at && new Date(item.starts_at) > now) return false;
  if (item.ends_at && new Date(item.ends_at) <= now) return false;
  return true;
}

export function appliesTo(rule: Pick<Discountable, 'scope' | 'category_ids' | 'product_ids'>, productId: string, categoryId: string | null, chain: CategoryChain): boolean {
  if (rule.scope === 'all') return true;
  if (rule.scope === 'product') return rule.product_ids.includes(productId);
  const cats = chain(categoryId);
  return cats.some((c) => rule.category_ids.includes(c));
}

function discountAmount(type: DiscountType, value: number, base: number): number {
  if (base <= 0) return 0;
  const raw = type === 'percent' ? Math.floor((base * Math.min(value, 100)) / 100) : value;
  return Math.max(0, Math.min(raw, base));
}

/** Mahsulotning aksiyalar qo'llangan narxi (mijoz ko'radigan narx). */
export function effectivePrice(
  product: { id: string; price: number; compare_at_price: number | null; category_id: string | null },
  promotions: Promotion[],
  chain: CategoryChain,
  variant?: { price: number | null; compare_at_price: number | null } | null,
  now = new Date(),
): { price: number; compareAt: number | null; promotion: Promotion | null } {
  const base = variant?.price ?? product.price;
  const listCompare = variant?.compare_at_price ?? (variant?.price != null ? null : product.compare_at_price);
  let best: Promotion | null = null;
  let bestAmount = 0;
  for (const promo of promotions) {
    if (!promo.is_active || !isWithinDates(promo, now)) continue;
    if (!appliesTo(promo, product.id, product.category_id, chain)) continue;
    const amount = discountAmount(promo.discount_type, promo.value, base);
    if (amount > bestAmount) {
      best = promo;
      bestAmount = amount;
    }
  }
  const price = base - bestAmount;
  const compareCandidate = Math.max(listCompare ?? 0, bestAmount > 0 ? base : 0);
  return { price, compareAt: compareCandidate > price ? compareCandidate : null, promotion: best };
}

export function buildCategoryChain(categories: { id: string; parent_id: string | null }[]): CategoryChain {
  const parent = new Map(categories.map((c) => [c.id, c.parent_id]));
  return (categoryId) => {
    const chain: string[] = [];
    let current = categoryId;
    while (current && !chain.includes(current) && chain.length < 20) {
      chain.push(current);
      current = parent.get(current) ?? null;
    }
    return chain;
  };
}

export function validateCoupon(coupon: Coupon | null, now = new Date()): CouponError | null {
  if (!coupon) return 'not_found';
  if (!coupon.is_active) return 'inactive';
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return 'not_started';
  if (coupon.ends_at && new Date(coupon.ends_at) <= now) return 'expired';
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) return 'limit_reached';
  return null;
}

export interface QuoteInput {
  lines: CartLineInput[];
  products: Map<string, PricingProduct>;
  variants: Map<string, PricingVariant>;
  promotions: Promotion[];
  chain: CategoryChain;
  coupon?: Coupon | null;
  couponRequested?: boolean;
  shippingMethod?: ShippingMethod | null;
  freeShippingThreshold: number;
  minOrderAmount: number;
  now?: Date;
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const now = input.now ?? new Date();
  const merged = new Map<string, CartLineInput>();
  for (const line of input.lines) {
    const key = `${line.productId}:${line.variantId ?? ''}`;
    const prev = merged.get(key);
    const qty = Math.max(1, Math.min(999, Math.floor(line.quantity) || 1));
    merged.set(key, { ...line, variantId: line.variantId ?? null, quantity: Math.min(999, (prev?.quantity ?? 0) + qty) });
  }

  const lines: PricedLine[] = [];
  for (const line of merged.values()) {
    const product = input.products.get(line.productId);
    const variant = line.variantId ? input.variants.get(line.variantId) : undefined;
    let error: LineError | null = null;
    let available: number | null = null;

    if (!product || !product.is_active) error = 'unavailable';
    else if (product.has_variants && !variant) error = line.variantId ? 'unavailable' : 'variant_required';
    else if (variant && (!variant.is_active || variant.product_id !== product.id)) error = 'unavailable';

    if (product && !error) {
      available = variant ? variant.stock : product.track_stock ? product.stock : null;
      if (available !== null) {
        if (available <= 0) error = 'out_of_stock';
        else if (line.quantity > available) error = 'insufficient_stock';
      }
    }

    const priced = product
      ? effectivePrice(product, input.promotions, input.chain, variant ?? null, now)
      : { price: 0, compareAt: null };
    lines.push({
      productId: line.productId,
      variantId: variant?.id ?? null,
      slug: product?.slug ?? '',
      name: product?.name ?? 'Mahsulot mavjud emas',
      variantName: variant?.name ?? null,
      sku: variant?.sku ?? product?.sku ?? null,
      imageUrl: product?.image_url ?? null,
      quantity: line.quantity,
      available,
      unitPrice: priced.price,
      originalPrice: priced.compareAt ?? priced.price,
      costPrice: product?.cost_price ?? null,
      lineTotal: error === 'unavailable' || error === 'variant_required' ? 0 : priced.price * line.quantity,
      couponDiscount: 0,
      categoryId: product?.category_id ?? null,
      error,
    });
  }

  const valid = lines.filter((l) => !l.error);
  const subtotal = valid.reduce((s, l) => s + l.lineTotal, 0);

  // Kupon
  let couponResult: QuoteResult['coupon'] = null;
  let couponError: CouponError | null = null;
  if (input.couponRequested) {
    const coupon = input.coupon ?? null;
    couponError = validateCoupon(coupon, now);
    if (!couponError && coupon) {
      if (subtotal < coupon.min_order_amount) couponError = 'min_order';
      else {
        const eligible = valid.filter((l) => appliesTo(coupon, l.productId, l.categoryId, input.chain));
        const eligibleTotal = eligible.reduce((s, l) => s + l.lineTotal, 0);
        if (eligibleTotal <= 0) couponError = 'not_applicable';
        else {
          let amount = discountAmount(coupon.discount_type, coupon.value, eligibleTotal);
          if (coupon.max_discount) amount = Math.min(amount, coupon.max_discount);
          // Chegirmani qatorlarga proporsional taqsimlash (hisobotlar uchun)
          let left = amount;
          eligible.forEach((l, i) => {
            const share = i === eligible.length - 1 ? left : Math.floor((amount * l.lineTotal) / eligibleTotal);
            l.couponDiscount = share;
            left -= share;
          });
          couponResult = { id: coupon.id, code: coupon.code, discount: amount };
        }
      }
    }
  }

  const discount = couponResult?.discount ?? 0;
  const afterDiscount = subtotal - discount;

  // Yetkazib berish
  const method = input.shippingMethod ?? null;
  const threshold = method?.free_from ?? input.freeShippingThreshold;
  let shipping = 0;
  if (method && method.kind !== 'pickup') {
    shipping = threshold > 0 && afterDiscount >= threshold ? 0 : method.price;
  }

  const costKnown = valid.every((l) => l.costPrice !== null);
  return {
    lines,
    subtotal,
    discount,
    shipping,
    total: afterDiscount + shipping,
    costTotal: valid.length && costKnown ? valid.reduce((s, l) => s + (l.costPrice ?? 0) * l.quantity, 0) : null,
    coupon: couponResult,
    couponError,
    freeShippingThreshold: threshold,
    amountToFreeShipping: threshold > 0 ? Math.max(0, threshold - afterDiscount) : 0,
    minOrderAmount: input.minOrderAmount,
    belowMinimum: afterDiscount < input.minOrderAmount,
    hasErrors: lines.some((l) => l.error) || valid.length === 0,
  };
}

export const couponErrorText: Record<CouponError, string> = {
  not_found: 'Promo-kod topilmadi',
  inactive: 'Promo-kod faol emas',
  expired: 'Promo-kod muddati tugagan',
  not_started: 'Promo-kod hali amal qilmaydi',
  limit_reached: 'Promo-koddan foydalanish limiti tugagan',
  min_order: 'Buyurtma summasi promo-kod uchun yetarli emas',
  not_applicable: 'Promo-kod savatchadagi mahsulotlarga tegishli emas',
};

export const lineErrorText: Record<LineError, string> = {
  unavailable: 'Mahsulot sotuvda yo‘q',
  variant_required: 'Variantni tanlang',
  out_of_stock: 'Omborda qolmagan',
  insufficient_stock: 'Omborda yetarli emas',
};
