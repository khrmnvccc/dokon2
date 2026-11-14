import { getL } from '@/lib/i18n/server';
import Link from 'next/link';
import { Suspense } from 'react';
import type { SiteSettings } from '@/lib/settings-schema';
import type { CategoryNode } from '@/lib/types';
import { CatalogButton, HeaderActions, LangSwitch, SearchBox } from './header-client';
import { Logo, ThemeToggle } from '@/components/brand';

// Kassa dizayni 1.13: tepada glass sarlavha — logo, qidiruv, savat (soni bilan), til, mavzu.
export async function Header({ settings, tree }: { settings: SiteSettings; tree: CategoryNode[] }) {
  const L = await getL();
  const { header_menu, announcement, localization } = settings;
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-surface glass">
      {announcement.enabled && announcement.text && (
        <div className="border-b border-line bg-primary-soft">
          <Link href={announcement.link || '#'} className="mx-auto block max-w-7xl truncate px-4 py-1.5 text-center text-[13px] font-medium text-primary hover:underline">
            {announcement.text}
          </Link>
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-3 lg:h-16">
        <Link href="/" className="min-w-0 shrink-0" aria-label={L("Bosh sahifa")}><Logo compact /></Link>
        <CatalogButton tree={tree} />
        <Suspense fallback={<div className="hidden h-10 flex-1 rounded-lg bg-surface-2 md:block" />}>
          <div data-tour="search" className="hidden min-w-0 flex-1 md:flex"><SearchBox className="flex flex-1" /></div>
        </Suspense>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <LangSwitch languages={localization.languages} className="hidden sm:inline-flex" />
          <ThemeToggle />
          <HeaderActions />
        </div>
      </div>
      <div className="px-4 pb-2.5 md:hidden" data-tour="search">
        <Suspense fallback={<div className="h-10 rounded-lg bg-surface-2" />}>
          <SearchBox />
        </Suspense>
      </div>
      {header_menu.length > 0 && (
        <nav className="hidden border-t border-line md:block" aria-label="Menyu">
          <ul className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5">
            {header_menu.map((item) => (
              <li key={item.href + item.label} className="shrink-0">
                <Link href={item.href} className="block rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
