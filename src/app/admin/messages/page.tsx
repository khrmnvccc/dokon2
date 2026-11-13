import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/ui';
import { Alert } from '@/components/ui/kit';
import { MessagesEditor, type MessagesData } from '@/components/admin/messages-editor';
import { getTelegram, getTelegramErrors, getTemplateSettings, groupCode } from '@/lib/telegram/server';
import { getShopBot } from '@/lib/telegram/shop-bot';
import { ADMIN_URL, SITE_URL } from '@/lib/env';
import type { Broadcast } from '@/lib/telegram/templates';

export const metadata = { title: 'Matnlar / Push' };
export const dynamic = 'force-dynamic';

/**
 * Xabarlar (kassa 4-boʻlim). Maxfiy jadvallar faqat service role bilan oʻqiladi; brauzerga token va
 * chat id emas, faqat holat, bot nomi va bir martalik kodlar beriladi.
 */
export default async function MessagesPage() {
  const ctx = await requirePagePermission('messages.manage');
  const isOwner = ctx.roles.includes('super_admin');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div>
        <PageHeader title="Matnlar / Push" subtitle="Telegram bot, xabar matnlari va ommaviy xabarlar" />
        <Alert tone="warn">Serverda SUPABASE_SERVICE_ROLE_KEY sozlanmagan. README dagi “Telegram bot” boʻlimiga qarang.</Alert>
      </div>
    );
  }
  const service = getServiceSupabase();
  const supabase = await getServerSupabase();
  const [config, errors, templates, people, staff, log, logCount, broadcasts, subscribers, shopBot, shopSubs] = await Promise.all([
    getTelegram(),
    getTelegramErrors(),
    getTemplateSettings(),
    service.from('telegram_people').select('user_id, chat_name, linked_at'),
    supabase.rpc('admin_staff').then((r) => r, () => ({ data: [] })),
    service.from('telegram_log').select('id, at, template, chat, ok, text, error').order('id', { ascending: false }).limit(60),
    service.from('telegram_log').select('id', { count: 'exact', head: true }),
    service.from('broadcasts').select('id, title, text, buttons, audience, silent, send_at, status, delivered, failed, created_at, sent_at').order('id', { ascending: false }).limit(30),
    service.from('telegram_subscribers').select('chat_id', { count: 'exact', head: true }).eq('subscribed', true),
    getShopBot(),
    service.from('telegram_subscribers').select('chat_id', { count: 'exact', head: true }).eq('via', 'shop'),
  ]);

  const staffRows = ((staff.data ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>);
  const linked = new Map((people.data ?? []).map((p) => [p.user_id as string, p]));
  const data: MessagesData = {
    isOwner,
    telegram: config ? {
      botName: config.botName,
      connected: Boolean(config.chatId),
      chatName: config.chatName ?? null,
      code: config.chatId ? null : config.code,
      groupName: config.groupId ? config.groupName || 'Guruh' : null,
      groupCode: config.chatId && !config.groupId ? groupCode(config.token) : null,
      groupPaused: Boolean(config.groupId && config.groupPaused),
      personalPaused: Boolean(config.personalPaused),
      errors: errors.filter((e) => e.chat === 'personal' || config.groupId),
    } : null,
    templates,
    people: staffRows.map((s) => ({
      id: s.user_id, name: s.full_name || s.email || 'Xodim', linked: linked.has(s.user_id), chatName: linked.get(s.user_id)?.chat_name ?? null,
    })),
    log: (log.data ?? []) as MessagesData['log'],
    logTotal: logCount.count ?? 0,
    broadcasts: (broadcasts.data ?? []) as Broadcast[],
    subscribers: subscribers.count ?? 0,
    shopBot: shopBot ? { botName: shopBot.botName, webhookError: shopBot.webhookError ?? null, setupAt: shopBot.setupAt, users: shopSubs.count ?? 0 } : null,
    siteUrl: SITE_URL,
    adminUrl: ADMIN_URL,
  };

  return (
    <div>
      <PageHeader title="Matnlar / Push" subtitle="Telegram bot, xabar matnlari va ommaviy xabarlar" />
      <MessagesEditor data={data} />
    </div>
  );
}
