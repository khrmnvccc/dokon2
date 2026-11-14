'use client';

import { SITE_URL } from '@/lib/env';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, Bell, HelpCircle, Languages, Lightbulb, BellRing, Bot, Building2, Circle, ExternalLink, FileText, FolderTree, Gift, History, Image, LayoutDashboard, LogOut, Megaphone,
  Menu, MessageSquare, Moon, Package, PanelLeftClose, PanelLeftOpen, Percent, Plus, Search, Send, Settings, ShieldCheck, ShoppingBag, Sun,
  TicketPercent, Truck, Users, Warehouse, X, type LucideIcon,
} from 'lucide-react';
import { NAV_RU, type AdminNavGroup, type AdminNavItem } from '@/lib/admin/nav';
import { useApp } from '@/components/providers';

/** Menyu matni joriy tilda (RU — NAV_RU dan, boʻlmasa oʻzbekcha). */
function useTr() {
  const { lang } = useApp();
  return (s: string) => (lang === 'ru' ? NAV_RU[s] ?? s : s);
}
import { GuidedTour, startTour } from '@/components/tour';
import type { Tours } from '@/lib/tours';

import { logout } from '@/lib/actions/auth';
import { markStaffNotificationsRead } from '@/lib/actions/admin/misc';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/ui/button';
import { Avatar } from '@/components/ui/kit';
import { BrandMark, Logo } from '@/components/brand';
import { useBrand } from '@/lib/brand/store';
import { useTheme } from '@/lib/theme';
import { LangSwitch } from '@/components/shop/header-client';
import type { Notification } from '@/lib/types';

const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingBag, Users, BarChart3, Package, FolderTree, Warehouse, MessageSquare, Image, Percent,
  TicketPercent, FileText, Truck, Settings, ShieldCheck, History, Send, Bot, Megaphone, BellRing, Gift, Lightbulb, Languages,
};

const isActive = (pathname: string, href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));

/** Joriy yoʻlga mos menyu bandi (eng uzun prefiks) va uning boʻlimi. */
function locate(nav: AdminNavGroup[], pathname: string): { group: AdminNavGroup | null; item: AdminNavItem | null } {
  let best: { group: AdminNavGroup; item: AdminNavItem } | null = null;
  for (const group of nav) for (const item of group.items) {
    if (isActive(pathname, item.href) && (!best || item.href.length > best.item.href.length)) best = { group, item };
  }
  return best ?? { group: null, item: null };
}

/** Brauzer xotirasi (bloklangan boʻlishi mumkin: xato boʻlsa jim oʻtadi). */
function readStore<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function writeStore(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* xotira bloklangan */ }
}

/** "Jonli" yangilanish: /api/admin/version har 15 soniyada soʻraladi; oʻzgarsa sahifa yangilanadi. */
function useLive() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const last = useRef<string | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch('/api/admin/version', { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) return; // sessiya tugagan: bu aloqa uzilishi emas
        if (!res.ok) throw new Error(String(res.status));
        const { v } = (await res.json()) as { v: string };
        if (stop) return;
        setOnline(true);
        if (last.current !== null && last.current !== v) router.refresh();
        last.current = v;
      } catch {
        if (!stop) setOnline(false);
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    const onVisible = () => !document.hidden && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [router]);
  return online;
}

/** Telefonda jadval kartaga aylanganda har katakka ustun nomini yozadi (data-label). */
function useTableLabels() {
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>('table.rtable').forEach((t) => {
        const heads = Array.from(t.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '');
        t.querySelectorAll('tbody tr').forEach((tr) => {
          let i = 0;
          tr.querySelectorAll(':scope > td').forEach((td) => {
            const span = Number(td.getAttribute('colspan') || 1);
            if (td.getAttribute('data-label') !== heads[i]) td.setAttribute('data-label', heads[i] ?? '');
            i += span;
          });
        });
      });
    };
    label();
    let raf = 0;
    const obs = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(label); });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, []);
}

/* ───────────── Yuqori toʻq panel ───────────── */

const barBtn = 'inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white';

function TopBrand() {
  const tr = useTr();
  const brand = useBrand();
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5 pr-2">
      <BrandMark brand={brand} className="h-9 max-w-[72px] shrink-0 rounded-xl" />
      <span className="hidden min-w-0 leading-tight sm:block">
        <span className="block truncate text-[15px] font-bold uppercase tracking-wide text-white">{brand.name}</span>
        <span className="block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">{tr('Admin panel')}</span>
      </span>
    </Link>
  );
}

function ModuleBar({ nav, active }: { nav: AdminNavGroup[]; active: AdminNavGroup | null }) {
  const tr = useTr();
  const brand = useBrand();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Boʻlimlar" data-tour="modules">
      {nav.map((g) => {
        const Icon = NAV_ICONS[g.icon] ?? Circle;
        const on = active?.title === g.title;
        const label = brand.groups[g.title as keyof typeof brand.groups] || tr(g.title);
        return (
          <Link key={g.title} href={g.items[0].href} title={label} aria-current={on ? 'true' : undefined}
            className={cn('inline-flex h-10 items-center gap-2 rounded-xl text-sm font-semibold transition-colors',
              on ? 'bg-[#2a5a8c] px-3.5 text-white shadow-[inset_0_0.5px_0_rgb(255_255_255/0.2)]' : 'w-10 justify-center text-white/70 hover:bg-white/10 hover:text-white')}>
            <Icon className="size-[18px]" strokeWidth={1.9} />
            {on && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function TopTheme() {
  const tr = useTr();
  const theme = useTheme();
  return (
    <button type="button" onClick={theme.toggle} className={cn(barBtn, 'border border-white/15')} aria-label={tr(theme.isDark ? 'Yorugʻ rejim' : 'Qorongʻi rejim')} title={tr(theme.isDark ? 'Yorugʻ rejim' : 'Qorongʻi rejim')}>
      {theme.isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

function initials(name: string) {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

/* ───────────── Chap menyu ───────────── */

function SideItems({ group, pathname, collapsed, onNavigate }: { group: AdminNavGroup; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  const tr = useTr();
  return (
    <div className="space-y-1">
      {group.items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = NAV_ICONS[item.icon] ?? Circle;
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} title={collapsed ? tr(item.label) : undefined}
            className={cn('relative flex h-11 items-center gap-3 rounded-xl text-[15px] font-medium transition-colors',
              collapsed ? 'justify-center' : 'px-3',
              active ? 'bg-[#e3edf8] text-[#1d4f80] dark:bg-white/10 dark:text-white' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
            {active && <span className="absolute -left-2 top-2 h-7 w-[3px] rounded-r bg-[#1d4f80] dark:bg-white" aria-hidden />}
            <Icon className="size-[19px] shrink-0" strokeWidth={1.9} aria-hidden />
            {!collapsed && <span className="truncate">{tr(item.label)}</span>}
            {!collapsed && item.paused && <span className="ml-auto rounded-full bg-warn-soft px-1.5 py-px text-[10px] font-semibold text-warn">{tr('Vaqtincha')}</span>}
          </Link>
        );
      })}
    </div>
  );
}

/** Telefondagi drawer: barcha boʻlimlar ketma-ket. */
function DrawerNav({ nav, pathname, onNavigate }: { nav: AdminNavGroup[]; pathname: string; onNavigate: () => void }) {
  const tr = useTr();
  const brand = useBrand();
  return (
    <nav className="space-y-5" aria-label="Admin menyu">
      {nav.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{brand.groups[g.title as keyof typeof brand.groups] || tr(g.title)}</div>
          <SideItems group={g} pathname={pathname} collapsed={false} onNavigate={onNavigate} />
        </div>
      ))}
    </nav>
  );
}

/* ───────────── Ochiq sahifalar tablari ───────────── */

interface Tab { href: string; label: string }

function useTabs(current: AdminNavItem | null) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  useEffect(() => { setTabs(readStore<Tab[]>('dk_admin_tabs', [])); }, []);
  useEffect(() => {
    if (!current) return;
    setTabs((list) => {
      const next = list.some((t) => t.href === current.href)
        ? list.map((t) => (t.href === current.href ? { ...t, label: current.label } : t))
        : [...list, { href: current.href, label: current.label }].slice(-10);
      writeStore('dk_admin_tabs', next);
      return next;
    });
  }, [current]);
  const close = useCallback((href: string) => {
    setTabs((list) => { const next = list.filter((t) => t.href !== href); writeStore('dk_admin_tabs', next); return next; });
  }, []);
  return { tabs, close };
}

function TabsBar({ tabs, activeHref, onClose }: { tabs: Tab[]; activeHref: string | null; onClose: (href: string) => void }) {
  const tr = useTr();
  const router = useRouter();
  if (!tabs.length) return null;
  return (
    <div className="no-print sticky top-14 z-20 hidden border-b border-line bg-[var(--admin-tabs)] md:block" data-tour="tabs">
      <div className="no-scrollbar flex h-11 items-end gap-1 overflow-x-auto px-3">
        {tabs.map((t, i) => {
          const on = t.href === activeHref;
          return (
            <div key={t.href} className={cn('group flex h-9 shrink-0 items-center rounded-t-xl border border-b-0 text-sm font-medium transition-colors',
              on ? 'border-line bg-surface-solid text-ink' : 'border-transparent text-ink-3 hover:bg-white/50 hover:text-ink-2 dark:hover:bg-white/5')}>
              <Link href={t.href} className="flex h-full items-center gap-2 pl-4 pr-1">
                {on && <span className="size-1.5 rounded-full bg-[#1d4f80] dark:bg-white" aria-hidden />}
                <span className="max-w-[180px] truncate">{tr(t.label)}</span>
              </Link>
              <button type="button" aria-label={`${t.label} yopish`} title="Yopish"
                onClick={() => {
                  onClose(t.href);
                  if (on) { const rest = tabs.filter((x) => x.href !== t.href); router.push((rest[i] ?? rest[i - 1])?.href ?? '/admin'); }
                }}
                className="mr-2 ml-1 inline-flex size-5 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Qobiq ───────────── */

export interface BranchProps { mine: Array<{ id: number; name: string }>; current: number; total: number }

export function AdminShell({ nav, email, name, roleName, notifications, unread, canSearch, languages, primaryAction, branches, tours, children }: {
  nav: AdminNavGroup[]; email: string | null; name: string | null; roles: string[]; roleName: string; notifications: Notification[]; unread: number; canSearch: boolean;
  languages: string[]; primaryAction: { href: string; label: string } | null; branches: BranchProps; tours: Tours; children: React.ReactNode;
}) {
  const tr = useTr();
  const pathname = usePathname();
  const brand = useBrand();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const online = useLive();
  const { group, item } = locate(nav, pathname);
  const { tabs, close } = useTabs(item);
  useEffect(() => setCollapsed(readStore('dk_admin_side', false)), []);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  useTableLabels();
  const who = name || email || 'Xodim';
  const toggleSide = () => setCollapsed((v) => { writeStore('dk_admin_side', !v); return !v; });

  // Telefon tab-bar: 2 ta asosiy sahifa + o'rtada katta "+" + 1 sahifa + Menyu.
  const flat = nav.flatMap((g) => g.items);
  const mobileTabs = ['/admin', '/admin/orders', '+', '/admin/products'].map((h) => (h === '+' ? '+' : flat.find((i) => i.href === h))).filter(Boolean) as Array<'+' | AdminNavItem>;
  const sideW = collapsed ? 'lg:w-[76px]' : 'lg:w-[232px]';
  const mainPl = collapsed ? 'lg:pl-[76px]' : 'lg:pl-[232px]';

  return (
    <div className="admin-ui min-h-screen bg-[var(--admin-bg)]">
      <GuidedTour scope="admin" tours={tours} />
      {/* Yuqori toʻq panel */}
      <header className="no-print fixed inset-x-0 top-0 z-40 h-14 bg-[var(--admin-bar)] text-white">
        <div className="flex h-full items-center gap-2 px-3 sm:px-4">
          <button type="button" data-tour="menu" className={cn(barBtn, 'lg:hidden')} onClick={() => setDrawer(true)} aria-label="Menyu"><Menu className="size-5" /></button>
          <TopBrand />
          <ModuleBar nav={nav} active={group} />
          <div className="flex-1" />
          {canSearch && <AdminSearch />}
          <BranchSwitch branches={branches} className="hidden sm:inline-flex" />
          <span data-tour="bell" className="inline-flex"><NotificationsBell items={notifications} unread={unread} /></span>
          <button type="button" className={cn(barBtn, 'hidden sm:inline-flex')} onClick={() => startTour('admin', '/admin')} aria-label={tr('Yoʻriqnoma')} title={tr('Yoʻriqnoma')}><HelpCircle className="size-[18px]" /></button>
          <TopTheme />
          <span title={`${who} · ${roleName}`} className="hidden size-10 items-center justify-center rounded-full bg-[#2a5a8c] text-[13px] font-bold text-white sm:inline-flex">{initials(who)}</span>
          <form action={logout} className="hidden sm:block">
            <button type="submit" className={cn(barBtn, 'border border-white/15')} aria-label={tr('Chiqish')} title={tr('Chiqish')}><LogOut className="size-[18px]" /></button>
          </form>
        </div>
      </header>

      {/* Kompyuter: chap menyu (tanlangan boʻlim sahifalari) */}
      <aside data-tour="side" className={cn('no-print fixed bottom-0 left-0 top-14 z-30 hidden flex-col border-r border-line bg-surface-solid transition-[width] duration-200 lg:flex', sideW)}>
        <div className={cn('flex h-14 items-center border-b border-line', collapsed ? 'justify-center' : 'justify-between pl-4 pr-3')}>
          {!collapsed && <span className="truncate text-[15px] font-bold tracking-tight text-ink">{group ? brand.groups[group.title as keyof typeof brand.groups] || tr(group.title) : tr('Menyu')}</span>}
          <IconButton label={collapsed ? tr('Menyuni ochish') : tr('Menyuni yigʻish')} onClick={toggleSide} className="border border-line">
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          </IconButton>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {group && <SideItems group={group} pathname={pathname} collapsed={collapsed} />}
        </div>
        <div className={cn('border-t border-line p-2', collapsed && 'flex justify-center')}>
          <Link href={SITE_URL} target="_blank" title="Saytni ochish" className={cn('flex h-10 items-center gap-3 rounded-xl text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink', collapsed ? 'w-10 justify-center' : 'px-3')}>
            <ExternalLink className="size-[18px] text-ink-3" strokeWidth={1.9} />{!collapsed && tr('Saytni ochish')}
          </Link>
          {!collapsed && languages.length > 1 && <LangSwitch languages={languages} className="mt-1 flex [&>button]:flex-1" />}
        </div>
      </aside>

      {/* Telefon: chapdan chiqadigan drawer */}
      {drawer && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 anim-fade" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[290px] flex-col bg-surface-solid px-3 py-4 shadow-pop anim-rise">
            <div className="flex items-center justify-between gap-2 px-2">
              <Link href="/admin" className="min-w-0" onClick={() => setDrawer(false)}><Logo /></Link>
              <IconButton label="Yopish" onClick={() => setDrawer(false)}><X className="size-5" /></IconButton>
            </div>
            <div className="scrollbar-thin mt-5 min-h-0 flex-1 overflow-y-auto border-b border-line pb-2 pl-2"><DrawerNav nav={nav} pathname={pathname} onNavigate={() => setDrawer(false)} /></div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-line p-2.5">
              <Avatar name={who} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{who}</div>
                <div className="truncate text-xs text-ink-3">{roleName}</div>
              </div>
              <form action={logout}><IconButton label="Chiqish" type="submit"><LogOut className="size-4" /></IconButton></form>
            </div>
          </div>
        </div>
      )}

      <div className={cn('pt-14 transition-[padding] duration-200 print:p-0', mainPl)}>
        <TabsBar tabs={tabs} activeHref={item?.href ?? null} onClose={close} />
        {!online && <div className="no-print bg-danger-soft px-4 py-1.5 text-center text-xs font-medium text-danger">Server bilan aloqa yoʻq — maʼlumotlar yangilanmayapti</div>}
        <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12 print:p-0">{children}</main>
      </div>

      {/* Telefon: pastki tab-bar */}
      <nav data-tour="mobile-nav" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-solid pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Asosiy">
        <div className="mx-auto grid h-16 max-w-md" style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, minmax(0, 1fr))` }}>
          {mobileTabs.map((tab) => {
            if (tab === '+') {
              if (!primaryAction) return <span key="+" />;
              return (
                <Link key="+" href={primaryAction.href} className="flex items-center justify-center" aria-label={primaryAction.label}>
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-pop transition-transform active:scale-95"><Plus className="size-6" /></span>
                </Link>
              );
            }
            const active = isActive(pathname, tab.href);
            const Icon = NAV_ICONS[tab.icon] ?? Circle;
            return (
              <Link key={tab.href} href={tab.href} className={cn('flex flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-ink' : 'text-ink-3')} aria-current={active ? 'page' : undefined}>
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                <span className="max-w-full truncate px-0.5">{tab.href === '/admin' ? tr('Asosiy') : tr(tab.label)}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setDrawer(true)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-3">
            <Menu className="size-5" strokeWidth={1.8} />
            Menyu
          </button>
        </div>
      </nav>
    </div>
  );
}

function AdminSearch() {
  const tr = useTr();
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form role="search" data-tour="admin-search" className="relative hidden w-full max-w-[240px] xl:block" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`); }}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/55" />
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder={tr('Buyurtma №, telefon…')} aria-label="Admin qidiruv"
        className="h-10 w-full rounded-xl border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/30 focus:bg-white/15" />
    </form>
  );
}

function NotificationsBell({ items, unread }: { items: Notification[]; unread: number }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={`Bildirishnomalar: ${unread} ta yangi`} title="Bildirishnomalar" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn(barBtn, 'relative')}>
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-[18px] text-white num">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 text-ink max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop anim-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[15px] font-semibold tracking-tight">{tr('Bildirishnomalar')}</span>
            {unread > 0 && <button className="text-xs font-medium text-primary" onClick={async () => { await markStaffNotificationsRead(); router.refresh(); setOpen(false); }}>{tr('Hammasi oʻqildi')}</button>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">{tr('Yangi bildirishnoma yoʻq')}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.link?.startsWith('/') ? n.link : '#'} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-surface-2">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    {n.body && <p className="text-[13px] text-ink-3">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-ink-3 num">{formatDateTime(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Qaysi filial ko'rsatiladi. Faqat bir nechta filialni ko'radigan xodimda tanlagich; bittasida oddiy yozuv. */
function BranchSwitch({ branches, className }: { branches: BranchProps; className?: string }) {
  const tr = useTr();
  const router = useRouter();
  if (branches.total < 2 || !branches.mine.length) return null;
  if (branches.mine.length === 1) {
    return (
      <span className={cn('h-10 min-w-0 max-w-[180px] items-center gap-1.5 rounded-xl border border-white/15 px-2.5 text-sm font-medium text-white/80', className)} title="Sizning filialingiz">
        <Building2 className="size-4 shrink-0 text-white/55" /><span className="truncate">{branches.mine[0].name}</span>
      </span>
    );
  }
  const value = branches.current;
  return (
    <label className={cn('relative h-10 min-w-0 max-w-[200px] items-center gap-1.5 rounded-xl border border-white/15 pl-2.5 pr-2 text-sm font-medium text-white hover:bg-white/10', className)}>
      <Building2 className="size-4 shrink-0 text-white/55" />
      <span className="flex-1 truncate">{value ? branches.mine.find((b) => b.id === value)?.name : tr('Barcha filiallar')}</span>
      <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-white/55" aria-hidden><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <select aria-label="Filial" value={value} onChange={(e) => {
        document.cookie = `dk_branch=${Number(e.target.value)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }} className="absolute inset-0 cursor-pointer opacity-0">
        <option value={0}>{tr('Barcha filiallar')}</option>
        {branches.mine.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
