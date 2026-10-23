import 'server-only';
import { getPublicSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getActivePromotions, getCategories, getSettings, getShippingMethods } from '@/lib/data/public';
import { buildCategoryChain, computeQuote, type CartLineInput, type PricingProduct, type PricingVariant, type QuoteResult } from '@/lib/pricing';
import type { Coupon, ShippingMethod } from '@/lib/types';

export const hasServiceKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const PRICING_COLUMNS = 'id, name, slug, price, compare_at_price, category_id, stock, track_stock, has_variants, is_active, image_url, sku';

/**
 * Savatcha narxini bazadagi haqiqiy ma'lumotlardan hisoblaydi.
 * Mijoz yuborgan narx yoki chegirmaga hech qachon ishonilmaydi.
 */
export async function buildQuote(opts: {
  items: CartLineInput[];
  couponCode?: string | null;
  shippingMethodId?: string | null;
  /** true — tannarxni ham o'qiydi (faqat buyurtma yaratishda, service role bilan) */
  withCost?: boolean;
}): Promise<{ quote: QuoteResult; shippingMethod: ShippingMethod | null }> {
  const service = hasServiceKey() ? getServiceSupabase() : null;
  const db = service ?? getPublicSupabase();
  const productIds = [...new Set(opts.items.map((i) => i.productId))];
  const variantIds = [...new Set(opts.items.map((i) => i.variantId).filter((v): v is string => Boolean(v)))];

  const [productsRes, variantsRes, promotions, categories, settings, shippingMethods] = await Promise.all([
    productIds.length
      ? db.from('products').select(opts.withCost && service ? `${PRICING_COLUMNS}, cost_price` : PRICING_COLUMNS).in('id', productIds)
      : Promise.resolve({ data: [] }),
    variantIds.length
      ? db.from('product_variants').select('id, product_id, name, sku, price, compare_at_price, stock, is_active').in('id', variantIds)
      : Promise.resolve({ data: [] }),
    getActivePromotions(),
    getCategories(),
    getSettings(),
    getShippingMethods(),
  ]);

  const products = new Map<string, PricingProduct>(
    ((productsRes.data ?? []) as unknown as (Omit<PricingProduct, 'cost_price'> & { cost_price?: number | null })[]).map((p) => [
      p.id,
      { ...p, cost_price: p.cost_price ?? null },
    ]),
  );
  const variants = new Map<string, PricingVariant>(((variantsRes.data ?? []) as PricingVariant[]).map((v) => [v.id, v]));

  const code = opts.couponCode?.trim().toUpperCase() || null;
  let coupon: Coupon | null = null;
  if (code && service) {
    // Kuponlar jadvali mijozlarga yopiq (RLS) — faqat server o'qiydi
    const { data } = await service.from('coupons').select('*').eq('code', code).maybeSingle();
    coupon = (data as Coupon) ?? null;
  }

  const shippingMethod = shippingMethods.find((m) => m.id === opts.shippingMethodId) ?? null;
  const quote = computeQuote({
    lines: opts.items,
    products,
    variants,
    promotions,
    chain: buildCategoryChain(categories),
    coupon,
    couponRequested: Boolean(code),
    shippingMethod,
    freeShippingThreshold: settings.checkout.free_shipping_threshold,
    minOrderAmount: settings.checkout.min_order_amount,
  });
  return { quote, shippingMethod };
}
