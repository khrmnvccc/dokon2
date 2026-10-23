import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { markMyNotificationsRead } from '@/lib/actions/shop';
import { formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import type { Notification } from '@/lib/types';

export default async function NotificationsPage() {
  const user = await requireUser('/account/notifications');
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  const items = (data ?? []) as Notification[];
  const unread = items.some((n) => !n.is_read);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Bildirishnomalar</h1>
        {unread && (
          <form action={async () => { 'use server'; await markMyNotificationsRead(); }}>
            <Button size="sm" variant="outline">Hammasini o‘qilgan deb belgilash</Button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title="Bildirishnomalar yo‘q" text="Buyurtma holati o‘zgarganda shu yerda xabar paydo bo‘ladi." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const body = (
              <div className={cn('rounded-2xl bg-white p-4 shadow-card', !n.is_read && 'border-l-4 border-brand')}>
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.created_at)}</p>
              </div>
            );
            return <li key={n.id}>{n.link?.startsWith('/') ? <Link href={n.link}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
