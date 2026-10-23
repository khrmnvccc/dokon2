'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Select } from '@/components/ui/field';
import { cn } from '@/components/ui/cn';
import type { TKey } from '@/lib/i18n/dict';

export interface Facets { min_price: number | null; max_price: number | null; colors: { name: string; hex: string | null }[]; sizes: string[] }

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

export function SortSelect() {
  const { t } = useApp();
  const params = useSearchParams();
  const update = useQueryUpdater();
  const sorts = ['popular', 'price_asc', 'price_desc', 'new', 'rating', 'discount'] as const;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Saralash</span>
      <Select value={params.get('sort') ?? 'popular'} onChange={(e) => update({ sort: e.target.value === 'popular' ? null : e.target.value })} className="h-10 w-auto min-w-44 text-sm">
        {sorts.map((s) => <option key={s} value={s}>{t(`sort.${s}` as TKey)}</option>)}
      </Select>
    </label>
  );
}

function FilterBody({ facets, onDone }: { facets: Facets; onDone?: () => void }) {
  const { t } = useApp();
  const params = useSearchParams();
  const update = useQueryUpdater();
  const [min, setMin] = useState(params.get('min') ?? '');
  const [max, setMax] = useState(params.get('max') ?? '');
  const colors = (params.get('color') ?? '').split(',').filter(Boolean);
  const sizes = (params.get('size') ?? '').split(',').filter(Boolean);
  const toggleList = (key: 'color' | 'size', current: string[], value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.join(',') || null });
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-bold">{t('filters.price')}</legend>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ min: min.replace(/\D/g, '') || null, max: max.replace(/\D/g, '') || null });
            onDone?.();
          }}
        >
          <Input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder={facets.min_price ? String(facets.min_price) : t('filters.from')} aria-label="Minimal narx" className="h-10" />
          <span className="text-muted">—</span>
          <Input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder={facets.max_price ? String(facets.max_price) : t('filters.to')} aria-label="Maksimal narx" className="h-10" />
          <Button type="submit" size="sm" variant="secondary" className="h-10">OK</Button>
        </form>
      </fieldset>

      <div className="space-y-3">
        <Checkbox label={t('filters.discount')} checked={params.get('discount') === '1'} onChange={(e) => update({ discount: e.target.checked ? '1' : null })} />
        <Checkbox label={t('filters.inStock')} checked={params.get('stock') === '1'} onChange={(e) => update({ stock: e.target.checked ? '1' : null })} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-bold">{t('filters.rating')}</legend>
        <div className="flex flex-wrap gap-2">
          {['4', '3'].map((r) => (
            <button key={r} type="button" onClick={() => update({ rating: params.get('rating') === r ? null : r })}
              className={cn('rounded-lg border px-3 py-1.5 text-sm', params.get('rating') === r ? 'border-brand bg-brand-50 font-semibold text-brand-700' : 'border-line')}>
              ★ {r}+
            </button>
          ))}
        </div>
      </fieldset>

      {facets.colors.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold">{t('filters.color')}</legend>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c) => (
              <button key={c.name} type="button" onClick={() => toggleList('color', colors, c.name)} aria-pressed={colors.includes(c.name)}
                className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm', colors.includes(c.name) ? 'border-brand bg-brand-50 font-semibold' : 'border-line')}>
                <span className="h-4 w-4 rounded-full border border-slate-300" style={{ background: c.hex ?? '#ccc' }} />{c.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {facets.sizes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold">{t('filters.size')}</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button key={s} type="button" onClick={() => toggleList('size', sizes, s)} aria-pressed={sizes.includes(s)}
                className={cn('min-w-11 rounded-lg border px-2.5 py-1.5 text-sm', sizes.includes(s) ? 'border-brand bg-brand-50 font-semibold' : 'border-line')}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <Button variant="outline" className="w-full" onClick={() => { update({ min: null, max: null, discount: null, stock: null, rating: null, color: null, size: null }); setMin(''); setMax(''); onDone?.(); }}>
        {t('filters.reset')}
      </Button>
    </div>
  );
}

export function CatalogFilters({ facets, mode }: { facets: Facets; mode: 'sidebar' | 'mobile' }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  if (mode === 'sidebar') {
    return (
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-40 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 text-base font-bold">{t('filters.title')}</h2>
          <FilterBody facets={facets} />
        </div>
      </aside>
    );
  }
  return (
    <>
      <Button variant="outline" size="sm" className="h-10 lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-4 w-4" /> {t('filters.title')}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('filters.title')}>
          <div className="absolute inset-0 bg-slate-900/50 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t('filters.title')}</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Yopish"><X className="h-5 w-5" /></button>
            </div>
            <FilterBody facets={facets} onDone={() => setOpen(false)} />
            <Button className="mt-3 w-full" onClick={() => setOpen(false)}>{t('filters.apply')}</Button>
          </div>
        </div>
      )}
    </>
  );
}
