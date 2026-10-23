'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Plus } from 'lucide-react';
import { categorySchema } from '@/lib/admin/schemas';
import { slugify } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/misc';
import { DynamicIcon, ICONS } from '@/components/shop/dynamic-icon';
import { MoveButtons, RowActions, Toggle, useCrud } from './crud-kit';
import { SingleImageField } from './upload';
import type { Category } from '@/lib/types';

type In = z.input<typeof categorySchema>;
type Out = z.output<typeof categorySchema>;

export function CategoriesManager({ categories, productCount }: { categories: Category[]; productCount: Record<string, number> }) {
  const crud = useCrud('categories');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const roots = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);

  const Row = ({ c, list, index, depth }: { c: Category; list: Category[]; index: number; depth: number }) => (
    <>
      <li className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0" style={{ paddingLeft: 16 + depth * 28 }}>
        <MoveButtons list={list} index={index} onReorder={crud.reorder} />
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><DynamicIcon name={c.icon} className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{c.name} {c.show_on_home && depth === 0 && <Badge tone="brand" className="ml-1">Bosh sahifada</Badge>}</p>
          <p className="text-xs text-muted">/{c.slug} · {productCount[c.id] ?? 0} ta mahsulot</p>
        </div>
        <Toggle checked={c.is_active} label="Faol" onChange={(v) => crud.toggle(c.id, v)} disabled={crud.pending} />
        <RowActions onEdit={() => setEditing(c)} onDelete={() => crud.remove(c.id, `“${c.name}” kategoriyasini o‘chirish?`)} />
      </li>
      {childrenOf(c.id).map((ch, i, arr) => <Row key={ch.id} c={ch} list={arr} index={i} depth={depth + 1} />)}
    </>
  );

  return (
    <div>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Kategoriya qo‘shish</Button></div>
      <ul className="overflow-hidden rounded-xl border border-line bg-white">
        {roots.length === 0 && <li className="p-10 text-center text-muted">Kategoriyalar yo‘q</li>}
        {roots.map((c, i) => <Row key={c.id} c={c} list={roots} index={i} depth={0} />)}
      </ul>
      <p className="mt-2 text-xs text-muted">O‘chirilgan kategoriyadagi mahsulotlar “kategoriyasiz” bo‘lib qoladi, ichki kategoriyalar yuqori darajaga ko‘tariladi.</p>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Yangi kategoriya' : 'Kategoriyani tahrirlash'} className="max-w-2xl">
        {editing !== null && (
          <CategoryForm category={editing === 'new' ? null : editing} categories={categories} onDone={() => setEditing(null)} save={crud.save} />
        )}
      </Modal>
    </div>
  );
}

function CategoryForm({ category, categories, onDone, save }: { category: Category | null; categories: Category[]; onDone: () => void; save: ReturnType<typeof useCrud>['save'] }) {
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const { register, handleSubmit, control, setValue, setError, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? { ...category, parent_id: category.parent_id ?? '', description: category.description ?? '', icon: category.icon ?? '', seo_title: category.seo_title ?? '', seo_description: category.seo_description ?? '' }
      : { name: '', slug: '', parent_id: '', sort_order: (categories.length + 1) * 10, is_active: true, show_on_home: true, icon: '' },
  });
  // O'zini yoki o'z avlodini ota qilib tanlab bo'lmaydi
  const descendants = new Set<string>();
  if (category) {
    const walk = (id: string) => { descendants.add(id); categories.filter((c) => c.parent_id === id).forEach((c) => walk(c.id)); };
    walk(category.id);
  }
  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (d) => { if (await save(category?.id ?? null, d, setError)) onDone(); })}>
      <Field label="Nomi" required error={errors.name?.message} htmlFor="c-name">
        <Input id="c-name" {...register('name', { onChange: (e) => !slugTouched && setValue('slug', slugify(e.target.value)) })} />
      </Field>
      <Field label="Slug" required error={errors.slug?.message} htmlFor="c-slug"><Input id="c-slug" {...register('slug', { onChange: () => setSlugTouched(true) })} /></Field>
      <Field label="Ota kategoriya" htmlFor="c-parent">
        <Select id="c-parent" {...register('parent_id')}>
          <option value="">— Yuqori daraja —</option>
          {categories.filter((c) => !descendants.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Ikonka" htmlFor="c-icon">
        <Select id="c-icon" {...register('icon')}>
          <option value="">—</option>
          {Object.keys(ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Field>
      <Field label="Tavsif" className="sm:col-span-2" htmlFor="c-desc"><Textarea id="c-desc" rows={2} {...register('description')} /></Field>
      <div className="sm:col-span-2">
        <Controller control={control} name="image_url" render={({ field }) => (
          <SingleImageField label="Rasm" folder="categories" value={(field.value as string) || null} onChange={(v) => field.onChange(v ?? '')} />
        )} />
      </div>
      <Field label="SEO sarlavha" htmlFor="c-seo"><Input id="c-seo" {...register('seo_title')} /></Field>
      <Field label="SEO tavsif" htmlFor="c-seod"><Input id="c-seod" {...register('seo_description')} /></Field>
      <div className="flex flex-wrap gap-5 sm:col-span-2">
        <Checkbox label="Faol" {...register('is_active')} />
        <Checkbox label="Bosh sahifada ko‘rsatish" {...register('show_on_home')} />
      </div>
      <input type="hidden" {...register('sort_order')} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" loading={isSubmitting}>Saqlash</Button>
      </div>
    </form>
  );
}
