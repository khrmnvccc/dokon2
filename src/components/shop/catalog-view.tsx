import { Suspense } from 'react';
import { PackageSearch } from 'lucide-react';
import { getCatalog, getFacets, type CatalogParams } from '@/lib/data/public';
import { PAGE_SIZE } from '@/lib/catalog-params';
import { getT } from '@/lib/i18n/server';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { ProductGrid } from './product-card';
import { CatalogFilters, SortSelect } from './catalog-controls';

export async function CatalogView({ params, page, basePath, searchParams, categorySlug, header }: {
  params: CatalogParams;
  page: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  categorySlug?: string;
  header?: React.ReactNode;
}) {
  const [{ items, total }, facets, t] = await Promise.all([
    getCatalog({ ...params, category: categorySlug ?? params.category }),
    getFacets(categorySlug ?? null),
    getT(),
  ]);

  const makeHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === 'string' && k !== 'page') sp.set(k, v);
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex gap-6">
      <Suspense>
        <CatalogFilters facets={facets} mode="sidebar" />
      </Suspense>
      <div className="min-w-0 flex-1">
        {header}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{t('catalog.found', { n: total })}</p>
          <div className="flex items-center gap-2">
            <Suspense><CatalogFilters facets={facets} mode="mobile" /></Suspense>
            <Suspense><SortSelect /></Suspense>
          </div>
        </div>
        {items.length ? (
          <>
            <ProductGrid products={items} priorityCount={4} />
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} makeHref={makeHref} />
          </>
        ) : (
          <EmptyState icon={<PackageSearch className="h-8 w-8" />} title={t('catalog.empty')} text={t('catalog.emptyText')} />
        )}
      </div>
    </div>
  );
}
