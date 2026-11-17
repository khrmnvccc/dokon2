import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { buildHref, likeTerm, pageParam } from '@/lib/admin/query';
import { formatDateTime } from '@/lib/format';
import { Pagination } from '@/components/ui/misc';
import { PageHeader, Panel, FilterBar, FilterField, Table, EmptyRow, inputSm } from '@/components/admin/ui';
import { StockEditor } from '@/components/admin/stock-editor';
import { StockSettings } from '@/components/admin/stock-settings';
import { parseSettings } from '@/lib/settings-schema';

export const metadata = { title: 'Ombor' };
const PAGE = 40;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string; page?: string }> }) {
  const ctx = await requirePagePermission('inventory.write');
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await getServerSupabase();
  let q = supabase.from('products').select('id, name, sku, stock, low_stock_threshold, track_stock, has_variants, product_variants(id, name, sku, stock, is_active)', { count: 'exact' }).eq('track_stock', true);
  if (sp.q) { const t = likeTerm(sp.q); q = q.or(`name.ilike.${t},sku.ilike.${t}`); }
  // "Kam qoldiq": PostgREST ustunlarni o'zaro solishtira olmaydi — avval taxminiy, keyin aniq filtr
  if (sp.low) q = q.lte('stock', 50);
  const [{ data, count }, { data: movements }, { data: setRows }, { data: waiting }] = await Promise.all([
    q.order('stock').range((page - 1) * PAGE, page * PAGE - 1),
    supabase.from('inventory_movements').select('id, delta, stock_after, reason, note, created_at, products(name)').order('created_at', { ascending: false }).limit(15),
    supabase.from('site_settings').select('key, value').eq('key', 'stock_alerts'),
    supabase.from('stock_alerts').select('product_id, products(name)').is('notified_at', null).limit(2000),
  ]);
  // “Kelganda xabar ber” — qaysi mahsulotni nechta mijoz kutyapti
  const waitMap = new Map<string, { name: string; n: number }>();
  for (const w of waiting ?? []) {
    const name = (Array.isArray(w.products) ? w.products[0] : w.products as { name: string } | null)?.name ?? '—';
    const cur = waitMap.get(w.product_id as string) ?? { name, n: 0 };
    waitMap.set(w.product_id as string, { name, n: cur.n + 1 });
  }
  const waitList = [...waitMap].sort((a, b) => b[1].n - a[1].n).slice(0, 15);
  const rows = (data ?? []).filter((p) => !sp.low || p.stock <= p.low_stock_threshold);
  return (
    <div>
      <PageHeader title="Ombor" description="Qoldiqni tez tahrirlash. Har bir o‘zgarish tarixga yoziladi." />
      <FilterBar resetHref="/admin/inventory">
        <FilterField label="Qidiruv"><input name="q" defaultValue={sp.q} placeholder="Nomi yoki SKU" className={`${inputSm} w-56`} /></FilterField>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="low" value="1" defaultChecked={Boolean(sp.low)} /> Faqat kam qoldiq</label>
      </FilterBar>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <Table>
            <thead><tr><th>Mahsulot / variant</th><th>SKU</th><th className="text-right">Chegara</th><th>Qoldiq</th></tr></thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={4} />}
              {rows.flatMap((p) => {
                const variants = (p.product_variants ?? []) as { id: string; name: string; sku: string | null; stock: number; is_active: boolean }[];
                if (!p.has_variants) {
                  return [(
                    <tr key={p.id}>
                      <td><Link href={`/admin/products/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link></td>
                      <td className="text-ink-3">{p.sku ?? '—'}</td>
                      <td className="text-right text-ink-3">{p.low_stock_threshold}</td>
                      <td><StockEditor productId={p.id} variantId={null} stock={p.stock} low={p.stock <= p.low_stock_threshold} /></td>
                    </tr>
                  )];
                }
                return variants.map((v) => (
                  <tr key={v.id}>
                    <td><Link href={`/admin/products/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link> <span className="text-ink-3">· {v.name}</span>{!v.is_active && <span className="text-xs text-ink-3"> (nofaol)</span>}</td>
                    <td className="text-ink-3">{v.sku ?? '—'}</td>
                    <td className="text-right text-ink-3">{p.low_stock_threshold}</td>
                    <td><StockEditor productId={p.id} variantId={v.id} stock={v.stock} low={v.stock <= p.low_stock_threshold} /></td>
                  </tr>
                ));
              })}
            </tbody>
          </Table>
        </div>
        <div className="grid gap-4">
        <StockSettings initial={parseSettings(setRows ?? []).stock_alerts} canEdit={ctx.permissions.has('settings.write')} />
        <Panel title="Kelishini kutishyapti" subtitle="“Kelganda xabar ber” bosgan mijozlar">
          {waitList.length ? (
            <ul className="space-y-2 text-sm">
              {waitList.map(([id, w]) => (
                <li key={id} className="flex justify-between gap-2">
                  <Link href={`/admin/products/${id}`} className="min-w-0 truncate hover:text-primary">{w.name}</Link>
                  <span className="shrink-0 font-semibold tabular-nums">{w.n} kishi</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-3">Hozircha hech kim kutmayapti.</p>}
        </Panel>
        <Panel title="Oxirgi harakatlar">
          <ul className="space-y-2.5 text-sm">
            {(movements ?? []).map((m) => (
              <li key={m.id} className="flex justify-between gap-2">
                <span className="min-w-0"><span className="block truncate">{(Array.isArray(m.products) ? m.products[0] : m.products as { name: string } | null)?.name}</span><span className="text-xs text-ink-3">{formatDateTime(m.created_at)} · {m.note ?? m.reason}</span></span>
                <span className={`shrink-0 font-semibold tabular-nums ${m.delta < 0 ? 'text-danger' : 'text-success'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
              </li>
            ))}
          </ul>
        </Panel>
        </div>
      </div>
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} makeHref={(p) => buildHref('/admin/inventory', sp, { page: p })} />
    </div>
  );
}
