import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { getCategoryTree, getSettings } from '@/lib/data/public';
import { getStaffContext } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';
import { Header } from '@/components/shop/header';
import { Footer } from '@/components/shop/footer';
import { MobileBottomNav } from '@/components/shop/header-client';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, tree, t] = await Promise.all([getSettings(), getCategoryTree(), getT()]);

  // Texnik xizmat rejimi: xodimlar saytni ko'ra oladi, mijozlar xabarni ko'radi
  if (settings.maintenance.enabled && !(await getStaffContext())) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Wrench className="h-8 w-8" /></div>
        <h1 className="text-2xl font-bold">{settings.store.name}</h1>
        <p className="mt-2 max-w-md text-muted">{settings.maintenance.message || 'Saytda texnik ishlar olib borilmoqda.'}</p>
        {settings.contact.phone && <p className="mt-4 text-sm">Aloqa: <a className="font-semibold text-brand" href={`tel:${settings.contact.phone}`}>{settings.contact.phone}</a></p>}
        <Link href="/login" className="mt-8 text-xs text-muted underline">Xodimlar uchun kirish</Link>
      </main>
    );
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-pop">
        Asosiy kontentga o‘tish
      </a>
      {settings.maintenance.enabled && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-white">Texnik xizmat rejimi yoqilgan — sayt faqat xodimlarga ko‘rinmoqda</div>
      )}
      <Header settings={settings} tree={tree} />
      <main id="main" className="mx-auto min-h-[60vh] max-w-7xl px-4 py-4 sm:py-6">{children}</main>
      <Footer settings={settings} t={t} />
      <MobileBottomNav />
    </>
  );
}
