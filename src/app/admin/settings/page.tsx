import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseSettings } from '@/lib/settings-schema';
import { PageHeader } from '@/components/admin/ui';
import { SettingsEditor } from '@/components/admin/settings-editor';

export const metadata = { title: 'Sozlamalar' };

export default async function SettingsPage() {
  await requirePagePermission('settings.write');
  const supabase = await getServerSupabase();
  // Keshsiz, to'g'ridan-to'g'ri bazadan
  const { data } = await supabase.from('site_settings').select('key, value');
  return (
    <div>
      <PageHeader title="Sayt sozlamalari" description="O‘zgarishlar saqlangandan so‘ng saytda darhol qo‘llanadi" />
      <SettingsEditor initial={parseSettings(data ?? [])} />
    </div>
  );
}
