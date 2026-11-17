import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { emptyProduct } from '@/lib/admin/products';
import { getRawSettings } from '@/lib/data/public';
import { PageHeader } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/product-form';

export const metadata = { title: 'Yangi mahsulot' };

export default async function NewProductPage() {
  const ctx = await requirePagePermission('products.write');
  const supabase = await getServerSupabase();
  const [{ data: categories }, settings] = await Promise.all([
    supabase.from('categories').select('id, name, parent_id').order('sort_order').order('name'),
    getRawSettings(),
  ]);
  // Kam qoldiq chegarasi — Ombor sozlamasidagi standart qiymat
  const defaults = { ...emptyProduct, low_stock_threshold: settings.stock_alerts.default_threshold } as typeof emptyProduct;
  return (
    <div>
      <PageHeader title="Yangi mahsulot" back={{ href: '/admin/products', label: 'Mahsulotlar' }} />
      <ProductForm id={null} defaults={defaults} categories={categories ?? []} canStock canDelete={false} canSeeCost={ctx.permissions.has('products.write')} />
    </div>
  );
}
