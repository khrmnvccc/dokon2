import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader, Panel } from '@/components/admin/ui';
import { StaffManager } from '@/components/admin/staff-manager';
import { ROLE_LABELS } from '@/lib/admin/nav';
import type { StaffRow } from '@/components/admin/staff-access';
import { getBranchState } from '@/lib/admin/branch';
import { getServiceSupabase } from '@/lib/supabase/admin';

export const metadata = { title: 'Xodimlar va rollar' };

const PERM_LABELS: Record<string, string> = {
  'dashboard.view': 'Dashboard', 'products.read': 'Mahsulotlarni ko‘rish', 'products.write': 'Mahsulotlarni tahrirlash', 'products.delete': 'Mahsulotlarni o‘chirish',
  'inventory.write': 'Ombor qoldig‘i', 'categories.write': 'Kategoriyalar', 'orders.read': 'Buyurtmalarni ko‘rish', 'orders.write': 'Buyurtmalarni boshqarish',
  'orders.fulfill': 'Yig‘ish va jo‘natish', 'orders.cancel': 'Bekor qilish/qaytarish', 'customers.read': 'Mijozlarni ko‘rish', 'customers.block': 'Mijozni bloklash',
  'banners.write': 'Bannerlar', 'promotions.write': 'Aksiyalar', 'coupons.write': 'Promo-kodlar', 'pages.write': 'Sahifalar', 'settings.write': 'Sayt sozlamalari',
  'payments.write': 'Yetkazish/to‘lov usullari', 'reports.view': 'Hisobotlar va tannarx', 'staff.manage': 'Xodimlar va rollar', 'audit.view': 'Audit jurnali',
  'reviews.moderate': 'Sharhlar', 'media.write': 'Rasm yuklash',
};

export default async function StaffPage() {
  const ctx = await requirePagePermission('staff.manage');
  const supabase = await getServerSupabase();
  const [{ data: staff }, { data: matrix }, branch] = await Promise.all([
    supabase.rpc('admin_staff'),
    supabase.from('role_permissions').select('role, permission'),
    getBranchState(),
  ]);
  // Telegram orqali kirgan xodimlarda email ichki (tg…@telegram.user): roʻyxatda ID, telefon va Telegram holati koʻrsatiladi.
  const rows = (staff ?? []) as StaffRow[];
  const ids = rows.map((r) => r.user_id);
  const service = getServiceSupabase();
  const [{ data: extra }, { data: tgLinked }] = ids.length ? await Promise.all([
    service.from('profiles').select('id, client_no, phone').in('id', ids),
    service.from('telegram_people').select('user_id').in('user_id', ids),
  ]) : [{ data: [] }, { data: [] }];
  const extraBy = new Map((extra ?? []).map((e) => [e.id as string, e as { client_no: number | null; phone: string | null }]));
  const tgSet = new Set((tgLinked ?? []).map((t) => t.user_id as string));
  const enriched = rows.map((r) => ({ ...r, client_no: extraBy.get(r.user_id)?.client_no ?? null, phone: extraBy.get(r.user_id)?.phone ?? null, telegram: tgSet.has(r.user_id) }));
  const roles = Object.keys(ROLE_LABELS);
  const perms = Object.keys(PERM_LABELS);
  const has = new Set((matrix ?? []).map((m) => `${m.role}:${m.permission}`));
  return (
    <div>
      <PageHeader title="Xodimlar va rollar" description="Xodim avval doʻkon botini ochib roʻyxatdan oʻtadi, soʻng uning ID raqami yoki telefoni bilan rol beriladi. Gmail shart emas." />
      <StaffManager staff={enriched} currentEmail={ctx.email} myPerms={[...ctx.permissions]}
        isOwner={ctx.roles.includes('super_admin')} branches={branch.all.filter((b) => b.is_active).map(({ id, name }) => ({ id, name }))} />
      <Panel title="Rollar va ruxsatlar" className="mt-4" padded={false}>
        <div className="overflow-x-auto">
          <table className="rtable w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-ink-3"><tr><th className="px-4 py-2 text-left">Ruxsat</th>{roles.map((r) => <th key={r} className="px-4 py-2">{ROLE_LABELS[r]}</th>)}</tr></thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p} className="border-t border-line">
                  <td className="px-4 py-2">{PERM_LABELS[p]} <span className="text-xs text-ink-3">({p})</span></td>
                  {roles.map((r) => <td key={r} className="px-4 py-2 text-center">{has.has(`${r}:${p}`) ? <span className="text-success" aria-label="bor">✓</span> : <span className="text-ink-3" aria-label="yo‘q">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-xs text-ink-3">Ruxsatlar bazadagi role_permissions jadvalidan olinadi va har bir amalda serverda (RLS va funksiyalarda) tekshiriladi.</p>
      </Panel>
    </div>
  );
}
