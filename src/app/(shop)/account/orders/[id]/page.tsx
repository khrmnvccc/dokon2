import { getL, getLang } from '@/lib/i18n/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { getSettings, getShippingMethods } from '@/lib/data/public';
import { FulfillmentPanel } from '@/components/shop/fulfillment-panel';
import type { Address } from '@/lib/types';
import { OrderDetails, type PublicOrder } from '@/components/shop/order-view';
import { CancelOrderButton } from '@/components/shop/account-forms';
import { CardPayment } from '@/components/payment/card-payment';
import { getOnlinePayment, getOrderPayment } from '@/lib/payments/receipts';
import { OnlinePay } from '@/components/payment/online-pay';
import { CargoTimeline } from '@/components/shop/cargo-timeline';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const L = await getL();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser(`/account/orders/${id}`);
  const supabase = await getServerSupabase();
  const [{ data }, settings] = await Promise.all([supabase.rpc('my_order', { p_order_id: id }), getSettings()]);
  const raw = data as PublicOrder | null;
  if (!raw) notFound();
  // Sotuvdan olingan mahsulotga havola boʻlmaydi (404 chiqmasin); yetkazilganlarda — mijozning oʻz bahosi.
  const ids = [...new Set(raw.items.map((i) => i.product_id).filter((x): x is string => Boolean(x)))];
  const [{ data: active }, { data: mine }] = ids.length
    ? await Promise.all([
      supabase.from('products').select('id').in('id', ids).eq('is_active', true),
      raw.status === 'delivered' ? supabase.from('reviews').select('product_id, rating').in('product_id', ids).eq('user_id', user.id) : Promise.resolve({ data: [] as { product_id: string; rating: number }[] }),
    ])
    : [{ data: [] as { id: string }[] }, { data: [] as { product_id: string; rating: number }[] }];
  const [payment, online] = await Promise.all([getOrderPayment(raw.id).catch(() => null), getOnlinePayment(raw.id).catch(() => null)]);
  const needsChoice = raw.status === 'arrived';
  const [methods, { data: addrs }] = needsChoice
    ? await Promise.all([getShippingMethods(), supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false })])
    : [[], { data: [] }];
  const activeIds = new Set((active ?? []).map((p) => p.id as string));
  const myRating = new Map((mine ?? []).map((r) => [r.product_id as string, r.rating as number]));
  const order: PublicOrder = {
    ...raw,
    items: raw.items.map((i) => ({ ...i, slug: i.product_id && activeIds.has(i.product_id) ? i.slug : null, my_rating: i.product_id ? myRating.get(i.product_id) ?? null : null })),
  };
  return (
    <div>
      <Link href="/account/orders" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-3 hover:text-ink"><ChevronLeft className="h-4 w-4" /> {L("Buyurtmalarim")}</Link>
      {payment && <div className="mb-4"><CardPayment data={payment} symbol={settings.localization.currency_symbol} /></div>}
      {online && (online.payable || online.paid) && <div className="mb-4"><OnlinePay data={online} symbol={settings.localization.currency_symbol} /></div>}
      {(order.status === 'arrived' || order.status === 'delivered') && (
        <div className="mb-4">
          <FulfillmentPanel
            order={{ id: order.id, status: order.status, fulfillment: order.fulfillment ?? null, fulfillment_status: order.fulfillment_status ?? null, delivery_fee: order.delivery_fee ?? 0, shipping_method_id: order.shipping_method_id ?? null, shipping_method_name: order.shipping_method_name, address: order.address, pickup: order.pickup ?? null, subtotal: order.subtotal, discount_total: order.discount_total }}
            methods={methods}
            addresses={(addrs ?? []) as Address[]}
          />
        </div>
      )}
      {settings.cargo.enabled && order.status !== 'cancelled' && order.status !== 'returned' && (
        <div className="mb-4"><CargoTimeline stages={settings.cargo.stages} events={order.cargo ?? []} current={order.cargo_stage ?? null} tracking={order.tracking_number} carrierUrl={settings.cargo.carrier_url} lang={await getLang()} /></div>
      )}
      <OrderDetails order={order} symbol={settings.localization.currency_symbol} lang={await getLang()} />
      {order.status === 'new' && <div className="mt-4"><CancelOrderButton orderId={order.id} /></div>}
    </div>
  );
}
