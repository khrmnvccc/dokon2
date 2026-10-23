import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { loadProductForEdit } from '@/lib/admin/products';
import { formatDateTime } from '@/lib/format';
import { PageHeader, Panel, Table } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/product-form';

export const metadata = { title: 'Mahsulotni tahrirlash' };

const reasonLabel: Record<string, string> = { order: 'Buyurtma', cancel: 'Bekor qilish', return: 'Qaytarish', manual: 'Qo‘lda', import: 'Import', initial: 'Boshlang‘ich' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission('products.read');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const canWrite = ctx.permissions.has('products.write');
  const product = await loadProductForEdit(id, canWrite || ctx.permissions.has('reports.view'));
  if (!product) notFound();
  const supabase = await getServerSupabase();
  const [{ data: categories }, { data: movements }] = await Promise.all([
    supabase.from('categories').select('id, name, parent_id').order('sort_order').order('name'),
    supabase.from('inventory_movements').select('id, delta, stock_after, reason, note, created_at, variant_id').eq('product_id', id).order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <div>
      <PageHeader title={String(product.name)} back={{ href: '/admin/products', label: 'Mahsulotlar' }} description={canWrite ? undefined : 'Faqat ko‘rish rejimi'} />
      <fieldset disabled={!canWrite} className="contents">
        <ProductForm id={id} defaults={product} categories={categories ?? []} canStock={ctx.permissions.has('inventory.write')}
          canDelete={ctx.permissions.has('products.delete')} canSeeCost={canWrite || ctx.permissions.has('reports.view')} />
      </fieldset>
      {(movements ?? []).length > 0 && (
        <Panel title="Ombor harakati (oxirgi 20)" className="mt-4" padded={false}>
          <Table>
            <thead><tr><th>Sana</th><th>Sabab</th><th className="text-right">O‘zgarish</th><th className="text-right">Qoldiq</th><th>Izoh</th></tr></thead>
            <tbody>
              {(movements ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="text-muted">{formatDateTime(m.created_at)}</td>
                  <td>{reasonLabel[m.reason] ?? m.reason}</td>
                  <td className={`text-right tabular-nums font-semibold ${m.delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="text-right tabular-nums">{m.stock_after ?? '—'}</td>
                  <td className="text-muted">{m.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
