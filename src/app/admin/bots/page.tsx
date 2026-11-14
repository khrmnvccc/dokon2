import { requirePagePermission } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { Alert } from '@/components/ui/kit';
import { BotsManager } from '@/components/admin/messages-editor';
import { loadMessagesData } from '@/lib/telegram/messages-data';

export const metadata = { title: 'Telegram botlar' };
export const dynamic = 'force-dynamic';

/** Ikkala bot bitta joyda: doʻkon boti (xaridorlar) va admin boti (siz, guruh, xodimlar). */
export default async function BotsPage() {
  const ctx = await requirePagePermission('messages.manage');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div>
        <PageHeader title="Telegram botlar" />
        <Alert tone="warn">Serverda SUPABASE_SERVICE_ROLE_KEY sozlanmagan.</Alert>
      </div>
    );
  }
  const data = await loadMessagesData(ctx.roles.includes('super_admin'));
  return (
    <div>
      <PageHeader title="Telegram botlar" subtitle="Doʻkon boti va admin boti — ulash, sozlash va holati bitta joyda" />
      <BotsManager data={data} />
    </div>
  );
}
