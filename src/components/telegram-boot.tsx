'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

// Sayt Telegram mini-ilovasi ichida ochilganda: Telegram skriptini yuklaydi, oynani toʻliq ochadi,
// “Orqaga” tugmasini ulaydi va foydalanuvchini avtomatik kiritadi (/api/telegram/webapp).
// Oddiy brauzerda hech narsa qilmaydi va skript ham yuklanmaydi.

interface TgWebApp {
  initData: string;
  version: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: { impactOccurred(s: 'light' | 'medium'): void };
}
declare global { interface Window { Telegram?: { WebApp?: TgWebApp } } }

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js?59';
const ROOTS = new Set(['/', '/admin', '/login']);

function insideTelegram() {
  try {
    if (location.hash.includes('tgWebAppData') || sessionStorage.getItem('dk_tg') === '1') {
      sessionStorage.setItem('dk_tg', '1');
      return true;
    }
  } catch { /* sessionStorage yopiq */ }
  return false;
}

function loadScript(): Promise<TgWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve(window.Telegram?.WebApp ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

export function TelegramBoot() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const app = useRef<TgWebApp | null>(null);
  const back = useRef(() => router.back());

  useEffect(() => {
    if (!insideTelegram()) return;
    let alive = true;
    document.documentElement.classList.add('tg-app');
    loadScript().then(async (wa) => {
      if (!alive || !wa?.initData) return;
      app.current = wa;
      wa.ready();
      wa.expand();
      if (wa.isVersionAtLeast('7.7')) wa.disableVerticalSwipes?.();
      const bg = getComputedStyle(document.body).backgroundColor;
      if (wa.isVersionAtLeast('6.1') && /^rgb/.test(bg)) {
        const hex = '#' + (bg.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
        wa.setHeaderColor?.(hex);
        wa.setBackgroundColor?.(hex);
      }
      wa.BackButton.onClick(back.current);
      syncBack(wa, location.pathname);
      // Har sessiyada bir marta kiritish
      try { if (sessionStorage.getItem('dk_tg_auth') === '1') return; } catch { /* */ }
      const res = await fetch('/api/telegram/webapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: wa.initData }),
      }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { ok?: boolean; changed?: boolean; error?: string } | null;
      try { sessionStorage.setItem('dk_tg_auth', '1'); } catch { /* */ }
      if (!json?.ok) {
        if (json?.error && res?.status !== 401) toast(json.error, 'error');
        return;
      }
      if (json.changed) {
        if (location.pathname === '/login') {
          const next = new URLSearchParams(location.search).get('next');
          location.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
        } else router.refresh();
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (app.current) syncBack(app.current, pathname); }, [pathname]);
  return null;
}

function syncBack(wa: TgWebApp, path: string) {
  if (!wa.isVersionAtLeast('6.1')) return;
  if (ROOTS.has(path)) wa.BackButton.hide();
  else wa.BackButton.show();
}
