'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, Bell, Circle, ExternalLink, FileText, FolderTree, History, Image, LayoutDashboard, LogOut, Menu, MessageSquare,
  Package, Percent, Search, Settings, ShieldCheck, ShoppingBag, TicketPercent, Truck, Users, Warehouse, type LucideIcon,
} from 'lucide-react';
import type { AdminNavGroup } from '@/lib/admin/nav';
import { ROLE_LABELS } from '@/lib/admin/nav';
import { logout } from '@/lib/actions/auth';
import { markStaffNotificationsRead } from '@/lib/actions/admin/misc';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import type { Notification } from '@/lib/types';

const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingBag, Users, BarChart3, Package, FolderTree, Warehouse, MessageSquare, Image, Percent,
  TicketPercent, FileText, Truck, Settings, ShieldCheck, History,
};

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = NAV_ICONS[name] ?? Circle;
  return <Icon className={className} aria-hidden />;
}

export function AdminShell({ nav, storeName, email, roles, notifications, unread, canSearch, children }: {
  nav: AdminNavGroup[]; storeName: string; email: string | null; roles: string[]; notifications: Notification[]; unread: number; canSearch: boolean; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Admin menyu">
      <div className="flex h-16 items-center justify-between gap-2 px-5">
        <Link href="/admin" className="truncate text-lg font-extrabold text-white">{storeName}</Link>
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">Admin</span>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {nav.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={active ? 'page' : undefined}
                      className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition', active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
                      <NavIcon name={item.icon} className="h-[18px] w-[18px]" /> {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <p className="truncate px-3 text-sm text-white">{email}</p>
        <p className="px-3 text-xs text-slate-500">{roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}</p>
        <div className="mt-2 flex gap-1">
          <Link href="/" target="_blank" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"><ExternalLink className="h-3.5 w-3.5" /> Sayt</Link>
          <form action={logout} className="flex-1">
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"><LogOut className="h-3.5 w-3.5" /> Chiqish</button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 bg-slate-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-label="Menyuni yopish" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-slate-900 animate-fade-in">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64 print:pl-0">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Menyu"><Menu className="h-5 w-5" /></button>
          {canSearch && <AdminSearch />}
          <div className="ml-auto"><NotificationsBell items={notifications} unread={unread} /></div>
        </header>
        <main className="p-4 sm:p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}

function AdminSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form role="search" className="relative w-full max-w-md" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`); }}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Buyurtma №, telefon, mahsulot, SKU…" aria-label="Admin qidiruv"
        className="h-10 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm focus:border-brand focus:bg-white focus:outline-none" />
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
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-lg p-2 hover:bg-slate-100" aria-label={`Bildirishnomalar: ${unread} ta yangi`} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-fade-in">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Bildirishnomalar</span>
            {unread > 0 && <button className="text-xs font-medium text-brand" onClick={async () => { await markStaffNotificationsRead(); router.refresh(); setOpen(false); }}>Hammasi o‘qildi</button>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Yangi bildirishnoma yo‘q</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.link?.startsWith('/') ? n.link : '#'} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-slate-50">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(n.created_at)}</p>
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

