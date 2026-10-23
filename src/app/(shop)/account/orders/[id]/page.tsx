import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { OrderDetails, type PublicOrder } from '@/components/shop/order-view';
import { CancelOrderButton } from '@/components/shop/account-forms';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await getServerSupabase();
  const [{ data }, settings] = await Promise.all([supabase.rpc('my_order', { p_order_id: id }), getSettings()]);
  const order = data as PublicOrder | null;
  if (!order) notFound();
  return (
    <div>
      <Link href="/account/orders" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" /> Buyurtmalarim</Link>
      <OrderDetails order={order} symbol={settings.localization.currency_symbol} />
      {order.status === 'new' && <div className="mt-4"><CancelOrderButton orderId={order.id} /></div>}
    </div>
  );
}
