import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { getPublicSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { getCurrentUser } from '@/lib/auth';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { OrderDetails, type PublicOrder } from '@/components/shop/order-view';

export const metadata: Metadata = { title: 'Buyurtma qabul qilindi', robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const { data } = token && UUID.test(token) ? await getPublicSupabase().rpc('order_by_token', { p_token: token }) : { data: null };
  const order = data as PublicOrder | null;

  if (!order) {
    return <EmptyState title="Buyurtma topilmadi" text="Havola eskirgan bo‘lishi mumkin. Buyurtma holatini raqam va telefon orqali tekshiring."
      action={<Link href="/track" className={buttonClass('primary')}>Buyurtmani kuzatish</Link>} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 rounded-2xl bg-white p-6 text-center shadow-card sm:p-8">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-3 text-2xl font-bold">Rahmat! Buyurtmangiz qabul qilindi</h1>
        <p className="mt-2 text-muted">
          Buyurtma raqami: <b className="text-ink">#{order.number}</b>. Operatorimiz tez orada {order.customer_phone} raqamiga qo‘ng‘iroq qilib, buyurtmani tasdiqlaydi.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {user ? (
            <Link href={`/account/orders/${order.id}`} className={buttonClass('primary')}>Buyurtmalarim</Link>
          ) : (
            <Link href="/track" className={buttonClass('primary')}>Buyurtmani kuzatish</Link>
          )}
          <Link href="/catalog" className={buttonClass('outline')}>Xaridni davom ettirish</Link>
        </div>
      </div>
      <OrderDetails order={order} symbol={settings.localization.currency_symbol} />
    </div>
  );
}
