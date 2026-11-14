'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone } from 'lucide-react';
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
  HapticFeedback?: { impactOccurred(s: 'light' | 'medium'): void; notificationOccurred?(t: 'success' | 'error'): void };
  requestContact?: (cb?: (sent: boolean) => void) => void;
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
  const [askPhone, setAskPhone] = useState(false);

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
      const json = (await res?.json().catch(() => null)) as { ok?: boolean; changed?: boolean; error?: string; needPhone?: boolean } | null;
      try { sessionStorage.setItem('dk_tg_auth', '1'); } catch { /* */ }
      if (!json?.ok) {
        if (json?.error && res?.status !== 401) toast(json.error, 'error');
        return;
      }
      if (json.needPhone) setAskPhone(true);
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
  if (!askPhone) return null;
  return <PhoneSheet app={app.current} onDone={(no) => {
    setAskPhone(false);
    if (no !== undefined) { toast(no ? `Roʻyxatdan oʻtdingiz! Sizning ID: ${no}` : 'Roʻyxatdan oʻtdingiz!', 'success'); router.refresh(); }
  }} />;
}

/** Bir bosishda roʻyxatdan oʻtish: Telegram raqamni botga yuboradi, bot uni akkauntga yozadi. */
function PhoneSheet({ app, onDone }: { app: TgWebApp | null; onDone: (clientNo?: number | null) => void }) {
  const [waiting, setWaiting] = useState(false);
  const canAsk = Boolean(app?.requestContact && app.isVersionAtLeast('6.9'));
  const send = () => {
    if (!app?.requestContact) return;
    app.requestContact(async (sent) => {
      if (!sent) return;
      setWaiting(true);
      // Bot raqamni saqlaguncha kutamiz (odatda 1–2 soniya).
      for (let k = 0; k < 12; k++) {
        await new Promise((r) => setTimeout(r, 1000));
        const me = (await fetch('/api/telegram/me', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)) as { hasPhone?: boolean; clientNo?: number | null } | null;
        if (me?.hasPhone) {
          app.HapticFeedback?.notificationOccurred?.('success');
          onDone(me.clientNo ?? null);
          return;
        }
      }
      setWaiting(false);
      onDone(null);
    });
  };
  return createPortal(
    <div className="fixed inset-0 z-[96] flex items-end bg-black/50 anim-fade" role="dialog" aria-modal="true" aria-label="Roʻyxatdan oʻtish">
      <div className="w-full rounded-t-3xl bg-surface-solid px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6 text-center shadow-pop anim-rise">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Smartphone className="size-7" /></span>
        <h2 className="mt-3 text-lg font-bold">Bir bosishda roʻyxatdan oʻting</h2>
        <p className="mt-1 text-sm text-ink-3">Telegram raqamingizni yuboring — parol va SMS kerak emas. Raqam faqat buyurtmani yetkazish uchun ishlatiladi.</p>
        {canAsk ? (
          <button type="button" onClick={send} disabled={waiting} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-fg disabled:opacity-70">
            <Smartphone className="size-5" /> {waiting ? 'Saqlanmoqda…' : 'Raqamni yuborish'}
          </button>
        ) : (
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">Botga qayting va pastdagi <b>“Raqamni yuborish”</b> tugmasini bosing.</p>
        )}
        <button type="button" onClick={() => onDone()} className="mt-2 h-10 w-full text-sm font-medium text-ink-3">Keyinroq</button>
      </div>
    </div>,
    document.body,
  );
}

function syncBack(wa: TgWebApp, path: string) {
  if (!wa.isVersionAtLeast('6.1')) return;
  if (ROOTS.has(path)) wa.BackButton.hide();
  else wa.BackButton.show();
}
