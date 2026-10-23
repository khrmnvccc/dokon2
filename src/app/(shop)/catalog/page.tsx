import type { Metadata } from 'next';
import Link from 'next/link';
import { parseCatalogParams } from '@/lib/catalog-params';
import { getCategoryTree } from '@/lib/data/public';
import { CatalogView } from '@/components/shop/catalog-view';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';

export const metadata: Metadata = { title: 'Katalog', description: 'Barcha mahsulotlar katalogi', alternates: { canonical: '/catalog' } };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { params, page } = parseCatalogParams(sp);
  const tree = await getCategoryTree();
  return (
    <>
      <Breadcrumbs items={[{ name: 'Katalog' }]} />
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Barcha mahsulotlar</h1>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {tree.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-medium shadow-card hover:text-brand">{c.name}</Link>
        ))}
      </div>
      <CatalogView params={params} page={page} basePath="/catalog" searchParams={sp} />
    </>
  );
}
