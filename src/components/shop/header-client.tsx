'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Grid2x2, Heart, Home, LayoutGrid, Package, Search, ShoppingCart, User, X } from 'lucide-react';
import type { CategoryNode } from '@/lib/types';
import { useApp, useCart, useWishlist, useL } from '@/components/providers';
import { cn } from '@/components/ui/cn';
import { DynamicIcon } from './dynamic-icon';

export function SearchBox({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const { t } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [q, setQ] = useState(pathname === '/search' ? params.get('q') ?? '' : '');
  return (
    <form
      role="search"
      className={cn('relative flex w-full', className)}
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
    >
      <label htmlFor="site-search" className="sr-only">{t('search.button')}</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        id="site-search"
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('search.placeholder')}
        maxLength={100}
        className="h-10 w-full rounded-lg border border-transparent bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-[var(--card)] focus:bg-surface focus:ring-4 focus:ring-[color-mix(in_srgb,var(--card)_15%,transparent)]"
      />
    </form>
  );
}

export function HeaderActions() {
  const { t, user } = useApp();
  const cart = useCart();
  const wishlist = useWishlist();
  const items = [
    { href: '/wishlist', label: t('nav.wishlist'), icon: Heart, badge: wishlist.ids.size, desktopOnly: true },
    { href: user ? '/account' : '/login', label: user ? t('nav.profile') : t('nav.login'), icon: User, desktopOnly: true },
    { href: '/cart', label: t('nav.cart'), icon: ShoppingCart, badge: cart.count, desktopOnly: false },
  ];
  return (
    <nav className="flex items-center gap-1" aria-label="Foydalanuvchi">
      {items.map(({ href, label, icon: Icon, badge, desktopOnly }) => (
        <Link key={href} href={href} aria-label={label} title={label} data-tour={href === '/cart' ? 'cart' : undefined}
          className={cn('relative size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink', desktopOnly ? 'hidden md:inline-flex' : 'inline-flex')}>
          <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
          {!!badge && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[11px] font-semibold leading-[18px] text-primary-fg num">{badge > 99 ? '99+' : badge}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function CatalogButton({ tree }: { tree: CategoryNode[] }) {
  const L = useL();
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(tree[0]?.id ?? null);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const current = tree.find((c) => c.id === active);
  return (
    <div ref={ref} className="relative hidden md:block" data-tour="catalog">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-fg shadow-soft transition-all hover:opacity-90 active:scale-[0.98]"
      >
        {open ? <X className="size-4" /> : <LayoutGrid className="size-4" />}
        {t('nav.catalog')}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex w-[min(880px,calc(100vw-3rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop anim-pop">
          <ul className="w-64 shrink-0 border-r border-line p-1.5">
            {tree.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.slug}`}
                  onMouseEnter={() => setActive(c.id)}
                  onFocus={() => setActive(c.id)}
                  className={cn('flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors', active === c.id ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2')}
                >
                  <DynamicIcon name={c.icon} className="size-[18px] text-ink-3" />
                  <span className="flex-1">{c.name}</span>
                  {c.children.length > 0 && <ChevronRight className="h-4 w-4 text-ink-3" />}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex-1 p-6">
            {current && (
              <>
                <Link href={`/category/${current.slug}`} className="text-[15px] font-semibold tracking-tight hover:text-primary">{current.name}</Link>
                {current.children.length ? (
                  <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
                    {current.children.map((s) => (
                      <li key={s.id}>
                        <Link href={`/category/${s.slug}`} className="text-sm text-ink-2 hover:text-primary">{s.name}</Link>
                        {s.children.length > 0 && (
                          <ul className="mt-1 space-y-1 pl-3">
                            {s.children.map((ss) => (
                              <li key={ss.id}><Link href={`/category/${ss.slug}`} className="text-xs text-ink-3 hover:text-primary">{ss.name}</Link></li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-3">{L("Barcha mahsulotlarni ko‘rish uchun kategoriya nomini bosing.")}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Telefonda pastki tab-bar (kassa 1.9/1.13): Bosh sahifa, Katalog, o'rtada katta "Savat", Buyurtmalarim, Profil. */
export function MobileBottomNav() {
  const L = useL();
  const { t, user, lang } = useApp();
  const cart = useCart();
  const pathname = usePathname();
  const items = [
    { href: '/', label: t('nav.home'), icon: Home },
    { href: '/catalog', label: t('nav.catalog'), icon: Grid2x2 },
    { href: '/cart', label: t('nav.cart'), icon: ShoppingCart, center: true },
    { href: user ? '/account/orders' : '/track', label: lang === 'ru' ? 'Заказы' : L("Buyurtmalar"), icon: Package },
    { href: user ? '/account' : '/login', label: t('nav.profile'), icon: User },
  ];
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface glass pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label={L("Asosiy navigatsiya")}>
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon, center }) => {
          const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
          if (center) {
            return (
              <li key={label} className="flex items-center justify-center">
                <Link href={href} aria-label={label} className="relative" data-tour="cart">
                  <span className={cn('flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-pop transition-transform active:scale-95', active && 'ring-4 ring-surface-3')}>
                    <Icon className="size-6" aria-hidden />
                  </span>
                  {cart.count > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-[var(--bg)] bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white num">{cart.count > 99 ? '99+' : cart.count}</span>}
                </Link>
              </li>
            );
          }
          return (
            <li key={label}>
              <Link href={href} data-tour={href === '/catalog' ? 'catalog' : href === '/account/orders' || href === '/track' ? 'orders' : href === '/account' || href === '/login' ? 'profile' : undefined} className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-tight', active ? 'text-ink' : 'text-ink-3')} aria-current={active ? 'page' : undefined}>
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                <span className="max-w-full truncate px-0.5">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const LANG_SHORT: Record<string, string> = { uz: 'UZ', ru: 'RU', zh: '中文' };

/** Til tanlagich: UZ | RU | 中文 segment. Til almashganda sahifa qayta yuklanadi. */
export function LangSwitch({ languages, className }: { languages: string[]; className?: string }) {
  const { lang } = useApp();
  const router = useRouter();
  if (languages.length < 2) return null;
  return (
    <div className={cn('rounded-lg bg-surface-2 p-0.5', className)} role="radiogroup" aria-label="Til">
      {languages.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === lang}
          onClick={() => {
            document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
          className={cn('h-7 rounded-md px-2 text-xs font-medium transition-colors', l === lang ? 'bg-surface text-ink shadow-soft' : 'text-ink-3 hover:text-ink')}
        >
          {LANG_SHORT[l] ?? l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
