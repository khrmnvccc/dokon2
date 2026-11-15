import { visibleEmail } from '@/lib/format';
import type { Metadata } from 'next';
import { requireUser, getCurrentProfile, getStaffContext } from '@/lib/auth';
import { AccountNav } from '@/components/shop/account-nav';
import { getL } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Shaxsiy kabinet', robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/account');
  const [profile, staff, L] = await Promise.all([getCurrentProfile(), getStaffContext(), getL()]);
  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-start">
      <AccountNav name={profile?.full_name ?? visibleEmail(profile?.email) ?? 'Mijoz'} email={visibleEmail(profile?.email)} isStaff={Boolean(staff)} />
      <div className="min-w-0">
        {profile?.is_blocked && (
          <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{L('Hisobingiz bloklangan')}{profile.blocked_reason ? `: ${profile.blocked_reason}` : ''}. {L('Yangi buyurtma berib boʻlmaydi.')}</p>
        )}
        {children}
      </div>
    </div>
  );
}
