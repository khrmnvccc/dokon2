import { SITE_URL } from '@/lib/env';
import { getBanners, getCatalog, getCategories, getSettings } from '@/lib/data/public';
import { HeroSlider, BannerSlide } from '@/components/shop/hero-slider';
import { Advantages, CategoryGrid, ProductSection } from '@/components/shop/home-blocks';

export default async function HomePage() {
  const settings = await getSettings();
  const enabled = settings.home_sections.filter((s) => s.enabled);
  const has = (key: string) => enabled.some((s) => s.key === key);
  const title = (key: string, fallback: string) => enabled.find((s) => s.key === key)?.title || fallback;

  // Faqat yoqilgan bloklar uchun ma'lumot so'raladi
  const [hero, middle, promo, categories, bestsellers, fresh, sale, featured] = await Promise.all([
    has('hero') ? getBanners('home_hero') : [],
    has('middle_banner') ? getBanners('home_middle') : [],
    has('promo') ? getBanners('home_promo') : [],
    has('categories') ? getCategories() : [],
    has('bestsellers') ? getCatalog({ sort: 'popular', limit: 10 }) : null,
    has('new') ? getCatalog({ new: true, sort: 'new', limit: 10 }) : null,
    has('sale') ? getCatalog({ discount: true, sort: 'discount', limit: 10 }) : null,
    has('featured') ? getCatalog({ featured: true, limit: 10 }) : null,
  ]);

  const blocks: Record<string, React.ReactNode> = {
    hero: <HeroSlider banners={hero} />,
    categories: <CategoryGrid categories={categories.filter((c) => !c.parent_id && c.show_on_home)} title={title('categories', 'Kategoriyalar')} />,
    bestsellers: bestsellers && <ProductSection title={title('bestsellers', 'Eng ko‘p sotilayotganlar')} products={bestsellers.items} href="/catalog?sort=popular" />,
    new: fresh && <ProductSection title={title('new', 'Yangi kelganlar')} products={fresh.items} href="/catalog?new=1&sort=new" />,
    sale: sale && <ProductSection title={title('sale', 'Chegirmalar')} products={sale.items} href="/sale" />,
    featured: featured && <ProductSection title={title('featured', 'Tavsiya etamiz')} products={featured.items} href="/catalog?featured=1" />,
    promo: promo.length > 0 && (
      <div className="grid gap-3 sm:grid-cols-2">
        {promo.slice(0, 2).map((b) => (
          <div key={b.id} className="aspect-[16/7] overflow-hidden rounded-2xl"><BannerSlide banner={b} /></div>
        ))}
      </div>
    ),
    middle_banner: middle[0] && <div className="aspect-[16/7] overflow-hidden rounded-2xl sm:aspect-[16/5] sm:rounded-3xl"><BannerSlide banner={middle[0]} /></div>,
    advantages: <Advantages items={settings.advantages} title={title('advantages', 'Afzalliklar')} />,
  };

  return (
    <div className="space-y-8 sm:space-y-12">
      <h1 className="sr-only">{settings.seo.title}</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: settings.store.name,
              url: SITE_URL,
              potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: settings.store.name,
              url: SITE_URL,
              logo: settings.store.logo_url ?? undefined,
              sameAs: Object.values(settings.social).filter(Boolean),
              contactPoint: settings.contact.phone ? { '@type': 'ContactPoint', telephone: settings.contact.phone, contactType: 'customer service', areaServed: 'UZ' } : undefined,
            },
          ]).replace(/</g, '\\u003c'),
        }}
      />
      {enabled.map((s) => blocks[s.key] ? <div key={s.key}>{blocks[s.key]}</div> : null)}
    </div>
  );
}
