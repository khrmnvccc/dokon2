import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { getCategoryTree, getSettings } from '@/lib/data/public';
import { getStaffContext } from '@/lib/auth';
import { getT, getL } from '@/lib/i18n/server';
import { Header } from '@/components/shop/header';
import { Footer } from '@/components/shop/footer';
import { MobileBottomNav } from '@/components/shop/header-client';
import { ShopTour } from '@/components/shop/shop-tour';
import { getTours } from '@/lib/data/tours';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const L = await getL();
  const [settings, tree, t, tours] = await Promise.all([getSettings(), getCategoryTree(), getT(), getTours()]);

  // Texnik xizmat rejimi: xodimlar saytni ko'ra oladi, mijozlar xabarni ko'radi
  if (settings.maintenance.enabled && !(await getStaffContext())) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-line bg-surface text-ink-3 shadow-soft"><Wrench className="size-7" /></div>
        <h1 className="text-2xl font-semibold tracking-tight">{settings.brand.name}</h1>
        <p className="mt-2 max-w-md text-ink-3">{settings.maintenance.message || L("Saytda texnik ishlar olib borilmoqda.")}</p>
        {settings.contact.phone && <p className="mt-4 text-sm">{L("Aloqa:")} <a className="font-semibold text-primary" href={`tel:${settings.contact.phone}`}>{settings.contact.phone}</a></p>}
        <Link href="/login" className="mt-8 text-xs text-ink-3 underline">{L("Xodimlar uchun kirish")}</Link>
      </main>
    );
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:text-ink focus:py-2 focus:shadow-pop">
        {L("Asosiy kontentga o‘tish")}
      </a>
      {settings.maintenance.enabled && (
        <div className="bg-warn-soft px-4 py-1.5 text-center text-xs font-medium text-warn">{L("Texnik xizmat rejimi yoqilgan — sayt faqat xodimlarga ko‘rinmoqda")}</div>
      )}
      <Header settings={settings} tree={tree} />
      <main id="main" className="mx-auto min-h-[60vh] max-w-7xl px-4 py-5 sm:py-7">{children}</main>
      <Footer settings={settings} t={t} />
      <MobileBottomNav />
      <ShopTour tours={tours} />
    </>
  );
}
