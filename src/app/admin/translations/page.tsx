import { requirePagePermission } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { TranslationsEditor } from '@/components/admin/translations-editor';

export const metadata = { title: 'Tarjimalar' };
export const dynamic = 'force-dynamic';

export default async function TranslationsPage() {
  await requirePagePermission('settings.write');
  return (
    <div>
      <PageHeader title="Tarjimalar (ruscha)" subtitle="Saytdagi oʻzingiz yozgan matnlarning ruschasi: mahsulot, kategoriya, banner, sahifa, menyu va boshqalar" />
      <TranslationsEditor />
    </div>
  );
}
