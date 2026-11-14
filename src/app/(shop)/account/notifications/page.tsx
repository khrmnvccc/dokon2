import { getL } from '@/lib/i18n/server';
import Link from 'next/link';
import { Bell, CheckCheck, CreditCard, Gift, MessageSquare, Package, Star, type LucideIcon } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { markMyNotificationsRead } from '@/lib/actions/shop';
import { formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import type { Notification } from '@/lib/types';

export default async function NotificationsPage() {
  const L = await getL();
  const user = await requireUser('/account/notifications');
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  const items = (data ?? []) as Notification[];
  const unread = items.some((n) => !n.is_read);
  const icon = (type: string): LucideIcon =>
    type === 'payment' ? CreditCard : type === 'coupon' || type === 'referral' ? Gift : type === 'review' ? Star : type === 'support' ? MessageSquare : type.startsWith('order') ? Package : Bell;
  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{L("Bildirishnomalar")}</h1>
        {unread && (
          <form action={async () => { 'use server'; await markMyNotificationsRead(); }}>
            <Button size="sm" variant="ghost" className="text-primary"><CheckCheck className="size-4" /> {L("Hammasi oʻqildi")}</Button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title={L("Bildirishnomalar yo‘q")} text={L("Buyurtma holati o‘zgarganda shu yerda xabar paydo bo‘ladi.")} />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          {items.map((n) => {
            const Icon = icon(n.type);
            const body = (
              <div className={cn('flex gap-3 px-4 py-3.5 transition-colors', n.link?.startsWith('/') && 'hover:bg-surface-2', !n.is_read && 'bg-primary-soft/40')}>
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', n.is_read ? 'bg-surface-2 text-ink-3' : 'bg-primary text-primary-fg')}>
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('break-words text-[15px] leading-snug', n.is_read ? 'font-medium' : 'font-semibold')}>{n.title}</p>
                    {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={L("Yangi")} />}
                  </div>
                  {n.body && <p className="mt-0.5 break-words text-sm text-ink-2">{n.body}</p>}
                  <p className="mt-1 text-xs text-ink-3 num">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
            );
            return <li key={n.id} className="border-t border-line first:border-t-0">{n.link?.startsWith('/') ? <Link href={n.link} className="block">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
