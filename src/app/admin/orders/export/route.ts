import { getStaffContext } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { applyOrderFilters } from '@/lib/admin/orders';
import { fileResponse, toCsv, toXlsx } from '@/lib/admin/spreadsheet';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/order-status';
import { formatDateTime } from '@/lib/format';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('orders.read')) return new Response('Ruxsat yo‘q', { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const supabase = await getServerSupabase();
  const rows: Order[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await applyOrderFilters(supabase.from('orders').select('*'), sp).order('created_at', { ascending: false }).range(from, from + 999);
    if (error) return new Response('Eksport xatosi', { status: 500 });
    rows.push(...((data ?? []) as Order[]));
    if (!data || data.length < 1000) break;
  }
  const withCost = ctx.permissions.has('reports.view');
  const sheet = {
    columns: [
      { key: 'number', header: '№', width: 9 }, { key: 'date', header: 'Sana', width: 18 }, { key: 'status', header: 'Holat', width: 14 },
      { key: 'customer', header: 'Mijoz', width: 24 }, { key: 'phone', header: 'Telefon', width: 16 }, { key: 'address', header: 'Manzil', width: 40 },
      { key: 'items', header: 'Dona', width: 6 }, { key: 'subtotal', header: 'Mahsulotlar', width: 12 }, { key: 'discount', header: 'Chegirma', width: 10 },
      { key: 'shipping', header: 'Yetkazish', width: 10 }, { key: 'total', header: 'Jami', width: 12 },
      ...(withCost ? [{ key: 'cost', header: 'Tannarx', width: 12 }] : []),
      { key: 'payment', header: 'To‘lov usuli', width: 16 }, { key: 'payment_status', header: 'To‘lov holati', width: 12 },
      { key: 'shipping_method', header: 'Yetkazish usuli', width: 16 }, { key: 'coupon', header: 'Promo-kod', width: 10 },
    ],
    rows: rows.map((o) => ({
      number: o.number, date: formatDateTime(o.created_at), status: orderStatusLabel[o.status], customer: o.customer_name, phone: o.customer_phone,
      address: o.address ? [o.address.region, o.address.city, o.address.street, o.address.apartment].filter(Boolean).join(', ') : '',
      items: o.items_count, subtotal: o.subtotal, discount: o.discount_total, shipping: o.shipping_cost, total: o.total, cost: o.cost_total,
      payment: o.payment_method_name, payment_status: paymentStatusLabel[o.payment_status], shipping_method: o.shipping_method_name, coupon: o.coupon_code,
    })),
  };
  const date = new Date().toISOString().slice(0, 10);
  return sp.format === 'csv' ? fileResponse(toCsv(sheet), `buyurtmalar-${date}.csv`, 'csv') : fileResponse(await toXlsx(sheet, 'Buyurtmalar'), `buyurtmalar-${date}.xlsx`, 'xlsx');
}
