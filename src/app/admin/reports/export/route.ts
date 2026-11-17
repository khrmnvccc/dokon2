import { getStaffContext } from '@/lib/auth';
import { loadReports, reportRange } from '@/lib/admin/reports';
import { fileResponse, toCsv } from '@/lib/admin/spreadsheet';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('reports.view')) return new Response('Ruxsat yo‘q', { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const { from, to, g } = reportRange(sp);
  const { sales, products, categories, payments, customers, error } = await loadReports(from, to, g);
  if (error) return new Response('Hisobot xatosi', { status: 500 });
  const salesSheet = {
    columns: [
      { key: 'period', header: 'Davr', width: 12 }, { key: 'orders_count', header: 'Buyurtmalar' }, { key: 'items_sold', header: 'Dona' },
      { key: 'goods_revenue', header: 'Mahsulotlar', width: 14 }, { key: 'shipping', header: 'Yetkazish', width: 12 }, { key: 'discounts', header: 'Chegirma', width: 12 },
      { key: 'revenue', header: 'Tushum', width: 14 }, { key: 'cost_known', header: 'Tannarx', width: 14 }, { key: 'gross_profit', header: 'Yalpi foyda', width: 14 },
      { key: 'cancelled_count', header: 'Bekor' }, { key: 'returned_count', header: 'Qaytarilgan' },
    ],
    rows: sales.map((r) => ({ ...r })),
  };
  const name = `hisobot-${from}_${to}`;
  if (sp.format === 'csv') return fileResponse(toCsv(salesSheet), `${name}.csv`, 'csv');

  // Excel: ikki varaq — davrlar va mahsulotlar
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const add = (title: string, sheet: { columns: { key: string; header: string; width?: number }[]; rows: object[] }) => {
    const ws = wb.addWorksheet(title);
    ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 12 }));
    sheet.rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
  };
  // Xulosa varagʻi: asosiy koʻrsatkichlar
  const sum = (k: keyof (typeof sales)[number]) => sales.reduce((s, r) => s + Number(r[k]), 0);
  const revenue = sum('revenue'); const orders = sum('orders_count');
  add('Xulosa', {
    columns: [{ key: 'k', header: 'Koʻrsatkich', width: 30 }, { key: 'v', header: 'Qiymat', width: 20 }],
    rows: [
      { k: 'Davr', v: `${from} — ${to}` }, { k: 'Tushum (soʻm)', v: revenue }, { k: 'Buyurtmalar', v: orders },
      { k: 'Oʻrtacha chek (soʻm)', v: orders ? Math.round(revenue / orders) : 0 }, { k: 'Sotilgan dona', v: sum('items_sold') },
      { k: 'Yalpi foyda (soʻm)', v: sum('gross_profit') }, { k: 'Chegirmalar (soʻm)', v: sum('discounts') },
      { k: 'Yetkazish (soʻm)', v: sum('shipping') }, { k: 'Bekor qilingan', v: sum('cancelled_count') }, { k: 'Qaytarilgan', v: sum('returned_count') },
    ],
  });
  add('Davrlar', salesSheet);
  add('Mahsulotlar', {
    columns: [
      { key: 'product_name', header: 'Mahsulot', width: 40 }, { key: 'sku', header: 'SKU', width: 14 }, { key: 'quantity', header: 'Dona' },
      { key: 'revenue', header: 'Tushum', width: 14 }, { key: 'cost', header: 'Tannarx', width: 14 }, { key: 'gross_profit', header: 'Yalpi foyda', width: 14 },
    ],
    rows: products.map((r) => ({ ...r, product_name: /^[=+\-@]/.test(r.product_name) ? `'${r.product_name}` : r.product_name })),
  });
  const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
  add('Kategoriyalar', {
    columns: [{ key: 'category_name', header: 'Kategoriya', width: 30 }, { key: 'quantity', header: 'Dona' }, { key: 'revenue', header: 'Tushum', width: 14 }, { key: 'gross_profit', header: 'Yalpi foyda', width: 14 }],
    rows: categories.map((r) => ({ ...r, category_name: safe(r.category_name) })),
  });
  add('Toʻlov turlari', {
    columns: [{ key: 'payment_method_name', header: 'Toʻlov turi', width: 24 }, { key: 'orders_count', header: 'Buyurtmalar' }, { key: 'amount', header: 'Summa', width: 14 }, { key: 'paid_amount', header: 'Toʻlangan', width: 14 }],
    rows: payments.map((r) => ({ ...r, payment_method_name: safe(r.payment_method_name) })),
  });
  add('Mijozlar', {
    columns: [{ key: 'customer_name', header: 'Mijoz', width: 28 }, { key: 'customer_phone', header: 'Telefon', width: 16 }, { key: 'orders_count', header: 'Buyurtmalar' }, { key: 'amount', header: 'Summa', width: 14 }],
    rows: customers.map((r) => ({ ...r, customer_name: safe(r.customer_name) })),
  });
  wb.worksheets.forEach((ws) => { ws.views = [{ state: 'frozen', ySplit: 1 }]; });
  return fileResponse(Buffer.from(await wb.xlsx.writeBuffer()), `${name}.xlsx`, 'xlsx');
}
