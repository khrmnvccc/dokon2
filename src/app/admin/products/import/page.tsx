import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { PageHeader, Panel } from '@/components/admin/ui';
import { ImportForm } from '@/components/admin/import-form';
import { PRODUCT_SHEET_COLUMNS } from '@/lib/admin/product-columns';

export const metadata = { title: 'Mahsulotlarni import qilish' };

export default async function ImportPage() {
  await requirePagePermission('products.write');
  return (
    <div className="max-w-4xl">
      <PageHeader title="Import (CSV / Excel)" back={{ href: '/admin/products', label: 'Mahsulotlar' }} />
      <div className="space-y-4">
        <Panel title="Qoidalar">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Birinchi qator — ustun nomlari. Eng oson yo‘l: avval <Link prefetch={false} className="text-brand underline" href="/admin/products/export?format=xlsx">Excel eksport</Link> qilib, shu faylni tahrirlang.</li>
            <li>Mahsulot <b>sku</b> bo‘yicha (bo‘lmasa <b>slug</b> bo‘yicha) topiladi: topilsa yangilanadi, topilmasa yaratiladi.</li>
            <li>Majburiy ustunlar: <code>name</code>, <code>price</code>. Bo‘sh katakdagi qiymat o‘zgartirilmaydi.</li>
            <li><code>category</code> — kategoriya slug yoki nomi. <code>is_active</code> va boshqa belgilar: 1/0.</li>
            <li>Qoldiq o‘zgarishi ombor tarixiga “Import” izohi bilan yoziladi. Variantli mahsulotlar qoldig‘i import qilinmaydi.</li>
            <li>Avval “Tekshirish” tugmasini bosing — hech narsa saqlanmaydi, faqat hisobot chiqadi.</li>
          </ul>
          <p className="mt-3 text-xs text-muted">Ustunlar: {PRODUCT_SHEET_COLUMNS.map((c) => c.key).join(', ')}</p>
        </Panel>
        <ImportForm />
      </div>
    </div>
  );
}
