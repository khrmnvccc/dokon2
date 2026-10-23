import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/admin/ui';
import { BannersManager } from '@/components/admin/banners-manager';
import type { Banner } from '@/lib/types';

export const metadata = { title: 'Bannerlar' };

export default async function BannersPage() {
  await requirePagePermission('banners.write');
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('banners').select('*').order('placement').order('sort_order');
  return (
    <div>
      <PageHeader title="Bannerlar" description="Bosh sahifa slayderi, o‘rta va aksiya bannerlari. Sana oralig‘i bo‘yicha avtomatik yoqiladi/o‘chadi." />
      <BannersManager banners={(data ?? []) as Banner[]} />
    </div>
  );
}
