import { requirePagePermission } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { Alert } from '@/components/ui/kit';
import { MessagesEditor } from '@/components/admin/messages-editor';
import { loadMessagesData } from '@/lib/telegram/messages-data';

export const metadata = { title: 'Xabarlar va Push' };
export const dynamic = 'force-dynamic';

/** Xabar matnlari, ommaviy xabarlar va yuborilganlar. Botlarni ulash — “Telegram → Botlar”. */
export default async function MessagesPage() {
  const ctx = await requirePagePermission('messages.manage');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div>
        <PageHeader title="Xabarlar va Push" />
        <Alert tone="warn">Serverda SUPABASE_SERVICE_ROLE_KEY sozlanmagan. README dagi “Telegram bot” boʻlimiga qarang.</Alert>
      </div>
    );
  }
  const data = await loadMessagesData(ctx.roles.includes('super_admin'));
  return (
    <div>
      <PageHeader title="Xabarlar va Push" subtitle="Botlar yuboradigan xabar matnlari, ommaviy xabarlar va jurnal" />
      <MessagesEditor data={data} />
    </div>
  );
}
