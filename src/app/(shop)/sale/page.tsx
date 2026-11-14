import { getL } from '@/lib/i18n/server';
import type { Metadata } from 'next';
import Image from 'next/image';
import { parseCatalogParams } from '@/lib/catalog-params';
import { getActivePromotions, getBanners, getPublicCoupons } from '@/lib/data/public';
import { CouponCard } from '@/components/coupon/coupon-card';
import { CopyCoupon } from '@/components/coupon/copy-coupon';
import { couponCardProps } from '@/lib/coupon-design';
import { CatalogView } from '@/components/shop/catalog-view';
import { Breadcrumbs } from '@/components/shop/breadcrumbs';
import { BannerSlide } from '@/components/shop/hero-slider';
import { isUnoptimizable } from '@/components/shop/product-image';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Chegirmalar va aksiyalar', description: 'Eng yaxshi chegirmalar va maxsus aksiyalar', alternates: { canonical: '/sale' } };

export default async function SalePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const L = await getL();
  const sp = await searchParams;
  const { params, page } = parseCatalogParams({ ...sp, discount: '1', sort: typeof sp.sort === 'string' ? sp.sort : 'discount' });
  const [banners, promotions, coupons] = await Promise.all([getBanners('sale_page'), getActivePromotions(), getPublicCoupons()]);

  return (
    <>
      <Breadcrumbs items={[{ name: 'Chegirmalar' }]} />
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight sm:text-2xl tracking-tight sm:text-3xl">{L("Chegirmalar va aksiyalar")}</h1>
      {banners[0] && <div className="mb-6 aspect-[16/6] overflow-hidden rounded-2xl sm:aspect-[16/5]"><BannerSlide banner={banners[0]} priority /></div>}
      {coupons.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[15px] font-semibold tracking-tight">{L("Kuponlar")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coupons.map((c) => (
              <CopyCoupon key={c.id} code={c.code} description={c.description} card={{ ...couponCardProps({ ...c, scope: undefined }, L("Kupon"), L), cutout: 'var(--bg)' }} />
            ))}
          </div>
        </section>
      )}
      {promotions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[15px] font-semibold tracking-tight">{L("Faol aksiyalar")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
                {p.image_url ? (
                  <div className="relative aspect-[16/7]">
                    <Image src={p.image_url} alt={p.title} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover" unoptimized={isUnoptimizable(p.image_url)} />
                  </div>
                ) : (
                  <div className="p-3 pb-0"><CouponCard {...couponCardProps(p, L("Aksiya"), L)} note={p.title} cutout="var(--surface-solid, #fff)" /></div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{p.title}</h3>
                    <span className="rounded-lg bg-primary px-2 py-0.5 text-sm font-semibold text-primary-fg">−{p.discount_type === 'percent' ? `${p.value}%` : `${p.value.toLocaleString('ru-RU')} ${L('so‘m')}`}</span>
                  </div>
                  {p.description && <p className="mt-1 text-sm text-ink-3">{p.description}</p>}
                  {p.ends_at && <p className="mt-2 text-xs text-ink-3">Amal qiladi: {formatDate(p.ends_at)} gacha</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <CatalogView params={params} page={page} basePath="/sale" searchParams={sp} />
    </>
  );
}
