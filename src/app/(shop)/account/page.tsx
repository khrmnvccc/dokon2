import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatDate, isTelegramEmail } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { Card } from '@/components/ui/misc';
import { ProfileForm } from '@/components/shop/account-forms';

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('my_orders', { p_limit: 1 });
  const total = (data as { total: number } | null)?.total ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="sm:p-5"><p className="text-sm text-ink-3">Mijoz ID</p><p className="num mt-1 text-[22px] font-semibold tracking-tight text-primary sm:text-2xl">{profile?.client_no ?? '—'}</p><p className="text-xs text-ink-3">Operatorga ayting</p></Card>
        <Card className="sm:p-5"><p className="text-sm text-ink-3">Buyurtmalar</p><p className="mt-1 text-[22px] font-semibold tracking-tight sm:text-2xl">{total}</p><Link href="/account/orders" className="text-sm font-medium text-primary">Ko‘rish →</Link></Card>
        <Card className="sm:p-5"><p className="text-sm text-ink-3">Telefon</p><p className="mt-1 font-semibold">{formatUzPhone(profile?.phone) || '—'}</p></Card>
        <Card className="sm:p-5"><p className="text-sm text-ink-3">Ro‘yxatdan o‘tgan</p><p className="mt-1 font-semibold">{formatDate(profile?.created_at)}</p></Card>
      </div>
      <Card>
        <h1 className="mb-4 text-xl font-semibold">Shaxsiy ma’lumotlar</h1>
        <ProfileForm defaults={{ full_name: profile?.full_name ?? '', phone: profile?.phone ? formatUzPhone(profile.phone) : '' }} email={isTelegramEmail(profile?.email) ? 'Telegram orqali kirilgan' : profile?.email ?? ''} />
      </Card>
    </div>
  );
}
