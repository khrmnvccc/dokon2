import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCatalog, getCategories, getProduct, getProductReviews, getSettings } from '@/lib/data/public';
import { SITE_URL } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { ProductGallery } from '@/components/shop/product-gallery';
import { ProductPurchase } from '@/components/shop/product-purchase';
import { ProductSection } from '@/components/shop/home-blocks';
import { Markdown } from '@/components/shop/markdown';
import { ReviewForm } from '@/components/shop/reviews';
import { Rating, Stars } from '@/components/ui/misc';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) return { title: 'Mahsulot topilmadi' };
  const { product, images } = data;
  const description = product.seo_description || product.short_description || product.description?.slice(0, 160) || product.name;
  return {
    title: product.seo_title || product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { type: 'website', title: product.name, description, images: images[0]?.url && !images[0].url.endsWith('.svg') ? [images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) notFound();
  const { product, images, variants } = data;
  const [categories, reviews, settings] = await Promise.all([getCategories(), getProductReviews(product.id), getSettings()]);

  const chain = [];
  let cur = categories.find((c) => c.id === product.category_id);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent_id ? categories.find((c) => c.id === cur!.parent_id) : undefined;
  }
  const category = chain[chain.length - 1];
  const related = category ? (await getCatalog({ category: category.slug, limit: 11 })).items.filter((p) => p.id !== product.id).slice(0, 10) : [];

  const inStock = product.has_variants ? variants.some((v) => v.stock > 0) : !product.track_stock || product.stock > 0;
  const lowestPrice = variants.length ? Math.min(...variants.map((v) => v.price ?? product.price)) : product.price;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_description ?? product.description ?? undefined,
    sku: product.sku ?? undefined,
    gtin13: product.barcode && /^\d{13}$/.test(product.barcode) ? product.barcode : undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    image: images.map((i) => (i.url.startsWith('http') ? i.url : `${SITE_URL}${i.url}`)),
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/product/${product.slug}`,
      priceCurrency: settings.localization.currency,
      price: lowestPrice,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    aggregateRating: product.rating_count > 0 ? { '@type': 'AggregateRating', ratingValue: Number(product.rating_avg), reviewCount: product.rating_count } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Breadcrumbs items={[{ name: 'Katalog', href: '/catalog' }, ...chain.map((c) => ({ name: c.name, href: `/category/${c.slug}` })), { name: product.name }]} />

      <div className="grid gap-6 rounded-3xl bg-white p-4 shadow-card sm:p-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <ProductGallery images={images} name={product.name} />
        <div>
          {product.brand && <div className="text-sm font-semibold text-brand">{product.brand}</div>}
          <h1 className="mt-1 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            <Rating value={Number(product.rating_avg)} count={product.rating_count} size="md" />
            {product.sku && <span>Kod: {product.sku}</span>}
            {(product.sold_count ?? 0) > 0 && <span>{product.sold_count} marta sotib olingan</span>}
          </div>
          {product.short_description && <p className="mt-3 text-sm text-slate-600">{product.short_description}</p>}
          <div className="mt-5">
            <ProductPurchase
              product={{ id: product.id, name: product.name, price: product.price, compare_at_price: product.compare_at_price, stock: product.stock, track_stock: product.track_stock, has_variants: product.has_variants }}
              variants={variants}
              freeShippingFrom={settings.checkout.free_shipping_threshold}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-3xl bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-lg font-bold">Tavsif</h2>
          {product.description ? <Markdown content={product.description} className="mt-2" /> : <p className="mt-2 text-sm text-muted">Tavsif qo‘shilmagan.</p>}
        </section>
        {product.attributes?.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-bold">Xususiyatlar</h2>
            <dl className="mt-3 divide-y divide-line text-sm">
              {product.attributes.map((a) => (
                <div key={a.name} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{a.name}</dt>
                  <dd className="text-right font-medium">{a.value}</dd>
                </div>
              ))}
              {product.weight_grams ? <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">Og‘irligi</dt><dd className="font-medium">{product.weight_grams} g</dd></div> : null}
            </dl>
          </section>
        )}
      </div>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-card sm:p-6" id="reviews">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Sharhlar <span className="text-muted">({product.rating_count})</span></h2>
          {product.rating_count > 0 && <div className="flex items-center gap-2"><Stars value={Number(product.rating_avg)} /><span className="font-bold">{Number(product.rating_avg).toFixed(1)}</span></div>}
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {reviews.length ? reviews.map((r) => (
              <article key={r.id} className="border-b border-line pb-4 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{r.author_name ?? 'Xaridor'}</span>
                  <time className="text-xs text-muted">{formatDate(r.created_at)}</time>
                </div>
                <Stars value={r.rating} className="mt-1" />
                {r.body && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.body}</p>}
              </article>
            )) : <p className="text-sm text-muted">Hali sharhlar yo‘q. Birinchi bo‘lib fikr bildiring!</p>}
          </div>
          <ReviewForm productId={product.id} slug={product.slug} />
        </div>
      </section>

      {related.length > 0 && <div className="mt-8"><ProductSection title="O‘xshash mahsulotlar" products={related} href={`/category/${category!.slug}`} /></div>}
    </>
  );
}
