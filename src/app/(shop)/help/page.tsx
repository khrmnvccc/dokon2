import { getL } from '@/lib/i18n/server';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/data/public';
import { getShopBot } from '@/lib/telegram/shop-bot';
import { PhoneCard, QuickTopics, SupportCard, TourRow } from '@/components/shop/help-center';

export const metadata: Metadata = { title: 'Yordam markazi', description: 'Buyurtma holati, toʻlov, manzil va boshqa savollar boʻyicha yordam: Telegram va telefon orqali.' };
export const revalidate = 300;

const label = 'px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-2';

export default async function HelpPage() {
  const L = await getL();
  const [{ help_center: help, contact }, bot] = await Promise.all([getSettings(), getShopBot().catch(() => null)]);
  const phone = help.phone || contact.phone;
  const hours = help.phone_hours || contact.working_hours;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-center text-[22px] font-bold tracking-tight">{L("Yordam markazi")}</h1>
      <SupportCard help={help} bot={bot?.botName ?? null} />
      <TourRow />
      <h2 className={`${label} pt-2`}>{L('Tez mavzular')}</h2>
      <QuickTopics help={help} bot={bot?.botName ?? null} />
      {phone && (
        <>
          <h2 className={`${label} pt-2`}>{L('Telefon orqali')}</h2>
          <PhoneCard phone={phone} hours={hours} />
        </>
      )}
      {bot && <p className="px-4 pt-1 text-center text-[13px] text-ink-3">{L('Xabaringizga mijoz kodingiz avtomatik biriktiriladi — operator buyurtmalaringizni tezroq topadi.')}</p>}
    </div>
  );
}
