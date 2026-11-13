'use client';

import { useEffect, useState } from 'react';

// Mavzu: tizim bo'yicha / yorug' / qorong'i — qurilmada saqlanadi (kassa src/lib/theme.ts).
export type ThemePref = 'light' | 'dark' | 'system';
export const THEME_KEY = 'dk_theme';

function read(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>('system');
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setPref(read());
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
    const onChange = () => { apply('system'); setIsDark(mq.matches); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
  return { pref, setPref: choose, isDark, toggle: () => choose(document.documentElement.classList.contains('dark') ? 'light' : 'dark') };
}

/** <head> ichida, chizishdan oldin ishlaydi: oq "chaqnash" bo'lmasin. */
export const THEME_BOOT = `(function(){try{var v=localStorage.getItem('${THEME_KEY}');var d=v==='dark'||(v!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;
