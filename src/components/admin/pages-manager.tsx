'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ExternalLink, Plus } from 'lucide-react';
import { pageSchema } from '@/lib/admin/schemas';
import { markdownToHtml } from '@/lib/markdown';
import { formatDateTime, slugify } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/dialog';
import { cn } from '@/components/ui/cn';
import { RowActions, Toggle, useCrud } from './crud-kit';
import { Table } from './ui';
import type { CmsPage } from '@/lib/types';

// Bu sahifalarning sayt manzillari kodda belgilangan, slug'ini o'zgartirmaslik kerak
const BUILTIN = ['about', 'delivery', 'contact', 'faq', 'privacy', 'terms'];

type In = z.input<typeof pageSchema>;
type Out = z.output<typeof pageSchema>;

export function PagesManager({ pages }: { pages: CmsPage[] }) {
  const crud = useCrud('pages');
  const [editing, setEditing] = useState<CmsPage | 'new' | null>(null);
  return (
    <div>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Sahifa</Button></div>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <Table>
          <thead><tr><th>Sarlavha</th><th>Manzil</th><th>Yangilangan</th><th>Chop etilgan</th><th /></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.title}</td>
                <td>{BUILTIN.includes(p.slug) ? <Link href={`/${p.slug}`} target="_blank" className="inline-flex items-center gap-1 text-brand">/{p.slug} <ExternalLink className="h-3 w-3" /></Link> : <span className="text-muted">/{p.slug} (menyuga havola qo‘shing)</span>}</td>
                <td className="text-muted">{formatDateTime(p.updated_at)}</td>
                <td><Toggle checked={p.is_published} label="Chop etilgan" onChange={(v) => crud.toggle(p.id, v, 'is_published')} /></td>
                <td><RowActions onEdit={() => setEditing(p)} onDelete={BUILTIN.includes(p.slug) ? undefined : () => crud.remove(p.id)} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Yangi sahifa' : 'Sahifani tahrirlash'} className="max-w-5xl">
        {editing !== null && <PageForm page={editing === 'new' ? null : editing} onDone={() => setEditing(null)} save={crud.save} />}
      </Modal>
    </div>
  );
}

function PageForm({ page, onDone, save }: { page: CmsPage | null; onDone: () => void; save: ReturnType<typeof useCrud>['save'] }) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const builtin = page ? BUILTIN.includes(page.slug) : false;
  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({
    resolver: zodResolver(pageSchema),
    defaultValues: page ? { ...page, seo_title: page.seo_title ?? '', seo_description: page.seo_description ?? '' } : { slug: '', title: '', content: '', is_published: true },
  });
  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (d) => { if (await save(page?.id ?? null, d, setError)) onDone(); })}>
      <Field label="Sarlavha" required error={errors.title?.message} htmlFor="p-title"><Input id="p-title" {...register('title', { onChange: (e) => !page && setValue('slug', slugify(e.target.value)) })} /></Field>
      <Field label="Slug" required error={errors.slug?.message} htmlFor="p-slug" hint={builtin ? 'Asosiy sahifa — slug o‘zgarmaydi' : undefined}><Input id="p-slug" readOnly={builtin} {...register('slug')} /></Field>
      <div className="sm:col-span-2">
        <div className="mb-2 flex gap-1">
          {(['edit', 'preview'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-slate-900 text-white' : 'text-muted hover:bg-slate-100')}>
              {t === 'edit' ? 'Matn (Markdown)' : 'Ko‘rinish'}
            </button>
          ))}
        </div>
        {tab === 'edit' ? (
          <Textarea rows={16} className="font-mono text-sm" aria-label="Kontent" {...register('content')} />
        ) : (
          <div className="prose-dk max-h-[420px] overflow-auto rounded-xl border border-line p-4" dangerouslySetInnerHTML={{ __html: markdownToHtml(watch('content') ?? '') }} />
        )}
        <p className="mt-1 text-xs text-muted">## Sarlavha, ### Kichik sarlavha (FAQ’da savol), - ro‘yxat, **qalin**, [havola](/catalog)</p>
      </div>
      <Field label="SEO sarlavha" htmlFor="p-seo"><Input id="p-seo" {...register('seo_title')} /></Field>
      <Field label="SEO tavsif" htmlFor="p-seod"><Input id="p-seod" {...register('seo_description')} /></Field>
      <Checkbox label="Chop etilgan" {...register('is_published')} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" loading={isSubmitting}>Saqlash</Button>
      </div>
    </form>
  );
}
