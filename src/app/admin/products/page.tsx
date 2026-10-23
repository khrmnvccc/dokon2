import Link from 'next/link';
import { Download, Plus, Upload } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { buildHref, likeTerm, pageParam } from '@/lib/admin/query';
import { PageHeader, FilterBar, FilterField, inputSm } from '@/components/admin/ui';
import { Pagination } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';
import { ProductsTable, type AdminProductRow } from '@/components/admin/products-table';

const PAGE = 25;
type SP = { q?: string; category?: string; status?: string; stock?: string; flag?: string; page?: string; sort?: string };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requirePagePermission('products.read');
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await getServerSupabase();

  let query = supabase
    .from('products')
    .select('id, name, slug, sku, price, compare_at_price, stock, low_stock_threshold, track_stock, has_variants, is_active, is_featured, is_bestseller, is_new, image_url, sold_count, category_id, updated_at', { count: 'exact' });
  if (sp.q) {
    const t = likeTerm(sp.q);
    query = query.or(`name.ilike.${t},sku.ilike.${t},barcode.eq.${sp.q.replace(/[^\w-]/g, '')},brand.ilike.${t}`);
  }
  if (sp.category === 'none') query = query.is('category_id', null);
  else if (sp.category) query = query.eq('category_id', sp.category);
  if (sp.status === 'active') query = query.eq('is_active', true);
  if (sp.status === 'inactive') query = query.eq('is_active', false);
  if (sp.stock === 'out') query = query.eq('track_stock', true).lte('stock', 0);
  if (sp.stock === 'in') query = query.or('stock.gt.0,track_stock.eq.false');
  if (sp.flag === 'featured' || sp.flag === 'bestseller' || sp.flag === 'new') query = query.eq(`is_${sp.flag}`, true);
  const sort = sp.sort ?? 'updated';
  query =
    sort === 'name' ? query.order('name') :
    sort === 'price_asc' ? query.order('price') :
    sort === 'price_desc' ? query.order('price', { ascending: false }) :
    sort === 'stock' ? query.order('stock') :
    sort === 'sold' ? query.order('sold_count', { ascending: false }) :
    query.order('updated_at', { ascending: false });

  const [{ data, count, error }, { data: categories }] = await Promise.all([
    query.range((page - 1) * PAGE, page * PAGE - 1),
    supabase.from('categories').select('id, name, parent_id').order('sort_order').order('name'),
  ]);
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const rows: AdminProductRow[] = (data ?? []).map((p) => ({ ...p, category_name: p.category_id ? catName.get(p.category_id) ?? null : null }));

  return (
    <div>
      <PageHeader
        title="Mahsulotlar"
        description={`${count ?? 0} ta mahsulot`}
        actions={
          <>
            <Link href={`/admin/products/export?format=xlsx`} className={buttonClass('outline', 'sm')} prefetch={false}><Download className="h-4 w-4" /> Excel</Link>
            <Link href={`/admin/products/export?format=csv`} className={buttonClass('outline', 'sm')} prefetch={false}><Download className="h-4 w-4" /> CSV</Link>
            {ctx.permissions.has('products.write') && (
              <>
                <Link href="/admin/products/import" className={buttonClass('outline', 'sm')}><Upload className="h-4 w-4" /> Import</Link>
                <Link href="/admin/products/new" className={buttonClass('primary', 'sm')}><Plus className="h-4 w-4" /> Yangi mahsulot</Link>
              </>
            )}
          </>
        }
      />
      <FilterBar resetHref="/admin/products">
        <FilterField label="Qidiruv"><input name="q" defaultValue={sp.q} placeholder="Nomi, SKU, shtrix-kod" className={`${inputSm} w-56`} /></FilterField>
        <FilterField label="Kategoriya">
          <select name="category" defaultValue={sp.category ?? ''} className={inputSm}>
            <option value="">Barchasi</option>
            <option value="none">Kategoriyasiz</option>
            {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Holat">
          <select name="status" defaultValue={sp.status ?? ''} className={inputSm}>
            <option value="">Barchasi</option><option value="active">Faol</option><option value="inactive">Yashirin</option>
          </select>
        </FilterField>
        <FilterField label="Qoldiq">
          <select name="stock" defaultValue={sp.stock ?? ''} className={inputSm}>
            <option value="">Barchasi</option><option value="in">Mavjud</option><option value="out">Tugagan</option>
          </select>
        </FilterField>
        <FilterField label="Belgi">
          <select name="flag" defaultValue={sp.flag ?? ''} className={inputSm}>
            <option value="">—</option><option value="featured">Tavsiya</option><option value="bestseller">Xit</option><option value="new">Yangi</option>
          </select>
        </FilterField>
        <FilterField label="Saralash">
          <select name="sort" defaultValue={sort} className={inputSm}>
            <option value="updated">Oxirgi o‘zgargan</option><option value="name">Nomi</option><option value="price_asc">Arzon</option>
            <option value="price_desc">Qimmat</option><option value="stock">Qoldiq kam</option><option value="sold">Ko‘p sotilgan</option>
          </select>
        </FilterField>
      </FilterBar>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Yuklab bo‘lmadi: {error.message}</p>}
      <ProductsTable
        rows={rows}
        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
        canWrite={ctx.permissions.has('products.write')}
        canDelete={ctx.permissions.has('products.delete')}
      />
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} makeHref={(p) => buildHref('/admin/products', sp, { page: p })} />
    </div>
  );
}
