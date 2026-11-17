import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { parseSettings } from '@/lib/settings-schema';
import { getShopBot } from '@/lib/telegram/shop-bot';
import { formatDateTime } from '@/lib/format';
import { PageHeader, Panel, Table, EmptyRow } from '@/components/admin/ui';
import { Badge } from '@/components/ui/misc';
import { ChannelSettings } from '@/components/admin/channel-ui';

export const metadata = { title: 'Kanalga post' };

export default async function ChannelPage() {
  const ctx = await requirePagePermission('messages.manage');
  const supabase = await getServerSupabase();
  const { data: setRows } = await supabase.from('site_settings').select('key, value').eq('key', 'channel_post');
  const shop = await getShopBot().catch(() => null);
  let logs: { id: number; template: string; chat: string; error: string | null; at: string }[] = [];
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await getServiceSupabase().from('telegram_log').select('id, template, chat, error, at').like('template', 'channel:%').order('at', { ascending: false }).limit(30);
    logs = (data ?? []) as typeof logs;
  }
  return (
    <div>
      <PageHeader title="Telegram kanalga post" description="Yangi mahsulot va flash sale kanalingizga rasm, narx va “Sotib olish” tugmasi bilan oʻzi chiqadi" />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:items-start">
        <ChannelSettings initial={parseSettings(setRows ?? []).channel_post} canEdit={ctx.permissions.has('settings.write')} botName={shop?.botName ? `@${shop.botName.replace(/^@/, "")}` : null} />
        <Panel title="Oxirgi postlar" padded={false}>
          <Table>
            <thead><tr><th>Vaqt</th><th>Turi</th><th>Natija</th></tr></thead>
            <tbody>
              {logs.length === 0 && <EmptyRow cols={3} text="Hali post chiqmagan" />}
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-ink-3">{formatDateTime(l.at)}</td>
                  <td>{l.template === 'channel:flash' ? 'Flash sale' : 'Mahsulot'}</td>
                  <td>{l.error ? <Badge tone="danger">{l.error.slice(0, 60)}</Badge> : <Badge tone="success">Chiqdi</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}
