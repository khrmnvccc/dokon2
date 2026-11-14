import { getL } from '@/lib/i18n/server';
import { SITE_URL } from '@/lib/env';
import { getBanners, getCatalog, getCategories, getReviewStats, getReviewsPage, getSettings } from '@/lib/data/public';
import { HeroSlider, BannerSlide } from '@/components/shop/hero-slider';
import { Advantages, CategoryGrid, ProductSection, ReviewsSection } from '@/components/shop/home-blocks';
import { HomeLayout } from '@/components/shop/site-editor';
import { cn } from '@/components/ui/cn';
import type { SectionSize } from '@/lib/settings-schema';

export default async function HomePage() {
  const L = await getL();
  const settings = await getSettings();
  const enabled = settings.home_sections.filter((s) => s.enabled);
  const has = (key: string) => enabled.some((s) => s.key === key);
  const title = (key: string, fallback: string) => enabled.find((s) => s.key === key)?.title || fallback;
  const size = (key: string): SectionSize => enabled.find((s) => s.key === key)?.size ?? 'md';
  const bannerBox = (z: SectionSize) =>
    z === 'sm' ? 'aspect-[21/8] sm:aspect-[16/4]' : z === 'lg' ? 'aspect-[4/3] sm:aspect-[16/6]' : 'aspect-[16/9] sm:aspect-[16/5]';

  // Faqat yoqilgan bloklar uchun ma'lumot so'raladi
  const [hero, middle, promo, categories, bestsellers, fresh, sale, featured, reviews, reviewStats] = await Promise.all([
    has('hero') ? getBanners('home_hero') : [],
    has('middle_banner') ? getBanners('home_middle') : [],
    has('promo') ? getBanners('home_promo') : [],
    has('categories') ? getCategories() : [],
    has('bestsellers') ? getCatalog({ sort: 'popular', limit: 10 }) : null,
    has('new') ? getCatalog({ new: true, sort: 'new', limit: 10 }) : null,
    has('sale') ? getCatalog({ discount: true, sort: 'discount', limit: 10 }) : null,
    has('featured') ? getCatalog({ featured: true, limit: 10 }) : null,
    has('reviews') ? getReviewsPage(1, 6, true) : null,
    has('reviews') ? getReviewStats() : null,
  ]);

  const blocks: Record<string, React.ReactNode> = {
    hero: <HeroSlider banners={hero} size={size('hero')} />,
    categories: <CategoryGrid categories={categories.filter((c) => !c.parent_id && c.show_on_home)} title={title('categories', L("Kategoriyalar"))} size={size('categories')} />,
    bestsellers: bestsellers && <ProductSection title={title('bestsellers', L("Eng ko‘p sotilayotganlar"))} products={bestsellers.items} href="/catalog?sort=popular" size={size('bestsellers')} />,
    new: fresh && <ProductSection title={title('new', L("Yangi kelganlar"))} products={fresh.items} href="/catalog?new=1&sort=new" size={size('new')} />,
    sale: sale && <ProductSection title={title('sale', 'Chegirmalar')} products={sale.items} href="/sale" size={size('sale')} />,
    featured: featured && <ProductSection title={title('featured', L("Tavsiya etamiz"))} products={featured.items} href="/catalog?featured=1" size={size('featured')} />,
    promo: promo.length > 0 && (
      <div className={cn('grid gap-3', size('promo') !== 'lg' && 'sm:grid-cols-2')}>
        {promo.slice(0, 2).map((b) => (
          <div key={b.id} className={cn('overflow-hidden rounded-[24px] ring-1 ring-black/5', size('promo') === 'sm' ? 'aspect-[21/8]' : size('promo') === 'lg' ? 'aspect-[16/9] sm:aspect-[16/5]' : 'aspect-[16/8]')}><BannerSlide banner={b} compact /></div>
        ))}
      </div>
    ),
    middle_banner: middle[0] && <div className={cn('overflow-hidden rounded-[24px] ring-1 ring-black/5 sm:rounded-[28px]', bannerBox(size('middle_banner')))}><BannerSlide banner={middle[0]} compact={size('middle_banner') === 'sm'} /></div>,
    reviews: reviews && reviewStats && <ReviewsSection title={title('reviews', L("Mijozlar fikri"))} reviews={reviews.items} stats={reviewStats} size={size('reviews')} />,
    advantages: <Advantages items={settings.advantages} title={title('advantages', 'Afzalliklar')} size={size('advantages')} />,
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      <h1 className="sr-only">{settings.seo.title}</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: settings.brand.name,
              url: SITE_URL,
              potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: settings.brand.name,
              url: SITE_URL,
              logo: settings.store.logo_url ?? undefined,
              sameAs: Object.values(settings.social).filter(Boolean),
              contactPoint: settings.contact.phone ? { '@type': 'ContactPoint', telephone: settings.contact.phone, contactType: 'customer service', areaServed: 'UZ' } : undefined,
            },
          ]).replace(/</g, '\\u003c'),
        }}
      />
      <HomeLayout sections={settings.home_sections} blocks={blocks} />
    </div>
  );
}
