import { getL } from '@/lib/i18n/server';
import { requireUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { getShopBot } from '@/lib/telegram/shop-bot';
import { shareLinks } from '@/lib/referral';
import { SITE_URL } from '@/lib/env';
import { ReferralView, type MyReferral } from '@/components/shop/referral-view';

export const metadata = { title: 'Doʻstni taklif qilish', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function ReferralPage() {
  const L = await getL();
  await requireUser('/account/referral');
  const supabase = await getServerSupabase();
  const [{ data, error }, settings, bot] = await Promise.all([
    supabase.rpc('my_referral'),
    getSettings(),
    getShopBot().catch(() => null),
  ]);
  if (error || !data) {
    if (error) console.error('my_referral', error.message);
    return <p className="rounded-2xl border border-line bg-surface p-6 text-center text-ink-3">{L('Maʼlumotni yuklab boʻlmadi. Sahifani yangilang.')}</p>;
  }
  const r = data as MyReferral;
  const links = shareLinks(Number(r.client_no ?? 0), SITE_URL, bot?.botName ?? null);
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{L('Doʻstni taklif qilish')}</h1>
      <ReferralView data={r} link={links.main} shopName={settings.brand.name || settings.store?.name || 'Doʻkon'} />
    </div>
  );
}
