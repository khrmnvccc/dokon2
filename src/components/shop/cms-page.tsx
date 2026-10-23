import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPage } from '@/lib/data/public';
import { formatDate } from '@/lib/format';
import { Breadcrumbs } from './breadcrumbs';
import { Markdown } from './markdown';

export async function cmsMetadata(slug: string): Promise<Metadata> {
  const page = await getPage(slug);
  if (!page) return {};
  return {
    title: page.seo_title || page.title,
    description: page.seo_description ?? undefined,
    alternates: { canonical: `/${slug}` },
  };
}

/** Admin paneldagi "Sahifalar" bo'limida tahrirlanadigan kontent */
export async function CmsPageView({ slug, accordion, aside }: { slug: string; accordion?: boolean; aside?: React.ReactNode }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <div>
      <Breadcrumbs items={[{ name: page.title }]} />
      <div className={aside ? 'grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start' : 'mx-auto max-w-3xl'}>
        <article className="rounded-2xl bg-white p-5 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{page.title}</h1>
          <Markdown content={page.content} accordion={accordion} className="mt-4" />
          <p className="mt-8 text-xs text-muted">Yangilangan: {formatDate(page.updated_at)}</p>
        </article>
        {aside}
      </div>
    </div>
  );
}
