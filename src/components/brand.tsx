'use client';

import { useEffect } from 'react';
import { Moon, ShoppingBag, Sun } from 'lucide-react';
import type { BrandSettings } from '@/lib/brand/config';
import { initBrand, setBrand, useBrand } from '@/lib/brand/store';
import { useTheme } from '@/lib/theme';
import { IconButton } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Effects } from '@/components/effects';

/** Egasining logosi yoki standart belgi (asosiy rangdagi dumaloq-kvadrat ichida sumka). */
export function BrandMark({ brand, className }: { brand: BrandSettings; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (brand.logo) return <img src={brand.logo} alt="" className={cn('w-auto object-contain', className)} />;
  return (
    <span className={cn('inline-flex aspect-square items-center justify-center rounded-[28%] bg-primary text-primary-fg shadow-soft', className)} aria-hidden>
      <ShoppingBag className="size-[58%]" strokeWidth={2} />
    </span>
  );
}

/** Logo + nom + shior (kassa Layout Logo). */
export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  const brand = useBrand();
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark brand={brand} className={cn('max-w-[72px] shrink-0', compact ? 'h-7' : 'h-8')} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-semibold tracking-tight text-ink">{brand.name}</span>
        {brand.tagline && <span className={cn('block truncate text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3', compact && 'hidden sm:block')}>{brand.tagline}</span>}
      </span>
    </span>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  return (
    <IconButton label={theme.isDark ? 'Yorugʻ rejim' : 'Qorongʻi rejim'} onClick={theme.toggle} className={className}>
      {theme.isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </IconButton>
  );
}

/** Serverdan kelgan brendni do'konga yuklaydi, effekt kanvasini va ochilish ekranini boshqaradi. */
export function BrandBoot({ brand }: { brand: BrandSettings }) {
  initBrand(brand);
  useEffect(() => {
    setBrand(brand);
  }, [brand]);
  useEffect(() => {
    const el = document.getElementById('splash');
    if (!el) return;
    const t = setTimeout(() => { el.classList.add('sp-out'); setTimeout(() => el.remove(), 400); }, 250);
    return () => clearTimeout(t);
  }, []);
  return <Effects />;
}
