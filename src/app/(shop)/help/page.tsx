import { getL } from '@/lib/i18n/server';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/data/public';
import { getShopBot } from '@/lib/telegram/shop-bot';
import { PhoneCard, QuickTopics, SupportCard, TourRow } from '@/components/shop/help-center';
import { SizeBlock } from '@/components/shop/size-block';

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
      <SizeBlock id="help.support" label="Telegram kartasi"><SupportCard help={help} bot={bot?.botName ?? null} /></SizeBlock>
      <SizeBlock id="help.tour" label="Tanishish"><TourRow /></SizeBlock>
      <h2 className={`${label} pt-2`}>{L('Tez mavzular')}</h2>
      <SizeBlock id="help.topics" label="Tez mavzular"><QuickTopics help={help} bot={bot?.botName ?? null} /></SizeBlock>
      {phone && (
        <>
          <h2 className={`${label} pt-2`}>{L('Telefon orqali')}</h2>
          <SizeBlock id="help.phone" label="Telefon"><PhoneCard phone={phone} hours={hours} /></SizeBlock>
        </>
      )}
      {bot && <p className="px-4 pt-1 text-center text-[13px] text-ink-3">{L('Xabaringizga mijoz kodingiz avtomatik biriktiriladi — operator buyurtmalaringizni tezroq topadi.')}</p>}
    </div>
  );
}
