import { requirePagePermission } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { ToursEditor } from '@/components/admin/tours-editor';
import { getTours } from '@/lib/data/tours';
import { SITE_URL } from '@/lib/env';

export const metadata = { title: 'Yoʻl-yoʻriq' };
export const dynamic = 'force-dynamic';

export default async function ToursPage() {
  await requirePagePermission('settings.write');
  const tours = await getTours();
  return (
    <div>
      <PageHeader title="Yoʻl-yoʻriq" subtitle="Doʻkon va admin paneldagi tushuntirish oynalari — matni, joyi va tartibi" />
      <ToursEditor initial={tours} siteUrl={SITE_URL} />
    </div>
  );
}
