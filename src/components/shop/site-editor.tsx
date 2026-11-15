'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Image as ImageIcon, LayoutGrid, Loader2, Palette, Pencil, Settings, X } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/components/ui/cn';
import { saveSetting } from '@/lib/actions/admin/settings';
import { HOME_SECTION_LABELS, SECTION_SIZES, type SectionSize, type SiteSettings } from '@/lib/settings-schema';

// Saytni joyida tahrirlash: xodimlarga har sahifada "qalam" chiqadi. Qalam bosilsa tahrir rejimi yoqiladi:
// har bir mahsulot, banner, kategoriya, matn va sarlavha ustida qalamcha paydo boʻladi (bosilsa — admindagi
// aynan oʻsha joy ochiladi). Bosh sahifada qoʻshimcha: bloklar tartibi, koʻrinishi va oʻlchami (darhol saqlanadi).

let editing = false;
const listeners = new Set<() => void>();
const setEditing = (v: boolean) => { editing = v; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const useEditing = () => useSyncExternalStore(subscribe, () => editing, () => false);

const SIZE_LABEL: Record<SectionSize, string> = { sm: 'S', md: 'M', lg: 'L' };

/** Joriy sahifa uchun admin paneldagi tahrir joyi (qalamcha menyusida birinchi chiqadi). */
function pageTarget(pathname: string): { href: string; label: string } | null {
  if (pathname === '/') return { href: '/admin/banners', label: 'Bannerlar' };
  if (pathname.startsWith('/category/') || pathname === '/catalog') return { href: '/admin/categories', label: 'Kategoriyalar' };
  if (pathname === '/sale') return { href: '/admin/promotions', label: 'Aksiyalar' };
  if (pathname === '/reviews') return { href: '/admin/reviews', label: 'Sharhlar' };
  if (pathname === '/help') return { href: '/admin/settings?tab=help', label: 'Yordam markazi' };
  if (['/about', '/delivery', '/faq', '/terms', '/privacy', '/contact'].includes(pathname)) return { href: '/admin/pages', label: 'Sahifa matni' };
  if (pathname === '/checkout' || pathname === '/cart') return { href: '/admin/methods', label: 'Yetkazish va toʻlov' };
  if (pathname.startsWith('/account/referral')) return { href: '/admin/partners/rules', label: 'Hamkorlik qoidalari' };
  return null;
}

export function EditPencil() {
  const L = useL();
  const { isStaff } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isEditing = useEditing();
  const onHome = pathname === '/';
  const target = pageTarget(pathname);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('edit') === '1') setEditing(true);
  }, [pathname]);
  if (!isStaff) return null;

  const item = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2';
  return (
    <div ref={box} className="no-print fixed right-4 z-40 bottom-[calc(env(safe-area-inset-bottom)+80px)] lg:bottom-6">
      {isEditing && menu && (
        <div className="anim-pop absolute bottom-14 right-0 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          <p className="px-3 pb-1.5 pt-2 text-[12px] leading-snug text-ink-3">{L("Tahrir rejimi: sahifadagi qalamcha belgilarini bosing.")}</p>
          {target && (
            <Link href={target.href} target="_blank" className={item}><Pencil className="size-4 text-primary" /> {L(target.label)}</Link>
          )}
          {!onHome && (
            <button onClick={() => router.push('/?edit=1')} className={item}><LayoutGrid className="size-4 text-primary" /> {L("Bosh sahifa bloklari")}</button>
          )}
          <Link href="/admin/settings?tab=brand" target="_blank" className={item}><Palette className="size-4 text-primary" /> {L("Dizayn (rang, logo, rejim)")}</Link>
          <Link href="/admin/settings?tab=menu" target="_blank" className={item}><Settings className="size-4 text-primary" /> {L("Menyu va footer")}</Link>
          <Link href="/admin/translations" target="_blank" className={item}><ImageIcon className="size-4 text-primary" /> {L("Matnlar va tarjimalar")}</Link>
        </div>
      )}
      <div className="flex items-center gap-2">
      {isEditing && (
        <button type="button" onClick={() => setMenu((m) => !m)} aria-label={L("Tahrir menyusi")} aria-expanded={menu}
          className="flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-pop transition active:scale-95">
          {menu ? <X className="size-5" /> : <Settings className="size-5" />}
        </button>
      )}
      <button
        type="button"
        onClick={() => { const next = !isEditing; setEditing(next); setMenu(next); }}
        aria-label={isEditing ? L("Tahrirni tugatish") : L("Saytni tahrirlash")}
        className={cn(
          'flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] transition active:scale-95',
          isEditing ? 'bg-success text-white' : 'bg-ink text-bg',
        )}
      >
        {isEditing ? <Check className="size-5" /> : <Pencil className="size-5" />}
        {isEditing && L("Tayyor")}
      </button>
      </div>
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
  if (!isStaff || !on) return null;
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
    <div className={cn('relative', on && 'rounded-[24px] outline-2 outline-offset-4 outline-dashed outline-primary/50', className)}>
      {children}
      <EditSpot href={href} label={label} />
    </div>
  );
}

type Section = SiteSettings['home_sections'][number];

/** Bosh sahifa bloki mazmuni admin panelning qayerida tahrirlanadi. */
const SECTION_ADMIN: Partial<Record<string, string>> = {
  hero: '/admin/banners', middle_banner: '/admin/banners', promo: '/admin/banners', categories: '/admin/categories',
  bestsellers: '/admin/products', new: '/admin/products', featured: '/admin/products', sale: '/admin/promotions',
  reviews: '/admin/reviews', advantages: '/admin/settings?tab=home',
};

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
              {SECTION_ADMIN[s.key] && (
                <Link href={SECTION_ADMIN[s.key]!} target="_blank" aria-label={L("Mazmunini tahrirlash")} title={L("Mazmunini tahrirlash")}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-fg"><Pencil className="size-4" /></Link>
              )}
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
