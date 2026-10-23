import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseCatalogParams } from '@/lib/catalog-params';
import { buildTree, getBanners, getCategories } from '@/lib/data/public';
import { CatalogView } from '@/components/shop/catalog-view';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { BannerSlide } from '@/components/shop/hero-slider';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function findCategory(slug: string) {
  const all = await getCategories();
  const category = all.find((c) => c.slug === slug);
  if (!category) return null;
  const chain = [];
  let cur: typeof category | undefined = category;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent_id ? all.find((c) => c.id === cur!.parent_id) : undefined;
  }
  const node = (function find(nodes: ReturnType<typeof buildTree>): ReturnType<typeof buildTree>[number] | undefined {
    for (const n of nodes) {
      if (n.id === category.id) return n;
      const f = find(n.children);
      if (f) return f;
    }
  })(buildTree(all));
  return { category, chain, children: node?.children ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await findCategory(slug);
  if (!found) return { title: 'Kategoriya topilmadi' };
  const { category } = found;
  return {
    title: category.seo_title || category.name,
    description: category.seo_description || category.description || `${category.name} — qulay narxlarda xarid qiling`,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: { images: category.image_url ? [category.image_url] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const found = await findCategory(slug);
  if (!found) notFound();
  const { category, chain, children } = found;
  const { params: catalogParams, page } = parseCatalogParams(sp);
  const banners = (await getBanners('catalog_top')).slice(0, 1);

  return (
    <>
      <Breadcrumbs items={[{ name: 'Katalog', href: '/catalog' }, ...chain.map((c) => ({ name: c.name, href: `/category/${c.slug}` }))]} />
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{category.name}</h1>
      {category.description && <p className="mb-4 max-w-3xl text-sm text-muted">{category.description}</p>}
      {children.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {children.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-medium shadow-card hover:text-brand">{c.name}</Link>
          ))}
        </div>
      )}
      {banners[0] && <div className="mb-5 aspect-[16/5] overflow-hidden rounded-2xl"><BannerSlide banner={banners[0]} /></div>}
      <CatalogView params={catalogParams} page={page} basePath={`/category/${category.slug}`} searchParams={sp} categorySlug={category.slug} />
    </>
  );
}
