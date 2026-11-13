import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getSettings } from '@/lib/data/public';
import { getCurrentProfile, getCurrentUser, getStaffContext } from '@/lib/auth';
import { getLang } from '@/lib/i18n/server';
import { SITE_URL } from '@/lib/env';
import { AppProviders } from '@/components/providers';
import { BrandBoot } from '@/components/brand';
import { brandCss } from '@/lib/brand/css';
import { THEME_BOOT } from '@/lib/theme';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { seo, store, brand } = await getSettings();
  const icon = brand.logo ?? store.favicon_url ?? store.logo_url;
  return {
    metadataBase: new URL(SITE_URL),
    // Brauzer yorlig'i: "Sahifa nomi · DOKON_NOMI"
    title: { default: seo.title, template: seo.title_template.includes('%s') ? seo.title_template : `%s · ${brand.name}` },
    description: seo.description,
    keywords: seo.keywords,
    applicationName: brand.name,
    icons: icon ? { icon } : undefined,
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title: seo.title,
      description: seo.description,
      images: seo.og_image_url ? [seo.og_image_url] : undefined,
      locale: 'uz_UZ',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, lang] = await Promise.all([getSettings(), getCurrentUser(), getLang()]);
  const [profile, staff] = user ? await Promise.all([getCurrentProfile(), getStaffContext()]) : [null, null];
  // Brend cleanBrand() orqali tekshirilgan (#rrggbb, ma'lum burchak turlari), shuning uchun CSS'ga xavfsiz qo'yiladi.
  const brand = settings.brand;

  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <style id="brand" dangerouslySetInnerHTML={{ __html: brandCss(brand) }} />
      </head>
      <body>
        {/* Ochilish ekrani: sessiyada bir marta, logo bilan */}
        <div id="splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {brand.logo ? <img src={brand.logo} alt="" className="h-16 w-auto anim-pop" /> : (
            <span className="inline-flex size-16 items-center justify-center rounded-[28%] bg-primary text-primary-fg shadow-pop anim-pop">
              <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            </span>
          )}
        </div>
        <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('dk_splash'))document.getElementById('splash').remove();else sessionStorage.setItem('dk_splash','1')}catch(e){}setTimeout(function(){var e=document.getElementById('splash');if(e)e.remove()},6000);" }} />
        <BrandBoot brand={brand} />
        <AppProviders
          lang={lang}
          currencySymbol={settings.localization.currency_symbol}
          user={user ? { id: user.id, email: user.email ?? null, name: profile?.full_name ?? null } : null}
          isStaff={Boolean(staff)}
        >
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
