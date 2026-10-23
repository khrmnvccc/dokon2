'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Star, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/components/ui/cn';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const MAX = 5 * 1024 * 1024;

export interface UploadedImage { url: string; storage_path: string }

/** Rasmni Supabase Storage'ga yuklash. Ruxsat (media.write) storage siyosatida tekshiriladi. */
export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  if (!ALLOWED.includes(file.type)) throw new Error('Faqat JPG, PNG, WEBP, AVIF yoki GIF rasm');
  if (file.size > MAX) throw new Error('Rasm hajmi 5 MB dan oshmasin');
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const supabase = getBrowserSupabase();
  const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message.includes('row-level security') ? 'Rasm yuklash uchun ruxsat yo‘q' : 'Rasmni yuklab bo‘lmadi');
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return { url: data.publicUrl, storage_path: path };
}

function Preview({ src, alt }: { src: string; alt: string }) {
  // Admin oldindan ko'rish: optimallashtirishsiz oddiy img
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />;
}

/** Bitta rasm maydoni (kategoriya, banner, logo) */
export function SingleImageField({ value, onChange, folder, label, aspect = 'aspect-square' }: { value: string | null; onChange: (url: string | null) => void; folder: string; label: string; aspect?: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      <div className={cn('relative w-full max-w-xs overflow-hidden rounded-xl border-2 border-dashed border-line bg-slate-50', aspect)}>
        {value ? <Preview src={value} alt={label} /> : (
          <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm text-muted hover:text-brand">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />} Rasm yuklash
          </button>
        )}
        {value && (
          <div className="absolute right-2 top-2 flex gap-1">
            <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium shadow">Almashtirish</button>
            <button type="button" onClick={() => onChange(null)} className="rounded-lg bg-white/90 p-1 text-red-600 shadow" aria-label="Olib tashlash"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept={ALLOWED.join(',')} className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        try {
          onChange((await uploadImage(file, folder)).url);
        } catch (err) {
          toast((err as Error).message, 'error');
        } finally {
          setBusy(false);
        }
      }} />
      <p className="mt-1 text-xs text-muted">JPG/PNG/WEBP, 5 MB gacha. Yoki URL: </p>
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} placeholder="https://… yoki /demo/…" className="mt-1 h-9 w-full max-w-xs rounded-lg border border-line px-2 text-xs" />
    </div>
  );
}

export interface GalleryImage { id?: string; url: string; storage_path: string | null; alt: string | null; is_primary: boolean }

/** Mahsulot galereyasi: bir nechta rasm, asosiy rasm, tartib */
export function GalleryField({ images, onChange }: { images: GalleryImage[]; onChange: (images: GalleryImage[]) => void }) {
  const [busy, setBusy] = useState(0);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const move = (i: number, d: number) => {
    const next = [...images];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {images.map((img, i) => (
          <li key={img.id ?? img.url} className={cn('group relative aspect-square overflow-hidden rounded-xl border-2', img.is_primary ? 'border-brand' : 'border-line')}>
            <Preview src={img.url} alt={img.alt ?? ''} />
            {img.is_primary && <span className="absolute left-1.5 top-1.5 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">Asosiy</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="rounded bg-white/90 p-1" aria-label="Chapga"><ArrowLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} className="rounded bg-white/90 p-1" aria-label="O‘ngga"><ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => onChange(images.map((x, k) => ({ ...x, is_primary: k === i })))} className="rounded bg-white/90 p-1" aria-label="Asosiy qilish"><Star className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => { const next = images.filter((_, k) => k !== i); if (img.is_primary && next[0]) next[0] = { ...next[0], is_primary: true }; onChange(next); }} className="rounded bg-white/90 p-1 text-red-600" aria-label="O‘chirish"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </li>
        ))}
        {images.length < 15 && (
          <li>
            <button type="button" onClick={() => input.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-sm text-muted hover:border-brand hover:text-brand">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
              {busy ? `${busy} ta yuklanmoqda` : 'Rasm qo‘shish'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" multiple accept={ALLOWED.join(',')} className="hidden" onChange={async (e) => {
        const files = Array.from(e.target.files ?? []).slice(0, 15 - images.length);
        e.target.value = '';
        if (!files.length) return;
        setBusy(files.length);
        const added: GalleryImage[] = [];
        for (const f of files) {
          try {
            const up = await uploadImage(f, 'products');
            added.push({ ...up, alt: null, is_primary: false });
          } catch (err) {
            toast(`${f.name}: ${(err as Error).message}`, 'error');
          }
          setBusy((b) => b - 1);
        }
        const next = [...images, ...added];
        if (next.length && !next.some((x) => x.is_primary)) next[0] = { ...next[0], is_primary: true };
        onChange(next);
      }} />
      <p className="mt-2 text-xs text-muted">Birinchi yoki yulduzcha bilan belgilangan rasm — asosiy. 15 tagacha, har biri 5 MB gacha.</p>
    </div>
  );
}
