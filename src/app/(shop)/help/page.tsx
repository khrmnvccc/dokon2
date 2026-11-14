import { getL } from '@/lib/i18n/server';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronDown, CreditCard, Gift, MessageCircle, Package, Phone, Search, Send, ShoppingCart, Truck, type LucideIcon } from 'lucide-react';
import { getSettings } from '@/lib/data/public';
import { getShopBot } from '@/lib/telegram/shop-bot';
import { HelpTourButton } from '@/components/shop/help-tour-button';

export const metadata: Metadata = { title: 'Yordam markazi', description: 'Qanday buyurtma berish, toʻlov, yetkazish, kuponlar va Telegram bot haqida qisqa yoʻriqnoma.' };
export const revalidate = 300;

const STEPS = (L: (s: string) => string): Array<{ icon: LucideIcon; title: string; text: string }> => [
  { icon: Search, title: L("Tanlang"), text: L("Qidiruv yoki katalogdan mahsulotni toping.") },
  { icon: ShoppingCart, title: L("Savatga qoʻshing"), text: L("Rang yoki oʻlchamni tanlab, “Savatga” tugmasini bosing.") },
  { icon: CreditCard, title: L("Rasmiylashtiring"), text: L("Ism, telefon va manzil — boshqa hech narsa kerak emas.") },
  { icon: Package, title: L("Kuzating"), text: L("Operator qoʻngʻiroq qiladi, holati “Buyurtmalarim”da va Telegramda.") },
];

const FAQ = (L: (s: string) => string): Array<{ icon: LucideIcon; q: string; a: React.ReactNode }> => [
  { icon: ShoppingCart, q: L("Roʻyxatdan oʻtish shartmi?"), a: L("Yoʻq. Buyurtmani roʻyxatdan oʻtmasdan berasiz. Telegram botimiz orqali kirsangiz, akkaunt avtomatik ochiladi va buyurtmalaringiz saqlanadi.") },
  { icon: CreditCard, q: L("Qanday toʻlayman?"), a: L("Toʻlov usullari rasmiylashtirish sahifasida koʻrsatiladi: naqd, karta yoki boshqa usullar. Naqd toʻlovda pulni mahsulotni olganda berasiz.") },
  { icon: Truck, q: L("Yetkazib berish qancha vaqt oladi?"), a: <>{L("Muddat va narx manzilingizga bogʻliq — rasmiylashtirishda koʻrsatiladi. Batafsil:")} <Link className="font-medium text-primary" href="/delivery">{L("Yetkazib berish")}</Link>.</> },
  { icon: Gift, q: L("Promo-kod (kupon) qanday ishlatiladi?"), a: <><Link className="font-medium text-primary" href="/sale">{L("Aksiyalar")}</Link> {L("sahifasidagi kuponni bosing — kod nusxalanadi. Savatda yoki rasmiylashtirishda “Promo-kod” maydoniga qoʻying.")}</> },
  { icon: Package, q: L("Buyurtmam qayerda?"), a: <>{L("Kirgan boʻlsangiz —")} <Link className="font-medium text-primary" href="/account/orders">{L("Buyurtmalarim")}</Link>{L(". Kirmagan boʻlsangiz —")} <Link className="font-medium text-primary" href="/track">{L("Buyurtmani kuzatish")}</Link> {L("sahifasida raqam va telefonni kiriting.")}</> },
  { icon: MessageCircle, q: L("Buyurtmani bekor qilsam boʻladimi?"), a: L("Ha, yoʻlga chiqmaguncha. Bizga qoʻngʻiroq qiling yoki Telegramda yozing.") },
];

export default async function HelpPage() {
  const L = await getL();
  const [{ brand, contact }, bot] = await Promise.all([getSettings(), getShopBot().catch(() => null)]);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{L("Yordam markazi")}</h1>
        <p className="mt-2 text-ink-3">{brand.name}{L("da xarid qilish — oddiy. Mana qisqa yoʻriqnoma.")}</p>
        <HelpTourButton />
      </header>

      <section aria-label={L("Qanday buyurtma beriladi")}>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS(L).map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-3 rounded-[var(--r-lg)] border border-line bg-surface p-4 shadow-soft">
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
                <span className="num absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-fg">{i + 1}</span>
              </span>
              <div><div className="font-semibold">{title}</div><p className="mt-0.5 text-sm text-ink-3">{text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {bot && (
        <section className="flex flex-col items-start gap-3 rounded-[var(--r-lg)] bg-[#2f80c1] p-5 text-white sm:flex-row sm:items-center">
          <Send className="size-8 shrink-0" aria-hidden />
          <div className="flex-1">
            <div className="font-semibold">{L("Telegram botimiz")}</div>
            <p className="text-sm text-white/85">{L("Doʻkonni Telegramdan chiqmasdan oching. Buyurtma holati va aksiyalar shu yerga keladi.")}</p>
          </div>
          <a href={`https://t.me/${bot.botName}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-[#1d4f80]">@{bot.botName}</a>
        </section>
      )}

      <section aria-label={L("Koʻp soʻraladigan savollar")} className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
        {FAQ(L).map(({ icon: Icon, q, a }) => (
          <details key={q} className="group border-t border-line first:border-t-0">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 font-medium [&::-webkit-details-marker]:hidden">
              <Icon className="size-5 shrink-0 text-ink-3" aria-hidden />
              <span className="flex-1">{q}</span>
              <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="px-4 pb-4 pl-12 text-sm leading-relaxed text-ink-2">{a}</div>
          </details>
        ))}
      </section>

      {(contact.phone || contact.working_hours) && (
        <section className="rounded-[var(--r-lg)] border border-line bg-surface p-5 text-center">
          <div className="font-semibold">{L("Savol qoldimi?")}</div>
          {contact.working_hours && <p className="mt-1 text-sm text-ink-3">{contact.working_hours}</p>}
          {contact.phone && (
            <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg">
              <Phone className="size-4" aria-hidden /> {contact.phone}
            </a>
          )}
        </section>
      )}
    </div>
  );
}
