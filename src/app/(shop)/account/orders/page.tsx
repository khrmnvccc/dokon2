import Link from 'next/link';
import { Package } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data/public';
import { formatDateTime, formatPrice } from '@/lib/format';
import { ORDER_STATUSES, orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import { Badge, EmptyState, Pagination } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { ProductImage } from '@/components/shop/product-image';
import type { OrderStatus } from '@/lib/types';

const PAGE = 10;
interface Row { id: string; number: number; status: OrderStatus; total: number; items_count: number; created_at: string; payment_method_name: string; images: string[] }

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = ORDER_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await getServerSupabase();
  const [{ data }, settings] = await Promise.all([
    supabase.rpc('my_orders', { p_status: status, p_limit: PAGE, p_offset: (page - 1) * PAGE }),
    getSettings(),
  ]);
  const result = (data ?? { items: [], total: 0 }) as { items: Row[]; total: number };
  const tabs: (OrderStatus | null)[] = [null, 'new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">Buyurtmalarim</h1>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {tabs.map((s) => (
          <Link key={s ?? 'all'} href={s ? `?status=${s}` : '?'} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium', status === s ? 'bg-brand text-white' : 'bg-white text-slate-600 shadow-card')}>
            {s ? orderStatusLabel[s] : 'Barchasi'}
          </Link>
        ))}
      </div>
      {result.items.length === 0 ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title="Buyurtmalar yo‘q" text="Bu yerda buyurtmalaringiz va ularning holati ko‘rinadi."
          action={<Link href="/catalog" className={buttonClass('primary')}>Xarid qilish</Link>} />
      ) : (
        <ul className="space-y-3">
          {result.items.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-card transition hover:shadow-pop">
                <div className="min-w-40 flex-1">
                  <p className="font-semibold">#{o.number} <Badge tone={orderStatusTone[o.status]} className="ml-1">{orderStatusLabel[o.status]}</Badge></p>
                  <p className="mt-0.5 text-xs text-muted">{formatDateTime(o.created_at)} · {o.items_count} dona · {o.payment_method_name}</p>
                </div>
                <div className="flex -space-x-2">
                  {o.images.map((img, i) => (
                    <div key={i} className="relative h-11 w-11 overflow-hidden rounded-lg border-2 border-white"><ProductImage src={img} alt="" sizes="44px" /></div>
                  ))}
                </div>
                <p className="font-bold">{formatPrice(o.total, settings.localization.currency_symbol)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} total={result.total} pageSize={PAGE} makeHref={(p) => `?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />
    </div>
  );
}
