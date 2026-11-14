import { getL } from '@/lib/i18n/server';
import type { Metadata } from 'next';
import { parseCatalogParams } from '@/lib/catalog-params';
import { CatalogView } from '@/components/shop/catalog-view';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';

export const metadata: Metadata = { title: 'Qidiruv natijalari', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const L = await getL();
  const sp = await searchParams;
  const { params, page } = parseCatalogParams(sp);
  return (
    <>
      <Breadcrumbs items={[{ name: L("Qidiruv") }]} />
      <h1 className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl">
        {params.q ? <>“{params.q}” bo‘yicha natijalar</> : L("Qidiruv")}
      </h1>
      <CatalogView params={params} page={page} basePath="/search" searchParams={sp} />
    </>
  );
}
