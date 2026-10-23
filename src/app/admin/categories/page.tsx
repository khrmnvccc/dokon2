import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/admin/ui';
import { CategoriesManager } from '@/components/admin/categories-manager';
import type { Category } from '@/lib/types';

export const metadata = { title: 'Kategoriyalar' };

export default async function CategoriesPage() {
  await requirePagePermission('categories.write');
  const supabase = await getServerSupabase();
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('products').select('category_id'),
  ]);
  const productCount: Record<string, number> = {};
  for (const r of counts ?? []) if (r.category_id) productCount[r.category_id] = (productCount[r.category_id] ?? 0) + 1;
  return (
    <div>
      <PageHeader title="Kategoriyalar" description="Tartib, rasm, ikonka va bosh sahifada ko‘rinishi" />
      <CategoriesManager categories={(data ?? []) as Category[]} productCount={productCount} />
    </div>
  );
}
