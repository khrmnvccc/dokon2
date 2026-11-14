'use client';

import { useL } from '@/components/providers';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Heart, LayoutDashboard, LogOut, MapPin, Package, User, UsersRound } from 'lucide-react';
import { logout } from '@/lib/actions/auth';
import { cn } from '@/components/ui/cn';

const links = [
  { href: '/account', label: "Profil", icon: User },
  { href: '/account/orders', label: "Buyurtmalarim", icon: Package },
  { href: '/account/referral', label: "Doʻstni taklif qilish", icon: UsersRound },
  { href: '/account/addresses', label: "Manzillar", icon: MapPin },
  { href: '/account/notifications', label: "Bildirishnomalar", icon: Bell },
  { href: '/wishlist', label: "Sevimlilar", icon: Heart },
];

const TAB_PAGES = ['/account/orders', '/account/referral'];
const item = 'flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 text-center text-[12px] font-medium leading-tight md:flex-row md:justify-start md:gap-2.5 md:px-3 md:text-left md:text-sm';

export function AccountNav({ name, email, isStaff }: { name: string; email: string | null; isStaff: boolean }) {
  const L = useL();
  const pathname = usePathname();
  return (
    // Telefonda "Buyurtmalar" va "Doʻstlar" pastki menyudan ochiladi — u yerda kabinet menyusi koʻrsatilmaydi (ekran toza).
    <aside className={cn('rounded-xl border border-line bg-surface p-3 shadow-soft', TAB_PAGES.some((p) => pathname.startsWith(p)) && 'hidden md:block')}>
      <div className="flex items-center gap-3 border-b border-line px-2 pb-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[15px] font-semibold tracking-tight text-primary">{name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          {email && <p className="truncate text-xs text-ink-3">{email}</p>}
        </div>
        <form action={logout} className="ml-auto md:hidden">
          <button className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-danger hover:bg-danger-soft">
            <LogOut className="size-4" /> {L("Chiqish")}
          </button>
        </form>
      </div>
      <nav className="mt-2 grid grid-cols-3 gap-1 md:flex md:flex-col" aria-label="Kabinet">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === '/account' ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}
              className={cn(item, active ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-surface-2')}>
              <Icon className="h-[18px] w-[18px] shrink-0" /> <span>{L(label)}</span>
            </Link>
          );
        })}
        {isStaff && (
          <Link href="/admin" className={cn(item, 'text-ink-2 hover:bg-surface-2')}>
            <LayoutDashboard className="h-[18px] w-[18px] shrink-0" /> <span>{L("Admin panel")}</span>
          </Link>
        )}
        <form action={logout} className="hidden md:block">
          <button className={cn(item, 'w-full text-danger hover:bg-danger-soft')}>
            <LogOut className="h-[18px] w-[18px] shrink-0" /> <span>{L("Chiqish")}</span>
          </button>
        </form>
      </nav>
    </aside>
  );
}
