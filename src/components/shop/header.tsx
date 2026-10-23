import Link from 'next/link';
import { Suspense } from 'react';
import { Phone, Clock } from 'lucide-react';
import type { SiteSettings } from '@/lib/settings-schema';
import type { CategoryNode } from '@/lib/types';
import { CatalogButton, HeaderActions, LangSwitch, Logo, SearchBox } from './header-client';

export function Header({ settings, tree }: { settings: SiteSettings; tree: CategoryNode[] }) {
  const { store, contact, header_menu, announcement, localization } = settings;
  return (
    <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_var(--line)]">
      <div className="bg-brand text-white">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs">
          <div className="flex min-w-0 items-center gap-4">
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 font-semibold hover:underline">
                <Phone className="h-3.5 w-3.5" aria-hidden /> {contact.phone}
              </a>
            )}
            {contact.working_hours && (
              <span className="hidden items-center gap-1.5 text-white/80 sm:flex"><Clock className="h-3.5 w-3.5" aria-hidden />{contact.working_hours}</span>
            )}
          </div>
          {announcement.enabled && announcement.text && (
            <Link href={announcement.link || '#'} className="hidden truncate font-medium text-white/95 hover:underline lg:block">{announcement.text}</Link>
          )}
          <div className="flex shrink-0 items-center gap-4">
            <Link href="/track" className="hidden text-white/85 hover:text-white sm:inline">Buyurtma holati</Link>
            <LangSwitch languages={localization.languages} />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-4">
        <Logo name={store.name} logoUrl={store.logo_url ?? null} />
        <CatalogButton tree={tree} />
        <Suspense fallback={<div className="hidden h-11 flex-1 rounded-xl border-2 border-brand/50 md:block" />}>
          <SearchBox className="hidden md:flex" />
        </Suspense>
        <div className="ml-auto md:ml-0">
          <HeaderActions />
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <Suspense fallback={<div className="h-11 rounded-xl border-2 border-brand/50" />}>
          <SearchBox />
        </Suspense>
      </div>

      {header_menu.length > 0 && (
        <nav className="border-t border-line" aria-label="Menyu">
          <ul className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5">
            {header_menu.map((item) => (
              <li key={item.href + item.label} className="shrink-0">
                <Link href={item.href} className="block rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink">{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
