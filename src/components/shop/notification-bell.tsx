'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Bell, CreditCard, Gift, MessageSquare, Package, PackageCheck, PackageX, Star, Truck, X, type LucideIcon } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import type { Notification } from '@/lib/types';

/**
 * Tepada, profil yonida: qoʻngʻiroqcha. Oʻqilmagan xabar boʻlsa qizil belgi (soni bilan) yonib turadi.
 * Buyurtma holati, toʻlov, kupon xabarlari shu yerga keladi. Ochilganda oxirgi xabarlar chiqadi va oʻqilgan boʻladi.
 * Yangi xabar Supabase Realtime orqali darhol keladi; boʻlmasa sahifa almashganda va har daqiqada tekshiriladi.
 */
export function NotificationBell() {
  const L = useL();
  const { user } = useApp();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const uid = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!uid || !isSupabaseConfigured) return;
    const { count } = await getBrowserSupabase().from('notifications')
      .select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('is_read', false);
    setUnread(count ?? 0);
  }, [uid]);

  // Sahifa almashganda, oynaga qaytganda va har 60 soniyada
  useEffect(() => { void refresh(); }, [refresh, pathname]);
  useEffect(() => {
    if (!uid) return;
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    const t = setInterval(onFocus, 60_000);
    return () => { document.removeEventListener('visibilitychange', onFocus); clearInterval(t); };
  }, [uid, refresh]);

  // Realtime: yangi bildirishnoma kelishi bilan belgi yonadi
  useEffect(() => {
    if (!uid || !isSupabaseConfigured) return;
    const sb = getBrowserSupabase();
    const ch = sb.channel(`notif:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (p: { new: unknown }) => {
        const row = p.new as Notification;
        setUnread((n) => n + 1);
        setItems((list) => (list ? [row, ...list].slice(0, 8) : list));
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [uid]);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => { const t = e.target as Node; if (ref.current?.contains(t) || sheet.current?.contains(t)) return; if (window.matchMedia('(min-width: 640px)').matches) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    // Telefonda oyna ochiq turganda orqa sahifa aylanmasin
    const prev = document.body.style.overflow;
    if (!window.matchMedia('(min-width: 640px)').matches) document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); document.body.style.overflow = prev; };
  }, [open]);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (!uid) return;
    const sb = getBrowserSupabase();
    const { data } = await sb.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(8);
    setItems((data ?? []) as Notification[]);
    if (unread > 0) {
      setUnread(0);
      await sb.from('notifications').update({ is_read: true }).eq('user_id', uid).eq('is_read', false);
    }
  };

  const label = L('Bildirishnomalar');
  const badge = unread > 0 && (
    <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex">
      <span aria-hidden className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-50" />
      <span className="relative min-w-[18px] rounded-full border-2 border-[var(--panel)] bg-danger px-1 text-center text-[10px] font-bold leading-[14px] text-white num">{unread > 99 ? '99+' : unread}</span>
    </span>
  );

  if (!uid) return null;
  const fresh = (items ?? []).filter((n) => !n.is_read);
  const old = (items ?? []).filter((n) => n.is_read);
  const panel = (
    <>
      <div className="flex items-center justify-between px-5 pb-3 pt-1 sm:pt-4">
        <p className="text-[19px] font-bold tracking-tight">{label}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label={L('Yopish')} className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-ink-2 hover:text-ink"><X className="size-4" /></button>
      </div>
      <div className="max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain px-3 pb-3">
        {items === null ? (
          [0, 1, 2].map((i) => <div key={i} className="mb-2 h-[72px] animate-pulse rounded-2xl bg-surface-2" />)
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-surface-2 text-ink-3"><Bell className="size-6" /></span>
            <p className="font-semibold">{L('Bildirishnomalar yo‘q')}</p>
            <p className="mt-1 text-sm text-ink-3">{L('Buyurtma holati o‘zgarganda shu yerda xabar paydo bo‘ladi.')}</p>
          </div>
        ) : (
          <>
            {fresh.length > 0 && <Group title={L('Yangi')} items={fresh} />}
            {old.length > 0 && <Group title={fresh.length ? L('Avvalgilar') : ''} items={old} />}
          </>
        )}
      </div>
      <Link href="/account/notifications" className="block border-t border-line px-4 py-3.5 text-center text-[15px] font-semibold text-primary hover:bg-surface-2">{L('Hammasini koʻrish')}</Link>
    </>
  );

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} aria-label={unread ? `${label}: ${unread}` : label} title={label} aria-expanded={open} data-tour="notifications"
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
        <Bell className={cn('size-[18px]', unread > 0 && 'text-ink')} strokeWidth={1.9} aria-hidden />
        {badge}
      </button>
      {/* Kompyuterda: tugma ostida ochiladigan qattiq (shaffof emas) panel */}
      {open && (
        <div className="anim-pop absolute right-0 top-full z-50 mt-2 hidden w-[380px] overflow-hidden rounded-[22px] border border-line bg-[var(--panel)] shadow-pop sm:block">{panel}</div>
      )}
      {/* Telefonda: pastdan chiqadigan oyna (sarlavhaning shisha effekti ichida qolmasligi uchun body ga) */}
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[70] sm:hidden" role="dialog" aria-modal="true" aria-label={label}>
          <button type="button" aria-label={L('Yopish')} onClick={() => setOpen(false)} className="anim-fade absolute inset-0 bg-black/45" />
          <div ref={sheet} className="anim-rise absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[28px] bg-[var(--panel)] pb-[env(safe-area-inset-bottom)] shadow-pop">
            <div className="mx-auto mb-1 mt-2.5 h-1.5 w-10 rounded-full bg-line-strong" />
            {panel}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  green: 'bg-success-soft text-success', red: 'bg-danger-soft text-danger', amber: 'bg-warn-soft text-warn',
  blue: 'bg-primary-soft text-primary', violet: 'bg-[color-mix(in_srgb,#8a3ffc_14%,transparent)] text-[#8a3ffc]', gray: 'bg-surface-2 text-ink-2',
};
function look(n: Notification): { icon: LucideIcon; tone: string } {
  const t = n.title.toLowerCase();
  if (n.type === 'payment') return { icon: CreditCard, tone: /rad|qabul qilinmadi/.test(t) ? TONE.red : TONE.amber };
  if (n.type === 'coupon' || n.type === 'referral') return { icon: Gift, tone: TONE.violet };
  if (n.type === 'review') return { icon: Star, tone: TONE.amber };
  if (n.type === 'support') return { icon: MessageSquare, tone: TONE.blue };
  if (n.type.startsWith('order')) {
    if (/yetkazildi/.test(t)) return { icon: PackageCheck, tone: TONE.green };
    if (/bekor|qaytarildi/.test(t)) return { icon: PackageX, tone: TONE.red };
    if (/joʻnatildi|jo'natildi|jo‘natildi/.test(t)) return { icon: Truck, tone: TONE.blue };
    return { icon: Package, tone: TONE.blue };
  }
  return { icon: Bell, tone: TONE.gray };
}

function Group({ title, items }: { title: string; items: Notification[] }) {
  const L = useL();
  const { lang } = useApp();
  return (
    <section className="mb-2">
      {title && <p className="px-2 pb-1.5 pt-2 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-3">{title}</p>}
      <ul className="space-y-2">
        {items.map((n) => {
          const { icon: Icon, tone } = look(n);
          const row = (
            <div className={cn('flex gap-3 rounded-2xl border p-3 transition-colors', n.is_read ? 'border-line bg-surface-2/50' : 'border-primary/25 bg-primary-soft/50', n.link?.startsWith('/') && 'hover:bg-surface-2')}>
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', tone)}><Icon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug">{notifText(n.title, lang, L)}</p>
                  <span className="shrink-0 pt-0.5 text-[12px] text-ink-3">{ago(n.created_at, lang)}</span>
                </div>
                {n.body && <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-ink-2">{notifText(n.body, lang, L)}</p>}
              </div>
            </div>
          );
          return <li key={n.id}>{n.link?.startsWith('/') ? <Link href={n.link} className="block">{row}</Link> : row}</li>;
        })}
      </ul>
    </section>
  );
}

/** “5 daqiqa oldin” / “5 мин назад”. */
function ago(iso: string, lang: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const ru = lang === 'ru';
  if (s < 60) return ru ? 'сейчас' : 'hozir';
  if (s < 3600) return `${Math.floor(s / 60)} ${ru ? 'мин' : 'daq'}`;
  if (s < 86400) return `${Math.floor(s / 3600)} ${ru ? 'ч' : 'soat'}`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} ${ru ? 'дн' : 'kun'}`;
  return formatDate(iso);
}

/** Bazadagi oʻzbekcha xabar matni (raqamli qismi bilan) — rus tilida tarjimasi. */
function notifText(text: string, lang: string, L: (s: string) => string) {
  if (lang !== 'ru') return text;
  const m = text.match(/^(.*?)(\s*\(?[#№]\s*\d+\)?.*)$/);
  if (m && L(m[1].trim()) !== m[1].trim()) return L(m[1].trim()) + m[2];
  return L(text);
}
