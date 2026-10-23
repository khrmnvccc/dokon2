import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { ORDER_STEPS, orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import type { OrderAddress, OrderStatus } from '@/lib/types';
import { ProductImage } from './product-image';

export interface PublicOrder {
  id: string;
  number: number;
  status: OrderStatus;
  payment_method_name: string;
  shipping_method_name: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address: OrderAddress | null;
  comment: string | null;
  subtotal: number;
  discount_total: number;
  coupon_code: string | null;
  shipping_cost: number;
  total: number;
  items_count: number;
  tracking_number: string | null;
  cancelled_reason: string | null;
  created_at: string;
  items: { id: string; product_name: string; variant_name: string | null; image_url: string | null; unit_price: number; quantity: number; line_total: number; slug: string | null }[];
  history: { status: OrderStatus; note?: string | null; created_at: string }[];
}

export function StatusTimeline({ status, history }: { status: OrderStatus; history: { status: OrderStatus; created_at: string }[] }) {
  if (status === 'cancelled' || status === 'returned') {
    const at = history.findLast((h) => h.status === status)?.created_at;
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
        <X className="h-5 w-5" /> Buyurtma {orderStatusLabel[status].toLowerCase()} {at && <span className="text-red-500">· {formatDateTime(at)}</span>}
      </div>
    );
  }
  const current = ORDER_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1">
      {ORDER_STEPS.map((step, i) => {
        const reached = i <= current;
        const at = history.find((h) => h.status === step)?.created_at;
        return (
          <li key={step} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : reached ? 'bg-brand' : 'bg-line')} />
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold', reached ? 'bg-brand text-white' : 'bg-slate-100 text-muted')}>
                {reached ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('h-0.5 flex-1', i === ORDER_STEPS.length - 1 ? 'opacity-0' : i < current ? 'bg-brand' : 'bg-line')} />
            </div>
            <span className={cn('mt-1.5 text-[11px] font-semibold sm:text-xs', reached ? 'text-ink' : 'text-muted')}>{orderStatusLabel[step]}</span>
            {at && <span className="hidden text-[10px] text-muted sm:block">{formatDateTime(at)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetails({ order, symbol }: { order: PublicOrder; symbol: string }) {
  const p = (v: number) => formatPrice(v, symbol);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-card sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Buyurtma #{order.number}</h2>
            <p className="text-sm text-muted">{formatDateTime(order.created_at)}</p>
          </div>
          <Badge tone={orderStatusTone[order.status]}>{orderStatusLabel[order.status]}</Badge>
        </div>
        <StatusTimeline status={order.status} history={order.history} />
        {order.tracking_number && <p className="mt-4 text-sm">Kuzatuv raqami: <b>{order.tracking_number}</b></p>}
        {order.cancelled_reason && <p className="mt-2 text-sm text-muted">Sabab: {order.cancelled_reason}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 text-sm shadow-card sm:p-6">
          <h3 className="mb-3 font-bold">Yetkazib berish</h3>
          <dl className="space-y-1.5">
            <div><dt className="inline text-muted">Qabul qiluvchi: </dt><dd className="inline">{order.customer_name}, {formatUzPhone(order.customer_phone)}</dd></div>
            <div><dt className="inline text-muted">Usul: </dt><dd className="inline">{order.shipping_method_name}</dd></div>
            {order.address && (
              <div><dt className="inline text-muted">Manzil: </dt><dd className="inline">{[order.address.region, order.address.city, order.address.street, order.address.apartment, order.address.landmark].filter(Boolean).join(', ')}</dd></div>
            )}
            <div><dt className="inline text-muted">To‘lov: </dt><dd className="inline">{order.payment_method_name}</dd></div>
            {order.comment && <div><dt className="inline text-muted">Izoh: </dt><dd className="inline">{order.comment}</dd></div>}
          </dl>
        </div>
        <div className="rounded-2xl bg-white p-4 text-sm shadow-card sm:p-6">
          <h3 className="mb-3 font-bold">Summa</h3>
          <dl className="space-y-1.5">
            <div className="flex justify-between"><dt className="text-muted">Mahsulotlar ({order.items_count})</dt><dd>{p(order.subtotal)}</dd></div>
            {order.discount_total > 0 && <div className="flex justify-between text-emerald-700"><dt>Chegirma {order.coupon_code && `(${order.coupon_code})`}</dt><dd>−{p(order.discount_total)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Yetkazib berish</dt><dd>{order.shipping_cost ? p(order.shipping_cost) : 'Bepul'}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Jami</dt><dd>{p(order.total)}</dd></div>
          </dl>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-card sm:p-6">
        <h3 className="mb-3 font-bold">Mahsulotlar</h3>
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg"><ProductImage src={i.image_url} alt={i.product_name} sizes="56px" /></div>
              <div className="min-w-0 flex-1">
                {i.slug ? <Link href={`/product/${i.slug}`} className="line-clamp-2 hover:text-brand">{i.product_name}</Link> : <p>{i.product_name}</p>}
                <p className="text-xs text-muted">{i.variant_name ? `${i.variant_name} · ` : ''}{p(i.unit_price)} × {i.quantity}</p>
              </div>
              <span className="font-semibold">{p(i.unit_price * i.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
