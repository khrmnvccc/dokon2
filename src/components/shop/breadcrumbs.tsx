import { getL } from '@/lib/i18n/server';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_URL } from '@/lib/env';

export async function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  const L = await getL();
  const all = [{ name: L("Bosh sahifa"), href: '/' }, ...items];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.href ? `${SITE_URL}${it.href}` : undefined })),
  };
  return (
    <nav aria-label={L("Navigatsiya yo‘li")} className="mb-3 overflow-hidden">
      <ol className="no-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-ink-3 sm:text-sm">
        {all.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            {it.href && i < all.length - 1 ? <Link href={it.href} className="hover:text-primary">{it.name}</Link> : <span className="text-ink" aria-current="page">{it.name}</span>}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </nav>
  );
}
