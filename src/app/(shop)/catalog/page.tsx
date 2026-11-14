import { getL } from '@/lib/i18n/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { parseCatalogParams } from '@/lib/catalog-params';
import { getCategoryTree } from '@/lib/data/public';
import { CatalogView } from '@/components/shop/catalog-view';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';

export const metadata: Metadata = { title: 'Katalog', description: 'Barcha mahsulotlar katalogi', alternates: { canonical: '/catalog' } };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const L = await getL();
  const sp = await searchParams;
  const { params, page } = parseCatalogParams(sp);
  const tree = await getCategoryTree();
  return (
    <>
      <Breadcrumbs items={[{ name: L("Katalog") }]} />
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight sm:text-2xl tracking-tight sm:text-3xl">{L("Barcha mahsulotlar")}</h1>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {tree.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} className="shrink-0 rounded-xl bg-surface px-4 py-2 text-sm font-medium shadow-soft hover:text-primary">{c.name}</Link>
        ))}
      </div>
      <CatalogView params={params} page={page} basePath="/catalog" searchParams={sp} />
    </>
  );
}
