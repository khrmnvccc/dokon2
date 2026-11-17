'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Link2, Send, X } from 'lucide-react';
import { useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { IMPORT_MAX_IMAGES, IMPORT_MAX_LINKS, linkHost, parseLinks } from '@/lib/import-requests';

/** Mijoz: havola va/yoki rasm bilan Xitoydan olib kelish soʻrovi. */
export function ImportRequestForm({ intro, name, phone }: { intro: string; name: string; phone: string }) {
  const L = useL();
  const toast = useToast();
  const router = useRouter();
  const [links, setLinks] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const found = parseLinks(links);

  const addFiles = (list: FileList | null) => {
    const next = [...files];
    for (const f of Array.from(list ?? [])) {
      if (!f.type.startsWith('image/')) { toast(L('Faqat rasm yuklang'), 'error'); continue; }
      if (f.size > 5 * 1024 * 1024) { toast(L('Rasm juda katta (5 MB gacha)'), 'error'); continue; }
      if (next.length < IMPORT_MAX_IMAGES) next.push(f);
    }
    setFiles(next);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!found.length && !files.length) { toast(L('Mahsulot havolasini yoki rasmini qoʻshing'), 'error'); return; }
    const fd = new FormData(e.currentTarget);
    fd.delete('images');
    for (const f of files) fd.append('images', f);
    setBusy(true);
    try {
      const res = await fetch('/api/import-requests', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? L('Yuborib boʻlmadi'));
      toast(L('Soʻrov yuborildi. Narxini hisoblab, botga yozamiz'));
      router.push(`/account/requests/${json.id}`);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
      {intro && <p className="text-sm text-ink-2">{L(intro)}</p>}
      <Field label={L('Mahsulot havolalari')} hint={L(`Har qatorga bittadan, ${IMPORT_MAX_LINKS} tagacha`)}>
        <Textarea name="links" rows={3} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://detail.1688.com/offer/…" />
      </Field>
      {found.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {found.map((l) => <li key={l} className="flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary"><Link2 className="size-3.5" />{linkHost(l)}</li>)}
        </ul>
      )}
      <div>
        <p className="mb-1.5 text-sm font-medium">{L('Rasmlar')} <span className="font-normal text-ink-3">({L('ixtiyoriy')}, {IMPORT_MAX_IMAGES} {L('tagacha')})</span></p>
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative size-20 overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white" aria-label={L('Olib tashlash')}><X className="size-3.5" /></button>
            </div>
          ))}
          {files.length < IMPORT_MAX_IMAGES && (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-xs text-ink-3 hover:bg-surface-2">
              <ImagePlus className="size-5" />{L('Qoʻshish')}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label={L('Mahsulot nomi')} hint={L('ixtiyoriy')}><Input name="title" maxLength={160} placeholder={L('Masalan: krossovka, 42-razmer')} /></Field>
        <Field label={L('Soni')}><Input name="quantity" type="number" min={1} max={100000} defaultValue={1} /></Field>
      </div>
      <Field label={L('Izoh')} hint={L('Rang, razmer, model va boshqa talablar')}><Textarea name="description" rows={2} maxLength={1500} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={L('Ismingiz')}><Input name="name" defaultValue={name} maxLength={120} required /></Field>
        <Field label={L('Telefon')}><Input name="phone" defaultValue={phone} inputMode="tel" required /></Field>
      </div>
      <Button type="submit" loading={busy} className="w-full sm:w-auto"><Send className="size-4" /> {L('Narxini bilish')}</Button>
    </form>
  );
}
