import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { getStaffContext, requireUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { ADMIN_NAV } from '@/lib/admin/nav';
import { AdminShell } from '@/components/admin/shell';
import type { Notification } from '@/lib/types';

export const metadata: Metadata = { title: { default: 'Admin panel', template: '%s · Admin' }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/admin');
  const ctx = await getStaffContext();
  if (!ctx) {
    // Oddiy mijoz: admin panelga kirish yo'q (rol faqat super admin tomonidan beriladi)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <ShieldAlert className="h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold">Kirish taqiqlangan</h1>
        <p className="mt-2 max-w-sm text-muted">Admin panel faqat xodimlar uchun. Agar xodim bo‘lsangiz, administratorga murojaat qiling.</p>
        <Link href="/" className="mt-6 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">Saytga qaytish</Link>
      </main>
    );
  }

  const supabase = await getServerSupabase();
  const canSeeNotifications = ctx.permissions.has('orders.read');
  const [settings, notif] = await Promise.all([
    getSettings(),
    canSeeNotifications
      ? supabase.from('notifications').select('*', { count: 'exact' }).is('user_id', null).eq('is_read', false).order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [], count: 0 }),
  ]);

  const nav = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => ctx.permissions.has(i.perm)) })).filter((g) => g.items.length);
  return (
    <AdminShell
      nav={nav}
      storeName={settings.store.name}
      email={ctx.email}
      roles={ctx.roles}
      notifications={(notif.data ?? []) as Notification[]}
      unread={notif.count ?? 0}
      canSearch={ctx.permissions.has('orders.read') || ctx.permissions.has('products.read')}
    >
      {children}
    </AdminShell>
  );
}
