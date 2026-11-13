import type { SiteSettings } from '@/lib/settings-schema';
import { ADMIN_NAV, type AdminNavItem } from './nav';

// "Oynalar" (kassa 3.3): menyu va har bir sahifa tekshiruvi bitta canSee() funksiyasidan o'qiydi.
export type PageConfig = SiteSettings['pages'][string];
export interface Viewer { roles: string[]; permissions: Set<string> }

/** "Sozlamalar" oynasini to'xtatib yoki yashirib bo'lmaydi (Ega yo'lini yo'qotmasin). */
export const LOCKED_PAGES = ['/admin/settings'];

export const isOwner = (v: Viewer) => v.roles.includes('super_admin');
const isAdmin = (v: Viewer) => isOwner(v) || v.roles.includes('manager');

export function pageConfig(pages: SiteSettings['pages'], href: string): PageConfig {
  if (LOCKED_PAGES.includes(href)) return { paused: false, who: 'all', label: pages[href]?.label ?? '' };
  return pages[href] ?? { paused: false, who: 'all', label: '' };
}

/** Menyuda ko'rinadimi: ruxsati bor va "kim ko'radi" sharti bajariladi. To'xtatilgan oyna menyuda qoladi. */
export function canSee(v: Viewer, item: AdminNavItem, pages: SiteSettings['pages']): boolean {
  if (!v.permissions.has(item.perm)) return false;
  const c = pageConfig(pages, item.href);
  if (c.who === 'owner') return isOwner(v);
  if (c.who === 'admins') return isAdmin(v);
  return true;
}

export const pageLabel = (pages: SiteSettings['pages'], item: AdminNavItem) => pageConfig(pages, item.href).label || item.label;

/** Joriy yo'lga mos menyu bandi (eng uzun prefiks). */
export function itemForPath(pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null;
  for (const item of ADMIN_NAV.flatMap((g) => g.items)) {
    const hit = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(item.href + '/');
    if (hit && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

/** Sahifani ochish mumkinmi: 'ok', 'paused' (Ega baribir ochadi — 'owner-paused'), 'hidden'. */
export function pageAccess(v: Viewer, pathname: string, pages: SiteSettings['pages']): 'ok' | 'paused' | 'owner-paused' | 'hidden' {
  const item = itemForPath(pathname);
  if (!item) return 'ok';
  const c = pageConfig(pages, item.href);
  if (c.who === 'owner' && !isOwner(v)) return 'hidden';
  if (c.who === 'admins' && !isAdmin(v)) return 'hidden';
  if (c.paused) return isOwner(v) ? 'owner-paused' : 'paused';
  return 'ok';
}
