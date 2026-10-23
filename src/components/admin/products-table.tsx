'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bulkUpdateProducts, deleteProducts } from '@/lib/actions/admin/products';
import { formatPrice } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { ProductImage } from '@/components/shop/product-image';
import { Table, EmptyRow, inputSm } from './ui';

export interface AdminProductRow {
  id: string; name: string; slug: string; sku: string | null; price: number; compare_at_price: number | null; stock: number;
  low_stock_threshold: number; track_stock: boolean; has_variants: boolean; is_active: boolean; is_featured: boolean;
  is_bestseller: boolean; is_new: boolean; image_url: string | null; sold_count: number; category_name: string | null;
}

export function ProductsTable({ rows, categories, canWrite, canDelete }: { rows: AdminProductRow[]; categories: { id: string; name: string }[]; canWrite: boolean; canDelete: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState('');
  const [param, setParam] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = async () => {
    const ids = [...selected];
    if (!ids.length || !action) return;
    if (action === 'delete') {
      if (!(await confirm({ title: `${ids.length} ta mahsulotni o‘chirish?`, text: 'Mahsulot buyurtmalar tarixida nomi bilan saqlanib qoladi. Bu amalni qaytarib bo‘lmaydi.', danger: true, confirmText: 'O‘chirish' }))) return;
    }
    start(async () => {
      const res =
        action === 'delete' ? await deleteProducts(ids) :
        action === 'category' ? await bulkUpdateProducts({ ids, action, category_id: param || null }) :
        action === 'price_percent' ? await bulkUpdateProducts({ ids, action, percent: Number(param) }) :
        action.startsWith('flag:') ? await bulkUpdateProducts({ ids, action: action.endsWith(':on') ? 'flag_on' : 'flag_off', flag: param as 'is_new' }) :
        await bulkUpdateProducts({ ids, action: action as 'activate' });
      toast(res.ok ? res.message ?? 'Bajarildi' : res.error, res.ok ? 'success' : 'error');
      if (res.ok) setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {canWrite && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-50 px-4 py-2.5 text-sm">
          <b>{selected.size} ta tanlandi</b>
          <select value={action} onChange={(e) => { setAction(e.target.value); setParam(''); }} className={`${inputSm} h-9`} aria-label="Ommaviy amal">
            <option value="">Amalni tanlang…</option>
            <option value="activate">Faollashtirish</option>
            <option value="deactivate">Yashirish</option>
            <option value="category">Kategoriyani o‘zgartirish</option>
            <option value="price_percent">Narxni % ga o‘zgartirish</option>
            <option value="flag:on">Belgi qo‘yish</option>
            <option value="flag:off">Belgini olib tashlash</option>
            {canDelete && <option value="delete">O‘chirish</option>}
          </select>
          {action === 'category' && (
            <select value={param} onChange={(e) => setParam(e.target.value)} className={`${inputSm} h-9`} aria-label="Kategoriya">
              <option value="">Kategoriyasiz</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {action === 'price_percent' && <input value={param} onChange={(e) => setParam(e.target.value)} type="number" placeholder="+10 yoki -15" className={`${inputSm} h-9 w-32`} aria-label="Foiz" />}
          {action.startsWith('flag:') && (
            <select value={param} onChange={(e) => setParam(e.target.value)} className={`${inputSm} h-9`} aria-label="Belgi">
              <option value="">Belgi…</option><option value="is_featured">Tavsiya</option><option value="is_bestseller">Xit</option><option value="is_new">Yangi</option>
            </select>
          )}
          <Button size="sm" onClick={run} loading={pending} disabled={!action || ((action === 'price_percent' || action.startsWith('flag:')) && !param)}>Qo‘llash</Button>
          <button className="ml-auto text-muted hover:text-ink" onClick={() => setSelected(new Set())}>Bekor qilish</button>
        </div>
      )}
      <Table>
        <thead>
          <tr>
            {canWrite && <th className="w-10"><input type="checkbox" aria-label="Hammasini tanlash" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>}
            <th>Mahsulot</th><th>Kategoriya</th><th className="text-right">Narx</th><th className="text-right">Qoldiq</th><th className="text-right">Sotilgan</th><th>Holat</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={7} />}
          {rows.map((p) => {
            const low = p.track_stock && p.stock <= p.low_stock_threshold;
            return (
              <tr key={p.id}>
                {canWrite && <td><input type="checkbox" aria-label={`${p.name} ni tanlash`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>}
                <td>
                  <div className="flex items-center gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg"><ProductImage src={p.image_url} alt="" sizes="44px" /></div>
                    <div className="min-w-0">
                      <Link href={`/admin/products/${p.id}`} className="line-clamp-1 font-medium hover:text-brand">{p.name}</Link>
                      <p className="text-xs text-muted">{p.sku ?? 'SKU yo‘q'}{p.has_variants ? ' · variantli' : ''}</p>
                    </div>
                  </div>
                </td>
                <td className="text-muted">{p.category_name ?? '—'}</td>
                <td className="text-right tabular-nums">
                  {formatPrice(p.price)}
                  {p.compare_at_price ? <div className="text-xs text-muted line-through">{formatPrice(p.compare_at_price)}</div> : null}
                </td>
                <td className={`text-right tabular-nums ${p.track_stock && p.stock <= 0 ? 'font-semibold text-red-600' : low ? 'font-semibold text-amber-600' : ''}`}>{p.track_stock ? p.stock : '∞'}</td>
                <td className="text-right tabular-nums">{p.sold_count}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {p.is_active ? <Badge tone="green">Faol</Badge> : <Badge>Yashirin</Badge>}
                    {p.is_featured && <Badge tone="violet">Tavsiya</Badge>}
                    {p.is_bestseller && <Badge tone="amber">Xit</Badge>}
                    {p.is_new && <Badge tone="blue">Yangi</Badge>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
