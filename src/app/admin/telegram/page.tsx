import { requirePagePermission } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/ui';
import { Alert } from '@/components/ui/kit';
import { MyTelegram } from '@/components/admin/my-telegram';
import { getTelegram, getTemplateSettings, personCode } from '@/lib/telegram/server';
import { TEMPLATES } from '@/lib/telegram/templates';

export const metadata = { title: 'Mening Telegramim' };
export const dynamic = 'force-dynamic';

/** Har bir xodim oʻz Telegramini doʻkon botiga ulaydi; qaysi xabarlar kelishini Ega belgilaydi (kassa 4.3). */
export default async function MyTelegramPage() {
  const ctx = await requirePagePermission('dashboard.view');
  const config = process.env.SUPABASE_SERVICE_ROLE_KEY ? await getTelegram() : null;
  if (!config?.chatId) {
    return (
      <div>
        <PageHeader title="Mening Telegramim" />
        <Alert tone="warn">Doʻkon boti hali ulanmagan. Ega “Telegram → Botlar” boʻlimida admin botini ulagach, shu yerda oʻz Telegramingizni ulaysiz.</Alert>
      </div>
    );
  }
  const [{ data: row }, settings] = await Promise.all([
    getServiceSupabase().from('telegram_people').select('chat_name').eq('user_id', ctx.userId).maybeSingle(),
    getTemplateSettings(),
  ]);
  const messages = TEMPLATES.filter((t) => !settings.off.includes(t.key) && settings.chats[t.key]?.staff?.includes(ctx.userId)).map((t) => t.title);
  return (
    <div>
      <PageHeader title="Mening Telegramim" subtitle="Doʻkon botidan oʻzingizga xabar olish" />
      <MyTelegram botName={config.botName} linked={Boolean(row)} chatName={row?.chat_name ?? null}
        code={row ? null : personCode(config.token, ctx.userId)} messages={messages} />
    </div>
  );
}
