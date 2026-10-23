import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { buildHref, pageParam } from '@/lib/admin/query';
import { formatDateTime } from '@/lib/format';
import { Pagination, Badge } from '@/components/ui/misc';
import { PageHeader, FilterBar, FilterField, Table, EmptyRow, inputSm } from '@/components/admin/ui';

export const metadata = { title: 'Audit jurnali' };
const PAGE = 50;
const ENTITY_LABELS: Record<string, string> = {
  products: 'Mahsulot', product_variants: 'Variant', categories: 'Kategoriya', orders: 'Buyurtma', coupons: 'Promo-kod', promotions: 'Aksiya',
  banners: 'Banner', pages: 'Sahifa', site_settings: 'Sozlama', shipping_methods: 'Yetkazish', payment_methods: 'To‘lov', user_roles: 'Rol', profiles: 'Mijoz', reviews: 'Sharh',
};
const ACTION_TONE: Record<string, 'green' | 'amber' | 'red' | 'gray'> = { INSERT: 'green', UPDATE: 'amber', DELETE: 'red' };
const ACTION_LABEL: Record<string, string> = { INSERT: 'Yaratildi', UPDATE: 'O‘zgartirildi', DELETE: 'O‘chirildi' };

function summarize(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
  const src = newData ?? oldData ?? {};
  const keys = Object.keys(src).filter((k) => !['id', 'updated_at', 'created_at'].includes(k));
  return keys.slice(0, 6).map((k) => {
    const v = (x: unknown) => (x === null || x === undefined ? '∅' : typeof x === 'object' ? JSON.stringify(x).slice(0, 60) : String(x).slice(0, 60));
    return oldData && newData ? `${k}: ${v(oldData[k])} → ${v(newData[k])}` : `${k}: ${v(src[k])}`;
  }).join('; ');
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; actor?: string; action?: string; page?: string }> }) {
  await requirePagePermission('audit.view');
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await getServerSupabase();
  let q = supabase.from('audit_logs').select('*', { count: 'exact' });
  if (sp.entity && sp.entity in ENTITY_LABELS) q = q.eq('entity', sp.entity);
  if (sp.action && sp.action in ACTION_LABEL) q = q.eq('action', sp.action);
  if (sp.actor) q = q.ilike('actor_email', `%${sp.actor.replace(/[%_\\]/g, '')}%`);
  const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  return (
    <div>
      <PageHeader title="Audit jurnali" description="Xodimlarning barcha o‘zgarishlari avtomatik yoziladi (bazadagi triggerlar orqali). Jurnalni tahrirlab bo‘lmaydi." />
      <FilterBar resetHref="/admin/audit">
        <FilterField label="Bo‘lim">
          <select name="entity" defaultValue={sp.entity ?? ''} className={inputSm}><option value="">Barchasi</option>{Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </FilterField>
        <FilterField label="Amal">
          <select name="action" defaultValue={sp.action ?? ''} className={inputSm}><option value="">Barchasi</option>{Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </FilterField>
        <FilterField label="Xodim emaili"><input name="actor" defaultValue={sp.actor} className={inputSm} /></FilterField>
      </FilterBar>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <Table>
          <thead><tr><th>Vaqt</th><th>Xodim</th><th>Amal</th><th>Bo‘lim</th><th>O‘zgarishlar</th></tr></thead>
          <tbody>
            {(data ?? []).length === 0 && <EmptyRow cols={5} />}
            {(data ?? []).map((l) => (
              <tr key={l.id} className="align-top">
                <td className="whitespace-nowrap text-muted">{formatDateTime(l.created_at)}</td>
                <td>{l.actor_email ?? '—'}</td>
                <td><Badge tone={ACTION_TONE[l.action] ?? 'gray'}>{ACTION_LABEL[l.action] ?? l.action}</Badge></td>
                <td>{ENTITY_LABELS[l.entity] ?? l.entity}<div className="font-mono text-[11px] text-muted">{String(l.entity_id ?? '').slice(0, 8)}</div></td>
                <td className="max-w-md break-words text-xs text-slate-600">{summarize(l.old_data, l.new_data)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} makeHref={(p) => buildHref('/admin/audit', sp, { page: p })} />
    </div>
  );
}
