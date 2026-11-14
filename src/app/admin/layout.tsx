import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { PauseCircle, ShieldAlert } from 'lucide-react';
import { getCurrentProfile, getStaffContext, requireUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getRawSettings as getSettings } from '@/lib/data/public';
import { ADMIN_NAV } from '@/lib/admin/nav';
import { canSee, pageAccess, pageConfig, pageLabel } from '@/lib/admin/pages';
import { getBranchState } from '@/lib/admin/branch';
import { roleLabel } from '@/lib/perms';
import { getTours } from '@/lib/data/tours';
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
  const [settings, profile, branches, staffRow, notif] = await Promise.all([
    getSettings(),
    getCurrentProfile(),
    getBranchState(),
    supabase.from('staff_members').select('perms').eq('user_id', ctx.userId).maybeSingle(),
    canSeeNotifications
      ? supabase.from('notifications').select('*', { count: 'exact' }).is('user_id', null).eq('is_read', false).order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [], count: 0 }),
  ]);

  // Menyu: ruxsat + "Oynalar" sozlamasi (kim ko'radi, nomi, "Vaqtincha" belgisi)
  const pages = settings.pages;
  const nav = ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canSee(ctx, i, pages)).map((i) => ({ ...i, label: pageLabel(pages, i), paused: pageConfig(pages, i.href).paused })),
  })).filter((g) => g.items.length);
  const pathname = (await headers()).get('x-pathname') ?? '/admin';
  const access = pageAccess(ctx, pathname, pages);
  const body = access === 'paused' ? (
    <PageNotice icon={<PauseCircle className="size-5" />} title="Vaqtincha ishlamayapti" text="Bu oynani Ega vaqtincha toʻxtatgan. Keyinroq qayta urinib koʻring." />
  ) : access === 'hidden' ? (
    <PageNotice icon={<ShieldAlert className="size-5" />} title="Ruxsat yoʻq" text="Bu oyna faqat Ega yoki Adminlar uchun." />
  ) : (
    <>
      {access === 'owner-paused' && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          <PauseCircle className="size-4 shrink-0" /> Bu oyna boshqalar uchun vaqtincha toʻxtatilgan. Siz Ega sifatida koʻryapsiz.
        </div>
      )}
      {children}
    </>
  );
  const tours = await getTours();
  return (
    <AdminShell
      tours={tours}
      nav={nav}
      email={ctx.email}
      name={profile?.full_name ?? null}
      languages={settings.localization.languages}
      primaryAction={ctx.permissions.has('products.write') ? { href: '/admin/products/new', label: 'Yangi mahsulot' } : null}
      roleName={roleLabel(ctx.roles, (staffRow.data?.perms as string[] | null) ?? null)}
      branches={{ mine: branches.mine.map((b) => ({ id: b.id, name: b.name })), current: branches.current, total: branches.all.length }}
      roles={ctx.roles}
      notifications={(notif.data ?? []) as Notification[]}
      unread={notif.count ?? 0}
      canSearch={ctx.permissions.has('orders.read') || ctx.permissions.has('products.read')}
    >
      {body}
    </AdminShell>
  );
}

function PageNotice({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface px-6 py-16 text-center shadow-soft anim-fade">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-warn-soft text-warn">{icon}</div>
      <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-3">{text}</p>
    </div>
  );
}
