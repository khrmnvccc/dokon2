'use client';

import { useEffect, useState } from 'react';

// Mavzu: tizim bo'yicha / yorug' / qorong'i — qurilmada saqlanadi (kassa src/lib/theme.ts).
// Ega Brend va dizayn bo'limida hamma uchun standart rejimni tanlaydi (<html data-theme-default>).
// "Qulflangan" bo'lsa doʻkonda mijozning o'z tanlovi e'tiborga olinmaydi (admin panelda xodim baribir almashtira oladi).
export type ThemePref = 'light' | 'dark' | 'system';
import { THEME_KEY } from './theme-boot';
export { THEME_KEY };

const isAdminPath = () => /^\/admin(\/|$)/.test(window.location.pathname);

/** Ega tanlagan standart rejim (boot skript <html> ga yozadi). */
function siteDefault(): ThemePref {
  const v = document.documentElement.dataset.themeDefault;
  return v === 'light' || v === 'dark' ? v : 'system';
}
export const themeLocked = () => document.documentElement.dataset.themeLock === '1' && !isAdminPath();

function read(): ThemePref {
  if (themeLocked()) return 'system';
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** 'system' = egasi tanlagan standart (u ham 'system' bo'lsa — qurilma sozlamasi). */
function resolveDark(pref: ThemePref) {
  const p = pref === 'system' ? siteDefault() : pref;
  return p === 'dark' || (p === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function apply(pref: ThemePref) {
  document.documentElement.classList.toggle('dark', resolveDark(pref));
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>('system');
  const [isDark, setIsDark] = useState(false);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    setPref(read());
    setLocked(themeLocked());
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);
  const choose = (next: ThemePref) => {
    apply(next);
    setPref(next);
    setIsDark(document.documentElement.classList.contains('dark'));
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // Xotira yo'q: mavzu shu tashrif uchun qo'llanadi.
    }
  };
  useEffect(() => {
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { apply('system'); setIsDark(document.documentElement.classList.contains('dark')); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
  return { pref, setPref: choose, isDark, locked, toggle: () => choose(document.documentElement.classList.contains('dark') ? 'light' : 'dark') };
}

