import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/admin/ui';
import { DiscountsManager } from '@/components/admin/discounts-manager';
import type { Promotion } from '@/lib/types';

export const metadata = { title: 'Aksiyalar' };

export default async function Page() {
  await requirePagePermission('promotions.write');
  const supabase = await getServerSupabase();
  const [{ data }, { data: categories }, { data: products }] = await Promise.all([
    supabase.from('promotions').select('*').order('sort_order', { ascending: true }),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('products').select('id, name').order('name').limit(2000),
  ]);
  return (
    <div>
      <PageHeader title="Aksiyalar" description="Avtomatik chegirmalar: saytda narx chegirma bilan ko‘rinadi. Bir nechta aksiya to‘g‘ri kelsa, eng kattasi qo‘llanadi." />
      <DiscountsManager kind="promotions" items={(data ?? []) as Promotion[]} categories={categories ?? []} products={products ?? []} />
    </div>
  );
}
