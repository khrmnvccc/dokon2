'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/components/ui/cn';
import { saveSetting } from '@/lib/actions/admin/settings';
import { HOME_SECTION_LABELS, SECTION_SIZES, type SectionSize, type SiteSettings } from '@/lib/settings-schema';

// Saytni joyida tahrirlash: xodimlarga har sahifada "qalam" chiqadi. Qalam bosilsa faqat oʻlcham rejimi yoqiladi:
// har bir blok ustida S / M / L (darhol hamma uchun saqlanadi). Mazmun admin panelda tahrirlanadi.

let editing = false;
const listeners = new Set<() => void>();
const setEditing = (v: boolean) => { editing = v; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useEditing = () => useSyncExternalStore(subscribe, () => editing, () => false);

const SPOTS_OFF = true;

const SIZE_LABEL: Record<SectionSize, string> = { sm: 'S', md: 'M', lg: 'L' };

export function EditPencil() {
  const L = useL();
  const { isStaff } = useApp();
  const pathname = usePathname();
  const isEditing = useEditing();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('edit') === '1') setEditing(true);
  }, [pathname]);
  if (!isStaff) return null;

  // Qalam: faqat oʻlcham (S/M/L) rejimini yoqadi/oʻchiradi — boshqa tugma va menyular yoʻq.
  return (
    <div className="no-print fixed right-4 z-40 bottom-[calc(env(safe-area-inset-bottom)+80px)] lg:bottom-6">
      <button
        type="button"
        onClick={() => setEditing(!isEditing)}
        aria-label={isEditing ? L("Tahrirni tugatish") : L("Oʻlchamlarni oʻzgartirish")}
        className={cn(
          'flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] transition active:scale-95',
          isEditing ? 'bg-success text-white' : 'bg-ink text-bg',
        )}
      >
        {isEditing ? <Check className="size-5" /> : <Pencil className="size-5" />}
        {isEditing && L("Tayyor")}
      </button>
    </div>
  );
}

/**
 * Tahrir rejimida element ustida chiqadigan qalamcha: bosilsa admin paneldagi aynan shu narsaning
 * tahrir oynasi yangi varaqda ochiladi. Mijozlarga va oddiy rejimda koʻrinmaydi.
 * Ota element `relative` boʻlishi kerak. <a> ichiga qoʻymang (ichma-ich havola boʻlmaydi).
 */
export function EditSpot({ href, label, className, inline }: { href: string; label: string; className?: string; inline?: boolean }) {
  const L = useL();
  const { isStaff } = useApp();
  const on = useEditing();
  // Egasining talabi (2026-11-15): qalam bosilganda faqat oʻlchamlar qoladi — bu yorliqlar endi chiqmaydi.
  if (SPOTS_OFF || !isStaff || !on) return null;
  return (
    <Link href={href} target="_blank" onClick={(e) => e.stopPropagation()} title={L(label)}
      className={cn('anim-pop z-20 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-2.5 text-xs font-semibold text-bg shadow-pop ring-2 ring-primary/70 transition hover:scale-105',
        !inline && 'absolute right-2 top-2', className)}>
      <Pencil className="size-3.5" />{L(label)}
    </Link>
  );
}

/** Tahrir rejimida boʻlim atrofida chiziqcha ramka (qaysi qism tahrirlanishini koʻrsatadi). */
export function EditFrame({ href, label, children, className }: { href: string; label: string; children: ReactNode; className?: string }) {
  const { isStaff } = useApp();
  const on = useEditing() && isStaff;
  return (
    <div className={cn('relative', on && !SPOTS_OFF && 'rounded-[24px] outline-2 outline-offset-4 outline-dashed outline-primary/50', className)}>
      {children}
      <EditSpot href={href} label={label} />
    </div>
  );
}

type Section = SiteSettings['home_sections'][number];

/** Bosh sahifa bloklari. Oddiy holatda faqat yoqilganlari; tahrir holatida hammasi + boshqaruv paneli. */
export function HomeLayout({ sections: initial, blocks }: { sections: Section[]; blocks: Partial<Record<string, ReactNode>> }) {
  const L = useL();
  const toast = useToast();
  const router = useRouter();
  const isEditing = useEditing();
  const [sections, setSections] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => setSections(initial), [initial]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('edit') === '1') {
      setEditing(true);
      router.replace('/', { scroll: false });
    }
  }, [router]);

  const save = (next: Section[]) => {
    setSections(next);
    start(async () => {
      const res = await saveSetting('home_sections', next);
      if (!res.ok) { toast(res.error ?? L("Saqlanmadi"), 'error'); setSections(initial); return; }
      router.refresh();
    });
  };
  const patch = (i: number, p: Partial<Section>) => save(sections.map((s, k) => (k === i ? { ...s, ...p } : s)));
  if (!isEditing) {
    return <>{sections.filter((s) => s.enabled).map((s) => (blocks[s.key] ? <div key={s.key}>{blocks[s.key]}</div> : null))}</>;
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm text-bg shadow-pop">
        <Pencil className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{L("Har bir blok uchun oʻlchamni tanlang: S, M yoki L. Darhol saqlanadi.")}</span>
        {pending && <Loader2 className="size-4 shrink-0 animate-spin" />}
      </div>
      {sections.map((s, i) => {
        if (!s.enabled) return null;
        const size = s.size ?? 'md';
        const node = blocks[s.key];
        if (!node) return null;
        return (
          <div key={s.key} className="relative rounded-[24px] outline-2 outline-offset-4 outline-dashed outline-primary/50">
            <div className="absolute -top-3 left-2 z-20 flex items-center gap-1 rounded-full border border-line bg-[var(--panel)] p-0.5 pl-2.5 text-[11px] font-semibold text-ink-2 shadow-pop">
              <span className="max-w-[9rem] truncate">{L(HOME_SECTION_LABELS[s.key])}</span>
              <div className="flex" role="group" aria-label={L("Oʻlcham")}>
                {SECTION_SIZES.map((z) => (
                  <button key={z} type="button" onClick={() => patch(i, { size: z })} aria-pressed={size === z}
                    className={cn('h-7 w-8 rounded-full text-xs font-bold transition', size === z ? 'bg-primary text-primary-fg shadow-sm' : 'text-ink-3 hover:text-ink')}>
                    {SIZE_LABEL[z]}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-3">{node}</div>
          </div>
        );
      })}
    </>
  );
}
