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
import { ReceiptReview } from '@/components/admin/receipt-review';
import { FulfillmentReview } from '@/components/admin/fulfillment-review';
import { getReceiptsForStaff, methodCard } from '@/lib/payments/receipts';
import { ProductImage } from '@/components/shop/product-image';
import { CargoOrderControl } from '@/components/admin/cargo-ui';
import { getRawSettings } from '@/lib/data/public';
import { getServiceSupabase } from '@/lib/supabase/admin';
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
  const { data: pickupPoint } = o.fulfillment === 'pickup' && o.shipping_method_id
    ? await supabase.from('shipping_methods').select('pickup_address, description, work_hours, map_url').eq('id', o.shipping_method_id).maybeSingle()
    : { data: null };
  const { count: phoneOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_phone', o.customer_phone);
  // Kartaga oʻtkazma: chek rasmlari (yopiq bucket, 10 daqiqalik havola)
  const card = process.env.SUPABASE_SERVICE_ROLE_KEY ? await methodCard(o.payment_method_id ?? null).catch(() => null) : null;
  const receipts = card ? await getReceiptsForStaff(o.id).catch(() => []) : [];
  // Kargo bosqichlari va onlayn toʻlov tranzaksiyalari (Click / Payme)
  const settings = await getRawSettings();
  const cargo = settings.cargo;
  const { data: cargoEvents } = await supabase.from('cargo_events').select('id, stage, note, created_at').eq('order_id', o.id).order('created_at');
  const { data: txs } = process.env.SUPABASE_SERVICE_ROLE_KEY && o.payment_provider
    ? await getServiceSupabase().from('payment_transactions').select('id, provider, ext_id, amount, state, created_at').eq('order_id', o.id).order('created_at')
    : { data: null };
  const TX_STATE: Record<number, string> = { 1: 'kutilmoqda', 2: 'toʻlandi', [-1]: 'bekor qilindi', [-2]: 'qaytarildi' };
  const stageLabel = (k: string) => cargo.stages.find((s) => s.key === k)?.label ?? k;
  const showCargo = cargo.enabled && !['cancelled', 'returned', 'new'].includes(o.status);

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
                          {i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="font-medium hover:text-primary">{i.product_name}</Link> : <span className="font-medium">{i.product_name}</span>}
                          <p className="text-xs text-ink-3">{[i.variant_name, i.sku].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{p(i.unit_price)}{i.original_price > i.unit_price && <div className="text-xs text-ink-3 line-through">{p(i.original_price)}</div>}</td>
                    <td className="text-right tabular-nums">{i.quantity}</td>
                    <td className="text-right tabular-nums">{i.discount ? `−${p(i.discount)}` : '—'}</td>
                    <td className="text-right font-semibold tabular-nums">{p(i.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <dl className="space-y-1.5 border-t border-line p-4 text-sm sm:px-5">
              <div className="flex justify-between"><dt className="text-ink-3">Mahsulotlar</dt><dd className="tabular-nums">{p(o.subtotal)}</dd></div>
              {o.discount_total > 0 && <div className="flex justify-between text-success"><dt>Chegirma {o.coupon_code && `(${o.coupon_code})`}</dt><dd className="tabular-nums">−{p(o.discount_total)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-3">Yetkazib berish</dt><dd className="tabular-nums">{o.shipping_cost ? p(o.shipping_cost) : 'Bepul'}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Jami</dt><dd className="tabular-nums">{p(o.total)}</dd></div>
              {showCost && <div className="flex justify-between text-xs text-ink-3"><dt>Tannarx / yalpi foyda</dt><dd className="tabular-nums">{p(o.cost_total!)} / {p(o.subtotal - o.discount_total - o.cost_total!)}</dd></div>}
            </dl>
          </Panel>
          <Panel title="Holat tarixi">
            <ol className="relative space-y-4 border-l-2 border-line pl-5">
              {(history ?? []).map((h) => (
                <li key={h.id}>
                  <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary" />
                  <p className="text-sm font-semibold">{orderStatusLabel[h.status as OrderStatus]}</p>
                  {h.note && <p className="text-sm text-ink-2">{h.note}</p>}
                  <p className="text-xs text-ink-3">{formatDateTime(h.created_at)}{h.changed_by ? '' : ' · tizim/mijoz'}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="space-y-4">
          {card && (
            <Panel title="Toʻlov cheki">
              <ReceiptReview orderId={o.id} card={card} receipts={receipts} paid={o.payment_status === 'paid'} canWrite={ctx.permissions.has('orders.write')} />
            </Panel>
          )}
          {o.fulfillment ? (
            <Panel title={o.fulfillment === 'pickup' ? 'Olib ketish' : 'Yetkazish arizasi'}>
              <FulfillmentReview orderId={o.id} canApprove={ctx.permissions.has('orders.write') || ctx.permissions.has('orders.fulfill')} info={{
                kind: o.fulfillment, status: o.fulfillment_status ?? null, method: o.shipping_method_name, fee: Number(o.delivery_fee ?? 0), requestedAt: o.fulfillment_requested_at ?? null,
                address: o.fulfillment === 'pickup' ? (pickupPoint?.pickup_address || pickupPoint?.description || '') : o.address ? [o.address.region, o.address.city, o.address.street, o.address.apartment, o.address.landmark].filter(Boolean).join(', ') : '',
                hours: pickupPoint?.work_hours ?? null, mapUrl: pickupPoint?.map_url ?? null,
              }} />
            </Panel>
          ) : o.status === 'arrived' ? (
            <Panel title="Yetkazish arizasi">
              <p className="text-sm text-ink-3">Mijoz hali tanlamadi: yetkazishga ariza qoldiradi yoki oʻzi olib ketadi. Unga botda xabar yuborilgan.</p>
            </Panel>
          ) : null}
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
          {showCargo && (
            <Panel title="Kargo: yuk qayerda">
              {ctx.permissions.has('orders.write') && <CargoOrderControl orderId={o.id} stages={cargo.stages} current={o.cargo_stage ?? null} />}
              {(cargoEvents ?? []).length > 0 && (
                <ol className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
                  {(cargoEvents ?? []).map((e) => (
                    <li key={e.id} className="flex justify-between gap-2"><span>{stageLabel(e.stage)}{e.note && <span className="block text-xs text-ink-3">{e.note}</span>}</span><span className="shrink-0 text-xs text-ink-3">{formatDateTime(e.created_at)}</span></li>
                  ))}
                </ol>
              )}
              {!o.tracking_number && <p className="mt-2 text-xs text-ink-3">Trek raqamini “Boshqaruv”da kiriting — mijoz u bilan kuzata oladi.</p>}
            </Panel>
          )}
          {txs && txs.length > 0 && (
            <Panel title="Onlayn toʻlov">
              <ul className="space-y-1.5 text-sm">
                {txs.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span>{t.provider === 'click' ? 'Click' : 'Payme'} · {formatPrice(Number(t.amount))}<span className="block font-mono text-xs text-ink-3">{t.ext_id}</span></span>
                    <span className="shrink-0 text-xs">{TX_STATE[t.state as number] ?? t.state}<span className="block text-ink-3">{formatDateTime(t.created_at)}</span></span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Mijoz">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ink-3">Ism</dt><dd className="font-medium">{o.customer_name}</dd></div>
              <div><dt className="text-xs text-ink-3">Telefon</dt><dd><a href={`tel:${o.customer_phone}`} className="font-medium text-primary">{formatUzPhone(o.customer_phone)}</a> <span className="text-xs text-ink-3">· {phoneOrders ?? 1} ta buyurtma</span></dd></div>
              {o.customer_email && <div><dt className="text-xs text-ink-3">Email</dt><dd>{o.customer_email}</dd></div>}
              <div><dt className="text-xs text-ink-3">Hisob</dt><dd>{o.user_id ? (ctx.permissions.has('customers.read') ? <Link className="text-primary" href={`/admin/customers/${o.user_id}`}>Profilni ochish</Link> : 'Ro‘yxatdan o‘tgan') : 'Mehmon'}</dd></div>
            </dl>
          </Panel>
          <Panel title="Yetkazib berish va to‘lov">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ink-3">Usul</dt><dd>{o.shipping_method_name}</dd></div>
              {o.address && <div><dt className="text-xs text-ink-3">Manzil</dt><dd>{[o.address.region, o.address.city, o.address.street, o.address.apartment].filter(Boolean).join(', ')}{o.address.landmark && <span className="block text-ink-3">Mo‘ljal: {o.address.landmark}</span>}</dd></div>}
              <div><dt className="text-xs text-ink-3">To‘lov</dt><dd>{o.payment_method_name} · {paymentStatusLabel[o.payment_status]}</dd></div>
              {o.comment && <div><dt className="text-xs text-ink-3">Mijoz izohi</dt><dd className="rounded-lg bg-warn-soft p-2">{o.comment}</dd></div>}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
