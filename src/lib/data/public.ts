import 'server-only';
import { unstable_cache } from 'next/cache';
import { getPublicSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { TAGS } from '@/lib/cache-tags';
import { defaultSettings, parseSettings, type SiteSettings } from '@/lib/settings-schema';
import { buildCategoryChain, effectivePrice } from '@/lib/pricing';
import { PRODUCT_PUBLIC_COLUMNS } from '@/lib/data/columns';
import type {
  Banner, Category, CategoryNode, CmsPage, PaymentMethod, Product, ProductCard, ProductImage, ProductVariant,
  Promotion, Review, ShippingMethod,
} from '@/lib/types';

const REVALIDATE = 300;

export const getSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    if (!isSupabaseConfigured) return defaultSettings;
    const { data, error } = await getPublicSupabase().from('site_settings').select('key, value');
    if (error) {
      console.error('settings', error.message);
      return defaultSettings;
    }
    return parseSettings(data ?? []);
  },
  ['site-settings'],
  { tags: [TAGS.settings], revalidate: REVALIDATE },
);

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    if (!isSupabaseConfigured) return [];
    const { data } = await getPublicSupabase().from('categories').select('*').eq('is_active', true).order('sort_order').order('name');
    return (data ?? []) as Category[];
  },
  ['categories'],
  { tags: [TAGS.categories], revalidate: REVALIDATE },
);

export function buildTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function getCategoryTree() {
  return buildTree(await getCategories());
}

export const getActivePromotions = unstable_cache(
  async (): Promise<Promotion[]> => {
    if (!isSupabaseConfigured) return [];
    const { data } = await getPublicSupabase().from('promotions').select('*').order('sort_order');
    return (data ?? []) as Promotion[];
  },
  ['promotions'],
  { tags: [TAGS.promotions], revalidate: 120 },
);

export const getBanners = unstable_cache(
  async (placement: Banner['placement']): Promise<Banner[]> => {
    if (!isSupabaseConfigured) return [];
    const { data } = await getPublicSupabase().from('banners').select('*').eq('placement', placement).order('sort_order');
    return (data ?? []) as Banner[];
  },
  ['banners'],
  { tags: [TAGS.banners], revalidate: 120 },
);

/** Kartalarga aksiya narxlarini qo'llash */
export async function applyPromotions<T extends ProductCard>(cards: T[]): Promise<T[]> {
  const [promotions, categories] = await Promise.all([getActivePromotions(), getCategories()]);
  if (!promotions.length) return cards;
  const chain = buildCategoryChain(categories);
  return cards.map((card) => {
    const eff = effectivePrice(card, promotions, chain);
    return { ...card, price: eff.price, compare_at_price: eff.compareAt };
  });
}

export interface CatalogParams {
  q?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  discount?: boolean;
  in_stock?: boolean;
  min_rating?: number;
  colors?: string[];
  sizes?: string[];
  featured?: boolean;
  bestseller?: boolean;
  new?: boolean;
  ids?: string[];
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'new' | 'rating' | 'discount';
  limit?: number;
  offset?: number;
}

const fetchCatalog = unstable_cache(
  async (paramsJson: string): Promise<{ items: ProductCard[]; total: number }> => {
    if (!isSupabaseConfigured) return { items: [], total: 0 };
    const { data, error } = await getPublicSupabase().rpc('catalog_products', { p: JSON.parse(paramsJson) });
    if (error) {
      console.error('catalog', error.message);
      return { items: [], total: 0 };
    }
    return data as { items: ProductCard[]; total: number };
  },
  ['catalog'],
  { tags: [TAGS.products], revalidate: 120 },
);

export async function getCatalog(params: CatalogParams) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
  const result = await fetchCatalog(JSON.stringify(clean));
  return { ...result, items: await applyPromotions(result.items) };
}

export const getFacets = unstable_cache(
  async (categorySlug: string | null) => {
    if (!isSupabaseConfigured) return { min_price: 0, max_price: 0, colors: [], sizes: [] };
    const { data } = await getPublicSupabase().rpc('catalog_facets', { p_category_slug: categorySlug });
    return (data ?? { min_price: 0, max_price: 0, colors: [], sizes: [] }) as {
      min_price: number | null; max_price: number | null; colors: { name: string; hex: string | null }[]; sizes: string[];
    };
  },
  ['facets'],
  { tags: [TAGS.products], revalidate: 300 },
);

export interface ProductDetail {
  product: Product;
  images: ProductImage[];
  variants: ProductVariant[];
}

const fetchProduct = unstable_cache(
  async (slug: string): Promise<ProductDetail | null> => {
    if (!isSupabaseConfigured) return null;
    const supabase = getPublicSupabase();
    const { data: product } = await supabase.from('products').select(PRODUCT_PUBLIC_COLUMNS).eq('slug', slug).eq('is_active', true).maybeSingle<Omit<Product, 'cost_price'>>();
    if (!product) return null;
    const [{ data: images }, { data: variants }] = await Promise.all([
      supabase.from('product_images').select('*').eq('product_id', product.id).order('is_primary', { ascending: false }).order('sort_order'),
      supabase.from('product_variants').select('*').eq('product_id', product.id).eq('is_active', true).order('sort_order'),
    ]);
    return { product: { ...product, cost_price: null } as Product, images: (images ?? []) as ProductImage[], variants: (variants ?? []) as ProductVariant[] };
  },
  ['product'],
  { tags: [TAGS.products], revalidate: 300 },
);

/** Mahsulot + aksiya qo'llangan narxlar (variantlar uchun ham) */
export async function getProduct(slug: string) {
  const detail = await fetchProduct(slug);
  if (!detail) return null;
  const [promotions, categories] = await Promise.all([getActivePromotions(), getCategories()]);
  const chain = buildCategoryChain(categories);
  const eff = effectivePrice(detail.product, promotions, chain);
  const variants = detail.variants.map((v) => {
    const ve = effectivePrice(detail.product, promotions, chain, v);
    return { ...v, price: ve.price, compare_at_price: ve.compareAt };
  });
  return {
    ...detail,
    product: { ...detail.product, price: eff.price, compare_at_price: eff.compareAt },
    variants,
    promotion: eff.promotion,
  };
}

export const getProductReviews = unstable_cache(
  async (productId: string): Promise<Review[]> => {
    if (!isSupabaseConfigured) return [];
    const { data } = await getPublicSupabase()
      .from('reviews').select('*').eq('product_id', productId).eq('is_approved', true)
      .order('created_at', { ascending: false }).limit(50);
    return (data ?? []) as Review[];
  },
  ['reviews'],
  { tags: [TAGS.reviews], revalidate: 300 },
);

export const getPage = unstable_cache(
  async (slug: string): Promise<CmsPage | null> => {
    if (!isSupabaseConfigured) return null;
    const { data } = await getPublicSupabase().from('pages').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
    return (data as CmsPage) ?? null;
  },
  ['page'],
  { tags: [TAGS.pages], revalidate: REVALIDATE },
);

export const getShippingMethods = unstable_cache(
  async (): Promise<ShippingMethod[]> => {
    if (!isSupabaseConfigured) return [];
    const { data } = await getPublicSupabase().from('shipping_methods').select('*').eq('is_active', true).order('sort_order');
    return (data ?? []) as ShippingMethod[];
  },
  ['shipping-methods'],
  { tags: [TAGS.methods], revalidate: REVALIDATE },
);

export const getPaymentMethods = unstable_cache(
  async (): Promise<PaymentMethod[]> => {
    if (!isSupabaseConfigured) return [];
    const { data } = await getPublicSupabase().from('payment_methods').select('*').eq('is_active', true).order('sort_order');
    return (data ?? []) as PaymentMethod[];
  },
  ['payment-methods'],
  { tags: [TAGS.methods], revalidate: REVALIDATE },
);
