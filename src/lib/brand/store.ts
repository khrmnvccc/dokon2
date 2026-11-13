'use client';

import { useSyncExternalStore } from 'react';
import { cleanBrand, DEFAULT_BRAND, type BrandSettings, type MenuGroup } from './config';
import { brandCss } from './css';

// Ega tanlagan nom, rang va logo. Qurilmada ham saqlanadi (sahifa darhol to'g'ri rangda ochilsin),
// keyin serverdan yangilanadi. Kassa src/lib/brand.tsx dan ko'chirilgan; Next.js uchun boshlang'ich qiymat serverdan keladi.
const KEY = 'dk_brand';

let current: BrandSettings = DEFAULT_BRAND;
let shown: BrandSettings = DEFAULT_BRAND;
const listeners = new Set<() => void>();

function apply(b: BrandSettings) {
  if (typeof document === 'undefined') return;
  let tag = document.getElementById('brand') as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'brand';
    document.head.appendChild(tag);
  }
  tag.textContent = brandCss(b);
}

/** Server yuborgan (saqlangan) ko'rinish. */
export function setBrand(raw: unknown) {
  const next = cleanBrand(raw);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* xotira to'la yoki bloklangan */ }
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  shown = next;
  apply(next);
  listeners.forEach((fn) => fn());
}

/** Sozlamada sinab ko'rilayotgan ko'rinish (saqlanmaguncha); null — saqlanganiga qaytadi. */
export function previewBrand(b: BrandSettings | null) {
  const next = b ?? current;
  apply(next);
  if (next === shown) return;
  shown = next;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const useBrand = () => useSyncExternalStore(subscribe, () => current, () => current);
export const brandNow = () => current;
/** Ekrandagi ko'rinish, saqlanmagan sinov ham. */
export const useShownBrand = () => useSyncExternalStore(subscribe, () => shown, () => shown);

/** Menyu bo'limining Ega qo'ygan nomi. */
export const groupLabel = (b: BrandSettings, g: string) => b.groups[g as MenuGroup] || g;

/** Server birinchi renderda chaqiradi, shunda hydration bir xil bo'ladi. */
export function initBrand(b: BrandSettings) {
  if (current === DEFAULT_BRAND || JSON.stringify(current) !== JSON.stringify(b)) {
    current = b;
    shown = b;
  }
}
