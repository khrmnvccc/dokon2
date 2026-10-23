'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { translate, type Lang, type TKey } from '@/lib/i18n/dict';
import { formatPrice } from '@/lib/format';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { ConfirmProvider } from '@/components/ui/dialog';

export interface SessionUser { id: string; email: string | null; name: string | null }

interface AppContextValue {
  lang: Lang;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  price: (value: number | null | undefined) => string;
  user: SessionUser | null;
  isStaff: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProviders');
  return ctx;
}

// ---------------- Savatcha ----------------
export interface CartItem { productId: string; variantId: string | null; quantity: number }
interface CartContextValue {
  items: CartItem[];
  ready: boolean;
  count: number;
  add: (productId: string, variantId: string | null, quantity?: number) => void;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
  has: (productId: string, variantId?: string | null) => boolean;
}
const CartContext = createContext<CartContextValue | null>(null);
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within AppProviders');
  return ctx;
}

const CART_KEY = 'dk_cart_v1';
const sameLine = (a: { productId: string; variantId: string | null }, productId: string, variantId: string | null) =>
  a.productId === productId && (a.variantId ?? null) === (variantId ?? null);

function readLocalCart(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => typeof i?.productId === 'string' && Number.isInteger(i?.quantity))
      .map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: Math.min(999, Math.max(1, i.quantity)) }))
      .slice(0, 100);
  } catch {
    return [];
  }
}

function CartProvider({ children, user }: { children: ReactNode; user: SessionUser | null }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedForUser = useRef<string | null>(null);

  useEffect(() => {
    setItems(readLocalCart());
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === CART_KEY && setItems(readLocalCart());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Tizimga kirgan foydalanuvchi: server savatchasi bilan birlashtirish
  useEffect(() => {
    if (!ready || !user || loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;
    fetch('/api/cart', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items: CartItem[] }) => {
        setItems((local) => {
          const merged = [...local];
          for (const s of data.items ?? []) {
            const existing = merged.find((m) => sameLine(m, s.productId, s.variantId));
            if (existing) existing.quantity = Math.max(existing.quantity, s.quantity);
            else merged.push(s);
          }
          return merged;
        });
      })
      .catch(() => {});
  }, [ready, user]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {}
    if (!user || loadedForUser.current !== user.id) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch('/api/cart', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) }).catch(() => {});
    }, 700);
  }, [items, ready, user]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    ready,
    count: items.reduce((s, i) => s + i.quantity, 0),
    add: (productId, variantId, quantity = 1) =>
      setItems((prev) => {
        const existing = prev.find((i) => sameLine(i, productId, variantId));
        if (existing) return prev.map((i) => (i === existing ? { ...i, quantity: Math.min(999, i.quantity + quantity) } : i));
        return [...prev, { productId, variantId, quantity }].slice(-100);
      }),
    setQuantity: (productId, variantId, quantity) =>
      setItems((prev) => prev.map((i) => (sameLine(i, productId, variantId) ? { ...i, quantity: Math.min(999, Math.max(1, quantity)) } : i))),
    remove: (productId, variantId) => setItems((prev) => prev.filter((i) => !sameLine(i, productId, variantId))),
    clear: () => setItems([]),
    has: (productId, variantId) => items.some((i) => i.productId === productId && (variantId === undefined || (i.variantId ?? null) === (variantId ?? null))),
  }), [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ---------------- Sevimlilar ----------------
interface WishlistContextValue { ids: Set<string>; toggle: (productId: string) => Promise<void> }
const WishlistContext = createContext<WishlistContextValue | null>(null);
export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within AppProviders');
  return ctx;
}

function WishlistProvider({ children, user }: { children: ReactNode; user: SessionUser | null }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    fetch('/api/wishlist', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d: { ids: string[] }) => setIds(new Set(d.ids)))
      .catch(() => {});
  }, [user]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) {
      toast('Sevimlilarga qo‘shish uchun tizimga kiring', 'info');
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const had = ids.has(productId);
    setIds((prev) => {
      const next = new Set(prev);
      if (had) next.delete(productId);
      else next.add(productId);
      return next;
    });
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId, add: !had }),
    }).catch(() => null);
    if (!res?.ok) {
      setIds((prev) => {
        const next = new Set(prev);
        if (had) next.add(productId);
        else next.delete(productId);
        return next;
      });
      toast('Xatolik yuz berdi, qayta urinib ko‘ring', 'error');
    } else {
      toast(had ? 'Sevimlilardan olib tashlandi' : 'Sevimlilarga qo‘shildi');
    }
  }, [ids, pathname, router, toast, user]);

  return <WishlistContext.Provider value={{ ids, toggle }}>{children}</WishlistContext.Provider>;
}

export function AppProviders({ children, lang, currencySymbol, user, isStaff }: {
  children: ReactNode; lang: Lang; currencySymbol: string; user: SessionUser | null; isStaff: boolean;
}) {
  const app = useMemo<AppContextValue>(() => ({
    lang,
    t: (key, vars) => translate(lang, key, vars),
    price: (v) => formatPrice(v, currencySymbol),
    user,
    isStaff,
  }), [lang, currencySymbol, user, isStaff]);

  return (
    <AppContext.Provider value={app}>
      <ToastProvider>
        <ConfirmProvider>
          <CartProvider user={user}>
            <WishlistProvider user={user}>{children}</WishlistProvider>
          </CartProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AppContext.Provider>
  );
}
