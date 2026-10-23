import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getSettings } from '@/lib/data/public';
import { getCurrentProfile, getCurrentUser, getStaffContext } from '@/lib/auth';
import { getLang } from '@/lib/i18n/server';
import { SITE_URL } from '@/lib/env';
import { AppProviders } from '@/components/providers';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { seo, store } = await getSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: seo.title, template: seo.title_template.includes('%s') ? seo.title_template : `%s | ${store.name}` },
    description: seo.description,
    keywords: seo.keywords,
    applicationName: store.name,
    icons: store.favicon_url ? { icon: store.favicon_url } : undefined,
    openGraph: {
      type: 'website',
      siteName: store.name,
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
  themeColor: '#ffffff',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, lang] = await Promise.all([getSettings(), getCurrentUser(), getLang()]);
  const [profile, staff] = user ? await Promise.all([getCurrentProfile(), getStaffContext()]) : [null, null];
  // Ranglar zod orqali #RRGGBB formatida tekshirilgan, shuning uchun CSS'ga xavfsiz qo'yiladi
  const themeCss = `:root{--brand:${settings.store.primary_color};--accent:${settings.store.accent_color}}`;

  return (
    <html lang={lang} className={inter.variable}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body>
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
