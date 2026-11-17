import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseSettings } from '@/lib/settings-schema';
import { smsStatus } from '@/lib/sms/eskiz';
import { formatDateTime } from '@/lib/format';
import { PageHeader, Panel, Table, EmptyRow } from '@/components/admin/ui';
import { Badge } from '@/components/ui/misc';
import { SmsConnect, SmsEventsSettings } from '@/components/admin/sms-ui';

export const metadata = { title: 'SMS (Eskiz)' };

export default async function SmsPage() {
  const ctx = await requirePagePermission('messages.manage');
  const supabase = await getServerSupabase();
  const [{ data: setRows }, status, { data: logs }] = await Promise.all([
    supabase.from('site_settings').select('key, value').eq('key', 'sms'),
    smsStatus(),
    supabase.from('sms_log').select('id, phone, event, text, ok, error, created_at').order('created_at', { ascending: false }).limit(50),
  ]);
  return (
    <div>
      <PageHeader title="SMS xabarlar" description="Telegram ishlatmaydigan mijozlarga buyurtma holati SMS orqali (Eskiz.uz)" />
      <div className="grid gap-4 xl:grid-cols-[1fr_440px] xl:items-start">
        <div className="space-y-4">
          <SmsConnect status={status} isOwner={ctx.roles.includes('super_admin')} />
          <SmsEventsSettings initial={parseSettings(setRows ?? []).sms} canEdit={ctx.permissions.has('settings.write')} />
        </div>
        <Panel title="Oxirgi SMS’lar" padded={false}>
          <Table>
            <thead><tr><th>Vaqt</th><th>Kimga</th><th>Natija</th></tr></thead>
            <tbody>
              {(logs ?? []).length === 0 && <EmptyRow cols={3} text="Hali SMS yuborilmagan" />}
              {(logs ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-ink-3">{formatDateTime(l.created_at)}<span className="block text-xs">{l.event}</span></td>
                  <td className="tabular-nums">{l.phone}<span className="block max-w-48 truncate text-xs text-ink-3" title={l.text}>{l.text}</span></td>
                  <td>{l.ok ? <Badge tone="success">Ketdi</Badge> : <Badge tone="danger" className="max-w-40 truncate">{l.error ?? 'Xato'}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}
