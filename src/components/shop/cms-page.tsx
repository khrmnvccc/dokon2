import { getL } from '@/lib/i18n/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPage } from '@/lib/data/public';
import { formatDate } from '@/lib/format';
import { Breadcrumbs } from './breadcrumbs';
import { Markdown } from './markdown';
import { PageEditButton } from './page-editor';
import { SizeBlock } from './size-block';

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
  const [page, L] = await Promise.all([getPage(slug), getL()]);
  if (!page) notFound();
  return (
    <div>
      <Breadcrumbs items={[{ name: page.title }]} />
      <div className={aside ? 'grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start' : 'mx-auto max-w-3xl'}>
        <SizeBlock id={`page.${slug}`} label="Matn">
        <article className="relative rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-8">
          <PageEditButton slug={slug} faq={accordion} />
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl sm:text-3xl">{page.title}</h1>
          <Markdown content={page.content} accordion={accordion} className="mt-4" />
          <p className="mt-8 text-xs text-ink-3">{L('Yangilangan:')} {formatDate(page.updated_at)}</p>
        </article>
        </SizeBlock>
        {aside}
      </div>
    </div>
  );
}
