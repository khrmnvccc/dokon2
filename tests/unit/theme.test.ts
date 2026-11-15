import { describe, expect, it } from 'vitest';
import { cleanBrand } from '@/lib/brand/config';
import { themeBoot } from '@/lib/theme-boot';

function run(script: string, opts: { path?: string; stored?: string | null; systemDark?: boolean }) {
  const classes = new Set<string>();
  const dataset: Record<string, string> = {};
  const html = { dataset, classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) } };
  const fn = new Function('document', 'location', 'localStorage', 'matchMedia', script);
  fn({ documentElement: html }, { pathname: opts.path ?? '/' }, { getItem: () => opts.stored ?? null }, () => ({ matches: !!opts.systemDark }));
  return { dark: classes.has('dark'), dataset };
}

describe('standart rejim (hamma uchun)', () => {
  it('cleanBrand: notoʻgʻri qiymat — telefon boʻyicha, qulfsiz', () => {
    expect(cleanBrand({ theme: 'blue', themeLock: 'yes' })).toMatchObject({ theme: 'system', themeLock: false });
    expect(cleanBrand({ theme: 'dark', themeLock: true })).toMatchObject({ theme: 'dark', themeLock: true });
  });
  it('mijoz tanlamagan boʻlsa — egasining standarti', () => {
    expect(run(themeBoot('dark'), {}).dark).toBe(true);
    expect(run(themeBoot('light'), { systemDark: true }).dark).toBe(false);
    expect(run(themeBoot('system'), { systemDark: true }).dark).toBe(true);
  });
  it('mijozning oʻz tanlovi ustun, qulflangan boʻlsa — yoʻq', () => {
    expect(run(themeBoot('dark'), { stored: 'light' }).dark).toBe(false);
    const locked = run(themeBoot('dark', true), { stored: 'light' });
    expect(locked.dark).toBe(true);
    expect(locked.dataset.themeLock).toBe('1');
  });
  it('admin panelda qulf ishlamaydi', () => {
    expect(run(themeBoot('dark', true), { stored: 'light', path: '/admin/orders' }).dark).toBe(false);
  });
});
