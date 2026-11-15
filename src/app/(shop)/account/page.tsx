import { getL } from '@/lib/i18n/server';
import { getCurrentProfile, getStaffContext } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { visibleEmail } from '@/lib/format';
import { ProfileHome } from '@/components/shop/profile-home';
import type { MyReferral } from '@/components/shop/referral-view';

export const dynamic = 'force-dynamic';

/** Profil: yuqorida karta (ism, ID, hamkor belgisi, hamyon, doʻstlar), pastda menyu roʻyxati. */
export default async function AccountPage() {
  const L = await getL();
  const supabase = await getServerSupabase();
  const [profile, staff, settings, { data: ref }] = await Promise.all([getCurrentProfile(), getStaffContext(), getSettings(), supabase.rpc('my_referral')]);
  const r = (ref ?? null) as MyReferral | null;
  const bal = r?.partner?.balance;
  const wallet = bal ? Math.max(0, Number(bal.available_total) - Number(bal.paid) - Number(bal.requested)) : 0;
  const steps = r?.steps ?? [];
  const qualified = Number(r?.qualified ?? 0);
  const goal = steps.find((s) => s.friends > qualified)?.friends ?? steps.at(-1)?.friends ?? 5;
  return (
    <ProfileHome
      name={profile?.full_name || visibleEmail(profile?.email) || L('Mijoz')}
      clientNo={profile?.client_no ?? null}
      avatar={profile?.avatar_url ?? null}
      partner={r?.partner?.status === 'active'}
      wallet={wallet}
      friends={qualified}
      goal={goal}
      referralOn={Boolean(r?.enabled)}
      notifyOrders={profile?.notify_orders !== false}
      notifyPromo={profile?.notify_promo !== false}
      languages={settings.localization.languages}
      isStaff={Boolean(staff)}
    />
  );
}
