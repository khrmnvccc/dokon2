'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Heart, LayoutDashboard, LogOut, MapPin, Package, User } from 'lucide-react';
import { logout } from '@/lib/actions/auth';
import { cn } from '@/components/ui/cn';

const links = [
  { href: '/account', label: 'Profil', icon: User },
  { href: '/account/orders', label: 'Buyurtmalarim', icon: Package },
  { href: '/account/addresses', label: 'Manzillar', icon: MapPin },
  { href: '/account/notifications', label: 'Bildirishnomalar', icon: Bell },
  { href: '/wishlist', label: 'Sevimlilar', icon: Heart },
];

export function AccountNav({ name, email, isStaff }: { name: string; email: string | null; isStaff: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="rounded-2xl bg-white p-3 shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-2 pb-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand">{name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          {email && <p className="truncate text-xs text-muted">{email}</p>}
        </div>
      </div>
      <nav className="no-scrollbar -mx-1 mt-2 flex gap-1 overflow-x-auto md:flex-col" aria-label="Kabinet">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === '/account' ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}
              className={cn('flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium', active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
              <Icon className="h-[18px] w-[18px]" /> {label}
            </Link>
          );
        })}
        {isStaff && (
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <LayoutDashboard className="h-[18px] w-[18px]" /> Admin panel
          </Link>
        )}
        <form action={logout}>
          <button className="flex w-full shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
            <LogOut className="h-[18px] w-[18px]" /> Chiqish
          </button>
        </form>
      </nav>
    </aside>
  );
}
