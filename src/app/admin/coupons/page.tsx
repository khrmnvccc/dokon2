import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/admin/ui';
import { DiscountsManager } from '@/components/admin/discounts-manager';
import type { Coupon } from '@/lib/types';

export const metadata = { title: 'Promo-kodlar' };

export default async function Page() {
  await requirePagePermission('coupons.write');
  const supabase = await getServerSupabase();
  const [{ data }, { data: categories }, { data: products }] = await Promise.all([
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('products').select('id, name').order('name').limit(2000),
  ]);
  return (
    <div>
      <PageHeader title="Promo-kodlar" description="Mijoz checkout’da kiritadigan kodlar. Barcha tekshiruvlar serverda bajariladi." />
      <DiscountsManager kind="coupons" items={(data ?? []) as Coupon[]} categories={categories ?? []} products={products ?? []} />
    </div>
  );
}
