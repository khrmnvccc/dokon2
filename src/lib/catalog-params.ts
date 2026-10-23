import type { CatalogParams } from '@/lib/data/public';

export const PAGE_SIZE = 24;
const SORTS = ['popular', 'price_asc', 'price_desc', 'new', 'rating', 'discount'] as const;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? v.split(',') : []).map((s) => s.trim()).filter(Boolean).slice(0, 20);
const num = (v: string | undefined) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
};

/** URL query -> katalog filtrlari (noto'g'ri qiymatlar e'tiborsiz qoldiriladi) */
export function parseCatalogParams(sp: SP): { params: CatalogParams; page: number } {
  const page = Math.max(1, Math.min(500, num(one(sp.page)) ?? 1));
  const sort = one(sp.sort);
  const rating = Number(one(sp.rating));
  return {
    page,
    params: {
      q: one(sp.q)?.trim().slice(0, 100) || undefined,
      min_price: num(one(sp.min)),
      max_price: num(one(sp.max)),
      discount: one(sp.discount) === '1' || undefined,
      in_stock: one(sp.stock) === '1' || undefined,
      min_rating: rating >= 1 && rating <= 5 ? rating : undefined,
      colors: list(sp.color),
      sizes: list(sp.size),
      new: one(sp.new) === '1' || undefined,
      featured: one(sp.featured) === '1' || undefined,
      bestseller: one(sp.bestseller) === '1' || undefined,
      sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as CatalogParams['sort']) : 'popular',
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
  };
}
