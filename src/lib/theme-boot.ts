// Server ham, brauzer ham ishlatadi (shuning uchun 'use client' emas).
export const THEME_KEY = 'dk_theme';
export type SiteTheme = 'light' | 'dark' | 'system';

/** <head> ichida, chizishdan oldin ishlaydi: oq "chaqnash" bo'lmasin. Standart rejim va qulf — Ega sozlamasidan. */
export function themeBoot(def: SiteTheme = 'system', lock = false): string {
  const d = def === 'light' || def === 'dark' ? def : 'system';
  return `(function(){try{var h=document.documentElement,D='${d}',K=${lock ? 1 : 0}&&!/^\\/admin(\\/|$)/.test(location.pathname);h.dataset.themeDefault=D;if(K)h.dataset.themeLock='1';` +
    `var v=K?null:localStorage.getItem('${THEME_KEY}');var p=v==='dark'||v==='light'?v:D;` +
    `var dk=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);h.classList.toggle('dark',dk)}catch(e){}})();`;
}
