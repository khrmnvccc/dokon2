import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/admin/ui';
import { DiscountTabs } from '@/components/admin/discount-tabs';
import { DiscountsManager } from '@/components/admin/discounts-manager';
import { FlashSettings } from '@/components/admin/flash-settings';
import { parseSettings } from '@/lib/settings-schema';
import type { Promotion } from '@/lib/types';

export const metadata = { title: 'Aksiyalar' };

export default async function Page() {
  const ctx = await requirePagePermission('promotions.write');
  const supabase = await getServerSupabase();
  const [{ data }, { data: categories }, { data: products }, { data: setRows }] = await Promise.all([
    supabase.from('promotions').select('*').order('sort_order', { ascending: true }),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('products').select('id, name').order('name').limit(2000),
    supabase.from('site_settings').select('key, value').eq('key', 'flash_sale'),
  ]);
  return (
    <div>
      <PageHeader title="Aksiyalar" description="Avtomatik chegirmalar: saytda narx chegirma bilan ko‘rinadi. Bir nechta aksiya to‘g‘ri kelsa, eng kattasi qo‘llanadi." />
      <DiscountTabs active="/admin/promotions" />
      <DiscountsManager kind="promotions" items={(data ?? []) as Promotion[]} categories={categories ?? []} products={products ?? []} />
      <FlashSettings initial={parseSettings(setRows ?? []).flash_sale} canEdit={ctx.permissions.has('settings.write')} />
    </div>
  );
}
