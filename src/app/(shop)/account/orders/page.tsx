import { getL } from '@/lib/i18n/server';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
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
  const L = await getL();
  const sp = await searchParams;
  const status = ORDER_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await getServerSupabase();
  const user = await requireUser('/account/orders');
  const [{ data }, settings, { data: statusRows }] = await Promise.all([
    supabase.rpc('my_orders', { p_status: status, p_limit: PAGE, p_offset: (page - 1) * PAGE }),
    getSettings(),
    supabase.from('orders').select('status').eq('user_id', user.id).limit(1000),
  ]);
  const result = (data ?? { items: [], total: 0 }) as { items: Row[]; total: number };
  // Faqat mijozda buyurtmasi bor holatlar (soni bilan); bitta holat boʻlsa — filtr umuman koʻrsatilmaydi.
  const counts = new Map<OrderStatus, number>();
  for (const r of (statusRows ?? []) as { status: OrderStatus }[]) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const used = ORDER_STATUSES.filter((s) => counts.has(s));
  const tabs: (OrderStatus | null)[] = used.length > 1 || (status && !counts.has(status)) ? [null, ...used] : [];

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">{L("Buyurtmalarim")}</h1>
      {tabs.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {tabs.map((s) => (
            <Link key={s ?? 'all'} href={s ? `?status=${s}` : '?'} className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium', status === s ? 'bg-primary text-primary-fg' : 'bg-surface text-ink-2 shadow-soft')}>
              {s ? L(orderStatusLabel[s]) : L("Barchasi")}
              <span className={cn('num text-[11px]', status === s ? 'text-primary-fg/80' : 'text-ink-3')}>{s ? counts.get(s) ?? 0 : statusRows?.length ?? 0}</span>
            </Link>
          ))}
        </div>
      )}
      {result.items.length === 0 ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title={L("Buyurtmalar yo‘q")} text={L("Bu yerda buyurtmalaringiz va ularning holati ko‘rinadi.")}
          action={<Link href="/catalog" className={buttonClass('primary')}>{L("Xarid qilish")}</Link>} />
      ) : (
        <ul className="space-y-3">
          {result.items.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-soft transition hover:shadow-pop">
                <div className="min-w-40 flex-1">
                  <p className="font-semibold">#{o.number} <Badge tone={orderStatusTone[o.status]} className="ml-1">{L(orderStatusLabel[o.status])}</Badge></p>
                  <p className="mt-0.5 text-xs text-ink-3">{formatDateTime(o.created_at)} · {o.items_count} dona · {o.payment_method_name}</p>
                </div>
                <div className="flex -space-x-2">
                  {o.images.map((img, i) => (
                    <div key={i} className="relative h-11 w-11 overflow-hidden rounded-lg border-2 border-white"><ProductImage src={img} alt="" sizes="44px" /></div>
                  ))}
                </div>
                <p className="font-semibold">{formatPrice(o.total, settings.localization.currency_symbol)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} total={result.total} pageSize={PAGE} makeHref={(p) => `?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />
    </div>
  );
}
