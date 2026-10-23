import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { PageHeader, Panel } from '@/components/admin/ui';
import { StaffManager } from '@/components/admin/staff-manager';
import { ROLE_LABELS } from '@/lib/admin/nav';

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
  const [{ data: staff }, { data: matrix }] = await Promise.all([
    supabase.rpc('admin_staff'),
    supabase.from('role_permissions').select('role, permission'),
  ]);
  const roles = Object.keys(ROLE_LABELS);
  const perms = Object.keys(PERM_LABELS);
  const has = new Set((matrix ?? []).map((m) => `${m.role}:${m.permission}`));
  return (
    <div>
      <PageHeader title="Xodimlar va rollar" description="Rol berish uchun xodim avval saytda oddiy foydalanuvchi sifatida ro‘yxatdan o‘tishi kerak." />
      <StaffManager staff={(staff ?? []) as { user_id: string; email: string | null; full_name: string | null; roles: string[] }[]} currentEmail={ctx.email} />
      <Panel title="Rollar va ruxsatlar" className="mt-4" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Ruxsat</th>{roles.map((r) => <th key={r} className="px-4 py-2">{ROLE_LABELS[r]}</th>)}</tr></thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p} className="border-t border-line">
                  <td className="px-4 py-2">{PERM_LABELS[p]} <span className="text-xs text-muted">({p})</span></td>
                  {roles.map((r) => <td key={r} className="px-4 py-2 text-center">{has.has(`${r}:${p}`) ? <span className="text-emerald-600" aria-label="bor">✓</span> : <span className="text-slate-300" aria-label="yo‘q">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-xs text-muted">Ruxsatlar bazadagi role_permissions jadvalidan olinadi va har bir amalda serverda (RLS va funksiyalarda) tekshiriladi.</p>
      </Panel>
    </div>
  );
}
