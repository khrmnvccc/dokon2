'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Image as ImageIcon, LayoutGrid, Loader2, Pencil, Settings, X } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/components/ui/cn';
import { saveSetting } from '@/lib/actions/admin/settings';
import { HOME_SECTION_LABELS, SECTION_SIZES, type SectionSize, type SiteSettings } from '@/lib/settings-schema';

// Saytni joyida tahrirlash: xodimlarga har sahifada "qalam" chiqadi. Bosh sahifada qalam bosilsa,
// har bir blok ustida boshqaruv paneli paydo boʻladi (tartib, koʻrinish, oʻlcham). Har oʻzgarish darhol saqlanadi.

let editing = false;
const listeners = new Set<() => void>();
const setEditing = (v: boolean) => { editing = v; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const useEditing = () => useSyncExternalStore(subscribe, () => editing, () => false);

const SIZE_LABEL: Record<SectionSize, string> = { sm: 'S', md: 'M', lg: 'L' };

export function EditPencil() {
  const L = useL();
  const { isStaff } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isEditing = useEditing();
  const [menu, setMenu] = useState(false);
  const onHome = pathname === '/';

  useEffect(() => { setMenu(false); if (!onHome) setEditing(false); }, [pathname, onHome]);
  if (!isStaff) return null;

  return (
    <div className="no-print fixed right-4 z-40 bottom-[calc(env(safe-area-inset-bottom)+80px)] lg:bottom-6">
      {menu && (
        <div className="anim-pop absolute bottom-14 right-0 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          <button onClick={() => { setMenu(false); if (onHome) setEditing(true); else router.push('/?edit=1'); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2">
            <LayoutGrid className="size-4 text-primary" /> {L("Bosh sahifa bloklari")}
          </button>
          <Link href="/admin/banners" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
            <ImageIcon className="size-4 text-primary" /> {L("Bannerlar")}
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
            <Settings className="size-4 text-primary" /> {L("Sozlamalar")}
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => (isEditing ? setEditing(false) : setMenu((m) => !m))}
        aria-label={isEditing ? L("Tahrirni tugatish") : L("Saytni tahrirlash")}
        className={cn(
          'flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] transition active:scale-95',
          isEditing ? 'bg-success text-white' : 'bg-ink text-bg',
        )}
      >
        {isEditing ? <Check className="size-5" /> : menu ? <X className="size-5" /> : <Pencil className="size-5" />}
        {isEditing && L("Tayyor")}
      </button>
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
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  if (!isEditing) {
    return <>{sections.filter((s) => s.enabled).map((s) => (blocks[s.key] ? <div key={s.key}>{blocks[s.key]}</div> : null))}</>;
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm text-bg shadow-pop">
        <Pencil className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{L("Tahrir rejimi: bloklarni suring, yashiring yoki oʻlchamini tanlang. Oʻzgarishlar darhol saqlanadi.")}</span>
        {pending && <Loader2 className="size-4 shrink-0 animate-spin" />}
      </div>
      {sections.map((s, i) => {
        const size = s.size ?? 'md';
        const node = blocks[s.key];
        return (
          <div key={s.key} className={cn('relative rounded-[24px] outline-2 outline-offset-4 outline-dashed', s.enabled ? 'outline-primary/50' : 'outline-line-strong')}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-soft">
              <span className="min-w-0 flex-1 truncate px-2 text-[13px] font-semibold">{L(HOME_SECTION_LABELS[s.key])}</span>
              <div className="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label={L("Oʻlcham")}>
                {SECTION_SIZES.map((z) => (
                  <button key={z} type="button" onClick={() => patch(i, { size: z })} aria-pressed={size === z}
                    className={cn('h-7 w-8 rounded-full text-xs font-bold transition', size === z ? 'bg-primary text-primary-fg shadow-sm' : 'text-ink-3 hover:text-ink')}>
                    {SIZE_LABEL[z]}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={L("Yuqoriga")} className="flex size-8 items-center justify-center rounded-full bg-surface-2 disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={L("Pastga")} className="flex size-8 items-center justify-center rounded-full bg-surface-2 disabled:opacity-30"><ArrowDown className="size-4" /></button>
              <button type="button" onClick={() => patch(i, { enabled: !s.enabled })} aria-label={s.enabled ? L("Yashirish") : L("Koʻrsatish")}
                className={cn('flex size-8 items-center justify-center rounded-full', s.enabled ? 'bg-surface-2' : 'bg-warn-soft text-warn')}>
                {s.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
            {s.enabled && node ? node : (
              <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-3">
                {s.enabled ? L("Bu blokda hozircha maʼlumot yoʻq") : L("Yashirilgan — koʻz belgisini bossangiz saytda chiqadi")}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
