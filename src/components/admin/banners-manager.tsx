'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Plus } from 'lucide-react';
import { bannerSchema } from '@/lib/admin/schemas';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/misc';
import { MoveButtons, RowActions, toLocalInput, Toggle, useCrud } from './crud-kit';
import { SingleImageField } from './upload';
import { Panel } from './ui';
import type { Banner } from '@/lib/types';

export const PLACEMENTS: Record<Banner['placement'], string> = {
  home_hero: 'Bosh sahifa — asosiy slayder',
  home_middle: 'Bosh sahifa — o‘rta banner',
  home_promo: 'Bosh sahifa — aksiya bloki',
  catalog_top: 'Katalog — yuqori',
  sale_page: 'Aksiyalar sahifasi',
};

type In = z.input<typeof bannerSchema>;
type Out = z.output<typeof bannerSchema>;

function scheduleState(b: Banner) {
  const now = Date.now();
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return { tone: 'amber' as const, text: `${formatDateTime(b.starts_at)} dan` };
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return { tone: 'gray' as const, text: 'Muddati tugagan' };
  return null;
}

export function BannersManager({ banners }: { banners: Banner[] }) {
  const crud = useCrud('banners');
  const [editing, setEditing] = useState<Banner | Banner['placement'] | null>(null);
  return (
    <div className="space-y-4">
      {(Object.keys(PLACEMENTS) as Banner['placement'][]).map((pl) => {
        const list = banners.filter((b) => b.placement === pl);
        return (
          <Panel key={pl} title={PLACEMENTS[pl]} padded={false} actions={<Button size="sm" variant="secondary" onClick={() => setEditing(pl)}><Plus className="h-4 w-4" /> Qo‘shish</Button>}>
            {list.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Banner yo‘q</p> : (
              <ul>
                {list.map((b, i) => {
                  const st = scheduleState(b);
                  return (
                    <li key={b.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                      <MoveButtons list={list} index={i} onReorder={crud.reorder} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image_url} alt="" className="h-14 w-28 shrink-0 rounded-lg object-cover" style={{ background: b.bg_color ?? undefined }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{b.title || 'Sarlavhasiz'}</p>
                        <p className="truncate text-xs text-muted">{b.link_url ?? 'havola yo‘q'}</p>
                        {st && <Badge tone={st.tone} className="mt-1">{st.text}</Badge>}
                      </div>
                      <Toggle checked={b.is_active} label="Faol" onChange={(v) => crud.toggle(b.id, v)} disabled={crud.pending} />
                      <RowActions onEdit={() => setEditing(b)} onDelete={() => crud.remove(b.id, 'Bannerni o‘chirish?')} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        );
      })}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={typeof editing === 'string' ? 'Yangi banner' : 'Bannerni tahrirlash'} className="max-w-2xl">
        {editing !== null && (
          <BannerForm banner={typeof editing === 'string' ? null : editing} placement={typeof editing === 'string' ? editing : editing.placement}
            count={banners.length} onDone={() => setEditing(null)} save={crud.save} />
        )}
      </Modal>
    </div>
  );
}

function BannerForm({ banner, placement, count, onDone, save }: { banner: Banner | null; placement: Banner['placement']; count: number; onDone: () => void; save: ReturnType<typeof useCrud>['save'] }) {
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<In, unknown, Out>({
    resolver: zodResolver(bannerSchema),
    defaultValues: banner
      ? { ...banner, title: banner.title ?? '', subtitle: banner.subtitle ?? '', button_text: banner.button_text ?? '', link_url: banner.link_url ?? '',
          bg_color: banner.bg_color ?? '', text_color: banner.text_color ?? '', starts_at: toLocalInput(banner.starts_at), ends_at: toLocalInput(banner.ends_at) }
      : { placement, image_url: '', is_active: true, sort_order: count * 10, bg_color: '', text_color: '#ffffff', starts_at: '', ends_at: '' },
  });
  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (d) => { if (await save(banner?.id ?? null, d, setError)) onDone(); })}>
      <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
        <Controller control={control} name="image_url" render={({ field }) => (
          <div>
            <SingleImageField label="Rasm (kompyuter)" folder="banners" aspect="aspect-[16/7]" value={(field.value as string) || null} onChange={(v) => field.onChange(v ?? '')} />
            {errors.image_url && <p className="mt-1 text-xs text-red-600">{errors.image_url.message}</p>}
          </div>
        )} />
        <Controller control={control} name="mobile_image_url" render={({ field }) => (
          <SingleImageField label="Rasm (telefon, ixtiyoriy)" folder="banners" aspect="aspect-[4/3]" value={(field.value as string) || null} onChange={(v) => field.onChange(v ?? '')} />
        )} />
      </div>
      <Field label="Joylashuv" htmlFor="b-pl">
        <Select id="b-pl" {...register('placement')}>{Object.entries(PLACEMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </Field>
      <Field label="Havola" hint="/catalog yoki /category/smartfonlar" error={errors.link_url?.message} htmlFor="b-link"><Input id="b-link" {...register('link_url')} /></Field>
      <Field label="Sarlavha" htmlFor="b-title"><Input id="b-title" {...register('title')} /></Field>
      <Field label="Qo‘shimcha matn" htmlFor="b-sub"><Input id="b-sub" {...register('subtitle')} /></Field>
      <Field label="Tugma matni" htmlFor="b-btn"><Input id="b-btn" {...register('button_text')} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fon rangi" error={errors.bg_color?.message} htmlFor="b-bg"><Input id="b-bg" placeholder="#0e7c66" {...register('bg_color')} /></Field>
        <Field label="Matn rangi" error={errors.text_color?.message} htmlFor="b-tc"><Input id="b-tc" placeholder="#ffffff" {...register('text_color')} /></Field>
      </div>
      <Field label="Boshlanish" hint="Bo‘sh — darhol" htmlFor="b-start"><Input id="b-start" type="datetime-local" {...register('starts_at')} /></Field>
      <Field label="Tugash" hint="Bo‘sh — muddatsiz" error={errors.ends_at?.message} htmlFor="b-end"><Input id="b-end" type="datetime-local" {...register('ends_at')} /></Field>
      <Checkbox label="Faol" {...register('is_active')} />
      <input type="hidden" {...register('sort_order')} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" loading={isSubmitting}>Saqlash</Button>
      </div>
    </form>
  );
}
