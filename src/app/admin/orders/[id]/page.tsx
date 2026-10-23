import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Printer } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { orderStatusLabel, orderStatusTone, paymentStatusLabel, ORDER_TRANSITIONS } from '@/lib/order-status';
import { Badge } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';
import { PageHeader, Panel, Table } from '@/components/admin/ui';
import { OrderControls } from '@/components/admin/order-controls';
import { ProductImage } from '@/components/shop/product-image';
import type { Order, OrderItem, OrderStatus } from '@/lib/types';

export const metadata = { title: 'Buyurtma' };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission('orders.read');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getServerSupabase();
  const [{ data: order }, { data: items }, { data: history }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', id).order('product_name'),
    supabase.from('order_status_history').select('id, status, note, created_at, changed_by').eq('order_id', id).order('created_at'),
  ]);
  if (!order) notFound();
  const o = order as Order;
  const p = (v: number) => formatPrice(v);
  const showCost = ctx.permissions.has('reports.view') && o.cost_total !== null;
  const can = (s: OrderStatus) =>
    ['cancelled', 'returned'].includes(s) ? ctx.permissions.has('orders.cancel') :
    ['confirmed', 'delivered'].includes(s) ? ctx.permissions.has('orders.write') :
    ctx.permissions.has('orders.write') || ctx.permissions.has('orders.fulfill');
  const nextStatuses = ORDER_TRANSITIONS[o.status].filter(can);

  // Mijozning oldingi buyurtmalari soni (firibgarlik/qayta xaridorni bilish uchun)
  const { count: phoneOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_phone', o.customer_phone);

  return (
    <div>
      <PageHeader
        title={`Buyurtma #${o.number}`}
        back={{ href: '/admin/orders', label: 'Buyurtmalar' }}
        description={<>{formatDateTime(o.created_at)} · <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></>}
        actions={<Link href={`/admin/orders/${o.id}/print`} target="_blank" className={buttonClass('outline', 'sm')}><Printer className="h-4 w-4" /> Chop etish</Link>}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-start">
        <div className="space-y-4">
          <Panel title={`Mahsulotlar (${o.items_count})`} padded={false}>
            <Table>
              <thead><tr><th>Mahsulot</th><th className="text-right">Narx</th><th className="text-right">Soni</th><th className="text-right">Chegirma</th><th className="text-right">Jami</th></tr></thead>
              <tbody>
                {((items ?? []) as OrderItem[]).map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg"><ProductImage src={i.image_url} alt="" sizes="44px" /></div>
                        <div>
                          {i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="font-medium hover:text-brand">{i.product_name}</Link> : <span className="font-medium">{i.product_name}</span>}
                          <p className="text-xs text-muted">{[i.variant_name, i.sku].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{p(i.unit_price)}{i.original_price > i.unit_price && <div className="text-xs text-muted line-through">{p(i.original_price)}</div>}</td>
                    <td className="text-right tabular-nums">{i.quantity}</td>
                    <td className="text-right tabular-nums">{i.discount ? `−${p(i.discount)}` : '—'}</td>
                    <td className="text-right font-semibold tabular-nums">{p(i.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <dl className="space-y-1.5 border-t border-line p-4 text-sm sm:px-5">
              <div className="flex justify-between"><dt className="text-muted">Mahsulotlar</dt><dd className="tabular-nums">{p(o.subtotal)}</dd></div>
              {o.discount_total > 0 && <div className="flex justify-between text-emerald-700"><dt>Chegirma {o.coupon_code && `(${o.coupon_code})`}</dt><dd className="tabular-nums">−{p(o.discount_total)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Yetkazib berish</dt><dd className="tabular-nums">{o.shipping_cost ? p(o.shipping_cost) : 'Bepul'}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>Jami</dt><dd className="tabular-nums">{p(o.total)}</dd></div>
              {showCost && <div className="flex justify-between text-xs text-muted"><dt>Tannarx / yalpi foyda</dt><dd className="tabular-nums">{p(o.cost_total!)} / {p(o.subtotal - o.discount_total - o.cost_total!)}</dd></div>}
            </dl>
          </Panel>
          <Panel title="Holat tarixi">
            <ol className="relative space-y-4 border-l-2 border-line pl-5">
              {(history ?? []).map((h) => (
                <li key={h.id}>
                  <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-brand" />
                  <p className="text-sm font-semibold">{orderStatusLabel[h.status as OrderStatus]}</p>
                  {h.note && <p className="text-sm text-slate-600">{h.note}</p>}
                  <p className="text-xs text-muted">{formatDateTime(h.created_at)}{h.changed_by ? '' : ' · tizim/mijoz'}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Boshqaruv">
            <OrderControls
              orderId={o.id}
              status={o.status}
              nextStatuses={nextStatuses}
              paymentStatus={o.payment_status}
              trackingNumber={o.tracking_number}
              adminNote={o.admin_note}
              canWrite={ctx.permissions.has('orders.write')}
              canFulfill={ctx.permissions.has('orders.write') || ctx.permissions.has('orders.fulfill')}
            />
          </Panel>
          <Panel title="Mijoz">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted">Ism</dt><dd className="font-medium">{o.customer_name}</dd></div>
              <div><dt className="text-xs text-muted">Telefon</dt><dd><a href={`tel:${o.customer_phone}`} className="font-medium text-brand">{formatUzPhone(o.customer_phone)}</a> <span className="text-xs text-muted">· {phoneOrders ?? 1} ta buyurtma</span></dd></div>
              {o.customer_email && <div><dt className="text-xs text-muted">Email</dt><dd>{o.customer_email}</dd></div>}
              <div><dt className="text-xs text-muted">Hisob</dt><dd>{o.user_id ? (ctx.permissions.has('customers.read') ? <Link className="text-brand" href={`/admin/customers/${o.user_id}`}>Profilni ochish</Link> : 'Ro‘yxatdan o‘tgan') : 'Mehmon'}</dd></div>
            </dl>
          </Panel>
          <Panel title="Yetkazib berish va to‘lov">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted">Usul</dt><dd>{o.shipping_method_name}</dd></div>
              {o.address && <div><dt className="text-xs text-muted">Manzil</dt><dd>{[o.address.region, o.address.city, o.address.street, o.address.apartment].filter(Boolean).join(', ')}{o.address.landmark && <span className="block text-muted">Mo‘ljal: {o.address.landmark}</span>}</dd></div>}
              <div><dt className="text-xs text-muted">To‘lov</dt><dd>{o.payment_method_name} · {paymentStatusLabel[o.payment_status]}</dd></div>
              {o.comment && <div><dt className="text-xs text-muted">Mijoz izohi</dt><dd className="rounded-lg bg-amber-50 p-2">{o.comment}</dd></div>}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
