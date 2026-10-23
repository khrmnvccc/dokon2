import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { formatDateTime, formatPrice } from '@/lib/format';
import { formatUzPhone } from '@/lib/phone';
import { PrintButton } from '@/components/admin/print-button';
import type { Order, OrderItem } from '@/lib/types';

export const metadata = { title: 'Chop etish' };

/** Yetkazib berish varaqasi / chek (A4) */
export default async function PrintOrder({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('orders.read');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getServerSupabase();
  const [{ data: order }, { data: items }, settings] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', id).order('product_name'),
    getSettings(),
  ]);
  if (!order) notFound();
  const o = order as Order;
  const p = (v: number) => formatPrice(v, settings.localization.currency_symbol);
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm text-black print:p-0">
      <div className="no-print mb-6 flex justify-end"><PrintButton /></div>
      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <p className="text-2xl font-extrabold">{settings.store.name}</p>
          <p>{settings.contact.phone} {settings.contact.address && `· ${settings.contact.address}`}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">Buyurtma #{o.number}</p>
          <p>{formatDateTime(o.created_at)}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="font-bold">Qabul qiluvchi</p>
          <p>{o.customer_name}</p>
          <p>{formatUzPhone(o.customer_phone)}</p>
          {o.address && <p>{[o.address.region, o.address.city, o.address.street, o.address.apartment].filter(Boolean).join(', ')}</p>}
          {o.address?.landmark && <p>Mo‘ljal: {o.address.landmark}</p>}
        </div>
        <div>
          <p className="font-bold">Yetkazish va to‘lov</p>
          <p>{o.shipping_method_name}</p>
          <p>{o.payment_method_name}</p>
          {o.tracking_number && <p>Trek: {o.tracking_number}</p>}
          {o.comment && <p className="mt-1 italic">Izoh: {o.comment}</p>}
        </div>
      </div>
      <table className="mt-6 w-full border-collapse">
        <thead><tr className="border-b border-black text-left"><th className="py-1.5">#</th><th>Mahsulot</th><th className="text-right">Narx</th><th className="text-right">Soni</th><th className="text-right">Jami</th></tr></thead>
        <tbody>
          {((items ?? []) as OrderItem[]).map((i, n) => (
            <tr key={i.id} className="border-b border-slate-300">
              <td className="py-1.5">{n + 1}</td>
              <td>{i.product_name}{i.variant_name && ` (${i.variant_name})`}{i.sku && <span className="text-slate-500"> · {i.sku}</span>}</td>
              <td className="text-right">{p(i.unit_price)}</td>
              <td className="text-right">{i.quantity}</td>
              <td className="text-right">{p(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-4 w-64 space-y-1">
        <div className="flex justify-between"><span>Mahsulotlar</span><span>{p(o.subtotal)}</span></div>
        {o.discount_total > 0 && <div className="flex justify-between"><span>Chegirma</span><span>−{p(o.discount_total)}</span></div>}
        <div className="flex justify-between"><span>Yetkazib berish</span><span>{p(o.shipping_cost)}</span></div>
        <div className="flex justify-between border-t border-black pt-1 text-base font-bold"><span>Jami</span><span>{p(o.total)}</span></div>
      </div>
      <div className="mt-16 grid grid-cols-2 gap-10">
        <p className="border-t border-black pt-1">Topshirdi</p>
        <p className="border-t border-black pt-1">Qabul qildi</p>
      </div>
    </div>
  );
}
