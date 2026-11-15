'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, CheckCheck, CreditCard, Gift, MessageSquare, Package, Star, type LucideIcon } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import type { Notification } from '@/lib/types';

const iconOf = (type: string): LucideIcon =>
  type === 'payment' ? CreditCard : type === 'coupon' || type === 'referral' ? Gift : type === 'review' ? Star : type === 'support' ? MessageSquare : type.startsWith('order') ? Package : Bell;

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
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
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
      <span className="relative min-w-[18px] rounded-full border-2 border-[var(--surface)] bg-danger px-1 text-center text-[10px] font-bold leading-[14px] text-white num">{unread > 99 ? '99+' : unread}</span>
    </span>
  );

  if (!uid) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} aria-label={unread ? `${label}: ${unread}` : label} title={label} aria-expanded={open} data-tour="notifications"
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
        <Bell className={cn('size-[18px]', unread > 0 && 'text-ink')} strokeWidth={1.9} aria-hidden />
        {badge}
      </button>
      {open && (
        <div className="anim-pop fixed inset-x-3 top-[calc(env(safe-area-inset-top)+64px)] z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[15px] font-semibold tracking-tight">{label}</p>
            <CheckCheck className="size-4 text-ink-3" aria-hidden />
          </div>
          <ul className="max-h-[min(60vh,420px)] overflow-y-auto">
            {items === null ? (
              [0, 1, 2].map((i) => <li key={i} className="m-3 h-12 animate-pulse rounded-xl bg-surface-2" />)
            ) : items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-ink-3">
                <Bell className="mx-auto mb-2 size-7 opacity-50" />
                {L('Buyurtma holati o‘zgarganda shu yerda xabar paydo bo‘ladi.')}
              </li>
            ) : items.map((n) => {
              const Icon = iconOf(n.type);
              const row = (
                <div className={cn('flex gap-3 px-4 py-3 transition-colors', n.link?.startsWith('/') && 'hover:bg-surface-2', !n.is_read && 'bg-primary-soft/40')}>
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', n.is_read ? 'bg-surface-2 text-ink-3' : 'bg-primary text-primary-fg')}><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('break-words text-sm leading-snug', n.is_read ? 'font-medium' : 'font-semibold')}>{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-ink-2">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-ink-3 num">{formatDateTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-danger" aria-label={L('Yangi')} />}
                </div>
              );
              return <li key={n.id} className="border-t border-line first:border-t-0">{n.link?.startsWith('/') ? <Link href={n.link} className="block">{row}</Link> : row}</li>;
            })}
          </ul>
          <Link href="/account/notifications" className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-surface-2">{L('Hammasini koʻrish')}</Link>
        </div>
      )}
    </div>
  );
}
