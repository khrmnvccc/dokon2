import type { Metadata } from 'next';
import { requireUser, getCurrentProfile, getStaffContext } from '@/lib/auth';
import { AccountNav } from '@/components/shop/account-nav';

export const metadata: Metadata = { title: 'Shaxsiy kabinet', robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/account');
  const [profile, staff] = await Promise.all([getCurrentProfile(), getStaffContext()]);
  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-start">
      <AccountNav name={profile?.full_name ?? profile?.email ?? 'Mijoz'} email={profile?.email ?? null} isStaff={Boolean(staff)} />
      <div className="min-w-0">
        {profile?.is_blocked && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Hisobingiz bloklangan{profile.blocked_reason ? `: ${profile.blocked_reason}` : ''}. Yangi buyurtma berib bo‘lmaydi.</p>
        )}
        {children}
      </div>
    </div>
  );
}
