import { getStaffContext } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PRODUCT_PUBLIC_COLUMNS } from '@/lib/data/columns';
import { fileResponse, toCsv, toXlsx } from '@/lib/admin/spreadsheet';
import { PRODUCT_SHEET_COLUMNS } from '@/lib/admin/product-columns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('products.read')) return new Response('Ruxsat yo‘q', { status: 403 });
  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
  const withCost = ctx.permissions.has('products.write') || ctx.permissions.has('reports.view');
  const supabase = await getServerSupabase();

  const products: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('products').select(PRODUCT_PUBLIC_COLUMNS).order('name').range(from, from + 999);
    if (error) return new Response('Eksport xatosi', { status: 500 });
    products.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  const [{ data: categories }, costs] = await Promise.all([
    supabase.from('categories').select('id, slug'),
    withCost && products.length ? supabase.rpc('admin_product_costs', { p_ids: products.map((p) => p.id) }) : Promise.resolve({ data: [] }),
  ]);
  const catSlug = new Map((categories ?? []).map((c) => [c.id, c.slug]));
  const cost = new Map(((costs.data ?? []) as { id: string; cost_price: number | null }[]).map((c) => [c.id, c.cost_price]));

  const columns = PRODUCT_SHEET_COLUMNS.filter((c) => withCost || c.key !== 'cost_price').map((c) => ({ ...c }));
  const rows = products.map((p) => ({
    ...(p as Record<string, string | number | boolean | null>),
    category: p.category_id ? catSlug.get(p.category_id as string) ?? '' : '',
    cost_price: cost.get(p.id as string) ?? null,
    is_active: p.is_active ? 1 : 0,
    is_featured: p.is_featured ? 1 : 0,
    is_bestseller: p.is_bestseller ? 1 : 0,
    is_new: p.is_new ? 1 : 0,
  }));
  const date = new Date().toISOString().slice(0, 10);
  const sheet = { columns, rows };
  return format === 'csv'
    ? fileResponse(toCsv(sheet), `mahsulotlar-${date}.csv`, 'csv')
    : fileResponse(await toXlsx(sheet, 'Mahsulotlar'), `mahsulotlar-${date}.xlsx`, 'xlsx');
}
