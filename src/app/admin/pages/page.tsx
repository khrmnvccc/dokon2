import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/admin/ui';
import { PagesManager } from '@/components/admin/pages-manager';
import type { CmsPage } from '@/lib/types';

export const metadata = { title: 'Sahifalar' };

export default async function PagesAdmin() {
  await requirePagePermission('pages.write');
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('pages').select('*').order('slug');
  return (
    <div>
      <PageHeader title="Sahifalar" description="Biz haqimizda, yetkazib berish, FAQ, maxfiylik va boshqa ma’lumot sahifalari (Markdown)" />
      <PagesManager pages={(data ?? []) as CmsPage[]} />
    </div>
  );
}
