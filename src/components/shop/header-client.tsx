'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Grid2x2, Heart, Home, LayoutGrid, Search, ShoppingCart, User, X } from 'lucide-react';
import type { CategoryNode } from '@/lib/types';
import { useApp, useCart, useWishlist } from '@/components/providers';
import { cn } from '@/components/ui/cn';
import { DynamicIcon } from './dynamic-icon';
import { isUnoptimizable } from './product-image';

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
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        id="site-search"
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('search.placeholder')}
        maxLength={100}
        className="h-11 w-full rounded-xl border-2 border-brand/80 bg-white pl-11 pr-24 text-[15px] focus:border-brand focus:outline-none"
      />
      <button type="submit" className="absolute right-1 top-1 bottom-1 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600">
        {t('search.button')}
      </button>
    </form>
  );
}

export function Logo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${name} — bosh sahifa`}>
      {logoUrl ? (
        <span className="relative block h-9 w-32">
          <Image src={logoUrl} alt={name} fill sizes="128px" className="object-contain object-left" unoptimized={isUnoptimizable(logoUrl)} priority />
        </span>
      ) : (
        <>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-black text-white">{name.slice(0, 1)}</span>
          <span className="text-xl font-extrabold tracking-tight text-ink">{name}</span>
        </>
      )}
    </Link>
  );
}

export function HeaderActions() {
  const { t, user } = useApp();
  const cart = useCart();
  const wishlist = useWishlist();
  const items = [
    { href: user ? '/account' : '/login', label: user ? t('nav.profile') : t('nav.login'), icon: User },
    { href: '/wishlist', label: t('nav.wishlist'), icon: Heart, badge: wishlist.ids.size },
    { href: '/cart', label: t('nav.cart'), icon: ShoppingCart, badge: cart.count },
  ];
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Foydalanuvchi">
      {items.map(({ href, label, icon: Icon, badge }) => (
        <Link key={href} href={href} className="relative flex flex-col items-center rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-ink">
          <Icon className="h-6 w-6" aria-hidden />
          <span className="mt-0.5">{label}</span>
          {!!badge && (
            <span className="absolute right-1.5 top-0 min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-bold leading-5 text-white">{badge > 99 ? '99+' : badge}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function CatalogButton({ tree }: { tree: CategoryNode[] }) {
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
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"
      >
        {open ? <X className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
        {t('nav.catalog')}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex w-[min(880px,calc(100vw-3rem))] overflow-hidden rounded-2xl bg-white shadow-pop animate-fade-in">
          <ul className="w-64 shrink-0 border-r border-line py-2">
            {tree.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.slug}`}
                  onMouseEnter={() => setActive(c.id)}
                  onFocus={() => setActive(c.id)}
                  className={cn('flex items-center gap-3 px-4 py-2.5 text-sm', active === c.id ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700')}
                >
                  <DynamicIcon name={c.icon} className="h-5 w-5" />
                  <span className="flex-1">{c.name}</span>
                  {c.children.length > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex-1 p-6">
            {current && (
              <>
                <Link href={`/category/${current.slug}`} className="text-lg font-bold hover:text-brand">{current.name}</Link>
                {current.children.length ? (
                  <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
                    {current.children.map((s) => (
                      <li key={s.id}>
                        <Link href={`/category/${s.slug}`} className="text-sm text-slate-600 hover:text-brand">{s.name}</Link>
                        {s.children.length > 0 && (
                          <ul className="mt-1 space-y-1 pl-3">
                            {s.children.map((ss) => (
                              <li key={ss.id}><Link href={`/category/${ss.slug}`} className="text-xs text-muted hover:text-brand">{ss.name}</Link></li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">Barcha mahsulotlarni ko‘rish uchun kategoriya nomini bosing.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MobileBottomNav() {
  const { t, user } = useApp();
  const cart = useCart();
  const pathname = usePathname();
  const items = [
    { href: '/', label: t('nav.home'), icon: Home },
    { href: '/catalog', label: t('nav.catalog'), icon: Grid2x2 },
    { href: '/cart', label: t('nav.cart'), icon: ShoppingCart, badge: cart.count },
    { href: '/wishlist', label: t('nav.wishlist'), icon: Heart },
    { href: user ? '/account' : '/login', label: t('nav.profile'), icon: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Asosiy navigatsiya">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={label}>
              <Link href={href} className={cn('relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-brand' : 'text-slate-500')} aria-current={active ? 'page' : undefined}>
                <Icon className="h-6 w-6" aria-hidden />
                {label}
                {!!badge && <span className="absolute left-1/2 top-1.5 ml-1.5 min-w-5 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-5 text-white">{badge > 99 ? '99+' : badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function LangSwitch({ languages }: { languages: string[] }) {
  const { lang } = useApp();
  const router = useRouter();
  if (languages.length < 2) return null;
  return (
    <div className="flex items-center gap-1 text-xs">
      {languages.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
          className={cn('rounded-md px-1.5 py-0.5 font-semibold uppercase', l === lang ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white')}
          aria-pressed={l === lang}
        >
          {l === 'uz' ? 'O‘z' : 'Ру'}
        </button>
      ))}
    </div>
  );
}
