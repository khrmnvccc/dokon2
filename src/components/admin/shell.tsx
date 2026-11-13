'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, Bell, Circle, ExternalLink, FileText, FolderTree, History, Image, LayoutDashboard, LogOut, Menu, MessageSquare,
  Bot, Building2, Package, Percent, Plus, Search, Send, Settings, ShieldCheck, ShoppingBag, TicketPercent, Truck, Users, Warehouse, X, type LucideIcon,
} from 'lucide-react';
import type { AdminNavGroup } from '@/lib/admin/nav';
import { logout } from '@/lib/actions/auth';
import { markStaffNotificationsRead } from '@/lib/actions/admin/misc';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Button, IconButton } from '@/components/ui/button';
import { Avatar } from '@/components/ui/kit';
import { Logo, ThemeToggle } from '@/components/brand';
import { groupLabel, useBrand } from '@/lib/brand/store';
import { LangSwitch } from '@/components/shop/header-client';
import type { Notification } from '@/lib/types';

const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingBag, Users, BarChart3, Package, FolderTree, Warehouse, MessageSquare, Image, Percent,
  TicketPercent, FileText, Truck, Settings, ShieldCheck, History, Send, Bot,
};

const isActive = (pathname: string, href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
function TodayLabel() {
  const [text, setText] = useState('');
  useEffect(() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    setText(`${WEEKDAYS[now.getDay()]}|${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`);
  }, []);
  if (!text) return null;
  const [day, date] = text.split('|');
  return <div className="text-sm text-ink-3"><span className="text-ink-2">{day}</span>, <span className="num">{date}</span></div>;
}

/** "Jonli" indikatori: /api/admin/version har 8 soniyada so'raladi; o'zgarsa sahifa yangilanadi. */
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
    const id = setInterval(tick, 8000);
    const onVisible = () => !document.hidden && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [router]);
  return online;
}

function SyncIndicator({ online }: { online: boolean }) {
  return (
    <span className={cn('hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex', online ? 'border-line text-ink-2' : 'border-danger/30 bg-danger-soft text-danger')}
      title={online ? 'Maʼlumotlar har bir necha soniyada avtomatik yangilanadi' : 'Server bilan aloqa yoʻq'}>
      <span className="relative flex size-2">
        {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />}
        <span className={cn('relative inline-flex size-2 rounded-full', online ? 'bg-success' : 'bg-danger')} />
      </span>
      {online ? 'Jonli' : 'Aloqa yoʻq'}
    </span>
  );
}

function NavLinks({ nav, pathname, onNavigate }: { nav: AdminNavGroup[]; pathname: string; onNavigate?: () => void }) {
  const brand = useBrand();
  return (
    <nav className="space-y-5" aria-label="Admin menyu">
      {nav.map((group) => (
        <div key={group.title}>
          <div className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{groupLabel(brand, group.title)}</div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = NAV_ICONS[item.icon] ?? Circle;
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                  className={cn('group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    active ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
                  <Icon className={cn('size-[18px] transition-colors', active ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2')} strokeWidth={1.9} aria-hidden />
                  <span className="truncate">{item.label}</span>
                  {item.paused && <span className="ml-auto rounded-full bg-warn-soft px-1.5 py-px text-[10px] font-semibold text-warn">Vaqtincha</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function UserCard({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{name}</div>
        <div className="truncate text-xs text-ink-3">{role}</div>
      </div>
      <form action={logout}>
        <IconButton label="Chiqish" type="submit"><LogOut className="size-4" /></IconButton>
      </form>
    </div>
  );
}

function SidebarBody({ nav, pathname, name, role, languages, onNavigate, onClose }: {
  nav: AdminNavGroup[]; pathname: string; name: string; role: string; languages: string[]; onNavigate?: () => void; onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-2">
        <Link href="/admin" className="min-w-0" onClick={onNavigate}><Logo /></Link>
        {onClose && <IconButton label="Yopish" onClick={onClose}><X className="size-5" /></IconButton>}
      </div>
      <div className="scrollbar-thin mt-7 flex-1 overflow-y-auto"><NavLinks nav={nav} pathname={pathname} onNavigate={onNavigate} /></div>
      <Link href="/" target="_blank" className="mb-2 flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
        <ExternalLink className="size-[18px] text-ink-3" strokeWidth={1.9} /> Saytni ochish
      </Link>
      {languages.length > 1 && <LangSwitch languages={languages} className="mb-2 flex [&>button]:flex-1" />}
      <UserCard name={name} role={role} />
    </>
  );
}

export interface BranchProps { mine: Array<{ id: number; name: string }>; current: number; total: number }

export function AdminShell({ nav, email, name, roleName, notifications, unread, canSearch, languages, primaryAction, branches, children }: {
  nav: AdminNavGroup[]; email: string | null; name: string | null; roles: string[]; roleName: string; notifications: Notification[]; unread: number; canSearch: boolean;
  languages: string[]; primaryAction: { href: string; label: string } | null; branches: BranchProps; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const online = useLive();
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  const who = name || email || 'Xodim';

  // Telefon tab-bar: 2 ta asosiy sahifa + o'rtada katta "+" + 1 sahifa + Menyu.
  const flat = nav.flatMap((g) => g.items);
  const tabs = ['/admin', '/admin/orders', '+', '/admin/products'].map((h) => (h === '+' ? '+' : flat.find((i) => i.href === h))).filter(Boolean) as Array<'+' | (typeof flat)[number]>;

  return (
    <div className="min-h-screen">
      {/* Kompyuter: chapda 248px sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-surface glass px-3 py-5 lg:flex">
        <SidebarBody nav={nav} pathname={pathname} name={who} role={roleName} languages={languages} />
      </aside>

      {/* Telefon: chapdan chiqadigan drawer (280px) */}
      {drawer && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 anim-fade" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-surface glass px-3 py-5 shadow-pop anim-rise">
            <SidebarBody nav={nav} pathname={pathname} name={who} role={roleName} languages={languages} onNavigate={() => setDrawer(false)} onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-[248px] print:pl-0">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-surface glass">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-16 lg:px-8">
            <IconButton label="Menyu" className="-ml-2 lg:hidden" onClick={() => setDrawer(true)}><Menu className="size-5" /></IconButton>
            <div className="min-w-0 flex-1">
              <div className="lg:hidden"><Logo compact /></div>
              <div className="hidden lg:block"><TodayLabel /></div>
            </div>
            {canSearch && <AdminSearch />}
            <BranchSwitch branches={branches} className="hidden sm:inline-flex" />
            <SyncIndicator online={online} />
            <NotificationsBell items={notifications} unread={unread} />
            <ThemeToggle />
            {primaryAction && pathname !== primaryAction.href && (
              <Link href={primaryAction.href} className="hidden sm:block">
                <Button variant="primary" icon={<Plus className="size-4" />}>{primaryAction.label}</Button>
              </Link>
            )}
          </div>
          {/* Telefonda sarlavha to'la: filial alohida qatorda */}
          <div className="px-4 pb-2 empty:hidden sm:hidden"><BranchSwitch branches={branches} className="flex w-full" /></div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12 print:p-0">{children}</main>
      </div>

      {/* Telefon: pastki tab-bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface glass pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Asosiy">
        <div className="mx-auto grid h-16 max-w-md" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
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
                <span className="max-w-full truncate px-0.5">{tab.href === '/admin' ? 'Asosiy' : tab.label}</span>
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
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form role="search" className="relative hidden w-full max-w-xs md:block" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`); }}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Buyurtma №, telefon, mahsulot…" aria-label="Admin qidiruv"
        className="h-9 w-full rounded-lg border border-transparent bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-[var(--card)] focus:bg-surface" />
    </form>
  );
}

function NotificationsBell({ items, unread }: { items: Notification[]; unread: number }) {
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
      <IconButton label={`Bildirishnomalar: ${unread} ta yangi`} onClick={() => setOpen((v) => !v)} aria-expanded={open} className="relative">
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-[18px] text-white num">{unread > 99 ? '99+' : unread}</span>}
      </IconButton>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop anim-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[15px] font-semibold tracking-tight">Bildirishnomalar</span>
            {unread > 0 && <button className="text-xs font-medium text-primary" onClick={async () => { await markStaffNotificationsRead(); router.refresh(); setOpen(false); }}>Hammasi oʻqildi</button>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">Yangi bildirishnoma yoʻq</p>
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
  const router = useRouter();
  if (branches.total < 2 || !branches.mine.length) return null;
  if (branches.mine.length === 1) {
    return (
      <span className={cn('h-9 min-w-0 items-center gap-1.5 rounded-lg border border-line px-2.5 text-sm font-medium text-ink-2', className)} title="Sizning filialingiz">
        <Building2 className="size-4 shrink-0 text-ink-3" /><span className="truncate">{branches.mine[0].name}</span>
      </span>
    );
  }
  const value = branches.current;
  return (
    <label className={cn('relative h-9 min-w-0 items-center gap-1.5 rounded-lg border border-line bg-surface pl-2.5 pr-2 text-sm font-medium text-ink hover:bg-surface-2', className)}>
      <Building2 className="size-4 shrink-0 text-ink-3" />
      <span className="flex-1 truncate">{value ? branches.mine.find((b) => b.id === value)?.name : 'Barcha filiallar'}</span>
      <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-ink-3" aria-hidden><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <select aria-label="Filial" value={value} onChange={(e) => {
        document.cookie = `dk_branch=${Number(e.target.value)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }} className="absolute inset-0 cursor-pointer opacity-0">
        <option value={0}>Barcha filiallar</option>
        {branches.mine.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
