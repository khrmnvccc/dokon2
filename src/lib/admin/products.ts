import 'server-only';
import { getServerSupabase } from '@/lib/supabase/server';
import { PRODUCT_PUBLIC_COLUMNS } from '@/lib/data/columns';
import type { ProductInput } from '@/lib/admin/schemas';
import type { Product, ProductImage, ProductVariant } from '@/lib/types';

export const emptyProduct: ProductInput = {
  name: '', slug: '', short_description: '', description: '', category_id: '', brand: '', sku: '', barcode: '',
  price: '', compare_at_price: '', cost_price: '', stock: 0, low_stock_threshold: 5, track_stock: true, is_active: true,
  is_featured: false, is_bestseller: false, is_new: true, weight_grams: '', attributes: [], seo_title: '', seo_description: '',
  images: [], variants: [],
} as unknown as ProductInput;

/** Tahrirlash formasi uchun mahsulot (tannarx alohida RPC orqali, faqat ruxsat bo'lsa) */
export async function loadProductForEdit(id: string, withCost: boolean): Promise<ProductInput | null> {
  const supabase = await getServerSupabase();
  const { data: p } = await supabase.from('products').select(PRODUCT_PUBLIC_COLUMNS).eq('id', id).maybeSingle<Omit<Product, 'cost_price'>>();
  if (!p) return null;
  const [{ data: images }, { data: variants }, costs] = await Promise.all([
    supabase.from('product_images').select('*').eq('product_id', id).order('sort_order'),
    supabase.from('product_variants').select('*').eq('product_id', id).order('sort_order'),
    withCost ? supabase.rpc('admin_product_costs', { p_ids: [id] }) : Promise.resolve({ data: [] }),
  ]);
  const cost = ((costs.data ?? []) as { id: string; cost_price: number | null }[])[0]?.cost_price ?? null;
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    name: p.name, slug: p.slug, short_description: s(p.short_description), description: s(p.description),
    category_id: s(p.category_id), brand: s(p.brand), sku: s(p.sku), barcode: s(p.barcode),
    price: s(p.price), compare_at_price: s(p.compare_at_price), cost_price: s(cost), stock: p.stock,
    low_stock_threshold: p.low_stock_threshold, track_stock: p.track_stock, is_active: p.is_active, is_featured: p.is_featured,
    is_bestseller: p.is_bestseller, is_new: p.is_new, weight_grams: s(p.weight_grams), attributes: p.attributes ?? [],
    seo_title: s(p.seo_title), seo_description: s(p.seo_description),
    images: ((images ?? []) as ProductImage[]).map((i) => ({ id: i.id, url: i.url, storage_path: i.storage_path, alt: i.alt, is_primary: i.is_primary })),
    variants: ((variants ?? []) as ProductVariant[]).map((v) => ({
      id: v.id, name: v.name, sku: s(v.sku), color: s(v.color), color_hex: s(v.color_hex), size: s(v.size),
      price: s(v.price), compare_at_price: s(v.compare_at_price), stock: v.stock, is_active: v.is_active,
    })),
  } as unknown as ProductInput;
}
