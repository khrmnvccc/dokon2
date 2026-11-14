import { requirePagePermission } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { PartnerTabs } from '@/components/admin/partner-tabs';
import { ReferralRulesForm } from '@/components/admin/referral-rules-form';
import { getReferralSettings } from '@/lib/referral-server';
import { partnerTabCounts } from '@/lib/data/partners';

export const metadata = { title: 'Taklif qoidalari' };

export default async function Page() {
  await requirePagePermission('partners.manage');
  const [settings, counts] = await Promise.all([getReferralSettings(), partnerTabCounts()]);
  return (
    <div>
      <PageHeader title="Hamkorlar" description="Qoidalar — doʻst taklifi bosqichlari, sovgʻa kupon va hamkorlik shartlari. Oʻzgarish darhol ishlaydi." />
      <PartnerTabs active="rules" counts={counts} />
      <ReferralRulesForm initial={settings} />
    </div>
  );
}
