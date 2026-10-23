import type { Metadata } from 'next';
import { parseCatalogParams } from '@/lib/catalog-params';
import { CatalogView } from '@/components/shop/catalog-view';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';

export const metadata: Metadata = { title: 'Qidiruv natijalari', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { params, page } = parseCatalogParams(sp);
  return (
    <>
      <Breadcrumbs items={[{ name: 'Qidiruv' }]} />
      <h1 className="mb-4 text-xl font-extrabold tracking-tight sm:text-2xl">
        {params.q ? <>“{params.q}” bo‘yicha natijalar</> : 'Qidiruv'}
      </h1>
      <CatalogView params={params} page={page} basePath="/search" searchParams={sp} />
    </>
  );
}
