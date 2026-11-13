import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { getCurrentProfile, getStaffContext, requireUser } from '@/lib/auth';
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
        <div className="flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger"><ShieldAlert className="size-5" /></div>
        <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Kirish taqiqlangan</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-3">Admin panel faqat xodimlar uchun. Agar xodim boʻlsangiz, Egaga murojaat qiling.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-[15px] font-medium text-primary-fg shadow-soft">Saytga qaytish</Link>
      </main>
    );
  }

  const supabase = await getServerSupabase();
  const canSeeNotifications = ctx.permissions.has('orders.read');
  const [settings, profile, notif] = await Promise.all([
    getSettings(),
    getCurrentProfile(),
    canSeeNotifications
      ? supabase.from('notifications').select('*', { count: 'exact' }).is('user_id', null).eq('is_read', false).order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [], count: 0 }),
  ]);

  const nav = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => ctx.permissions.has(i.perm)) })).filter((g) => g.items.length);
  return (
    <AdminShell
      nav={nav}
      email={ctx.email}
      name={profile?.full_name ?? null}
      languages={settings.localization.languages}
      primaryAction={ctx.permissions.has('products.write') ? { href: '/admin/products/new', label: 'Yangi mahsulot' } : null}
      roles={ctx.roles}
      notifications={(notif.data ?? []) as Notification[]}
      unread={notif.count ?? 0}
      canSearch={ctx.permissions.has('orders.read') || ctx.permissions.has('products.read')}
    >
      {children}
    </AdminShell>
  );
}
