import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseSettings } from '@/lib/settings-schema';
import { PageHeader } from '@/components/admin/ui';
import { SettingsEditor } from '@/components/admin/settings-editor';

export const metadata = { title: 'Sozlamalar' };

export default async function SettingsPage() {
  const ctx = await requirePagePermission('settings.write');
  const supabase = await getServerSupabase();
  // Keshsiz, to'g'ridan-to'g'ri bazadan
  const [{ data }, { data: branches }] = await Promise.all([
    supabase.from('site_settings').select('key, value'),
    supabase.from('branches').select('id, name, is_active').order('sort_order').order('id'),
  ]);
  return (
    <div>
      <PageHeader title="Sozlamalar" subtitle="Oʻzgarishlar saqlangandan soʻng saytda darhol qoʻllanadi" />
      <SettingsEditor initial={parseSettings(data ?? [])} isOwner={ctx.roles.includes('super_admin')} branches={branches ?? []} />
    </div>
  );
}
