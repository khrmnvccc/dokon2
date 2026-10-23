import { getStaffContext } from '@/lib/auth';
import { loadReports, reportRange } from '@/lib/admin/reports';
import { fileResponse, toCsv } from '@/lib/admin/spreadsheet';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('reports.view')) return new Response('Ruxsat yo‘q', { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const { from, to, g } = reportRange(sp);
  const { sales, products, error } = await loadReports(from, to, g);
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
  add('Davrlar', salesSheet);
  add('Mahsulotlar', {
    columns: [
      { key: 'product_name', header: 'Mahsulot', width: 40 }, { key: 'sku', header: 'SKU', width: 14 }, { key: 'quantity', header: 'Dona' },
      { key: 'revenue', header: 'Tushum', width: 14 }, { key: 'cost', header: 'Tannarx', width: 14 }, { key: 'gross_profit', header: 'Yalpi foyda', width: 14 },
    ],
    rows: products.map((r) => ({ ...r, product_name: /^[=+\-@]/.test(r.product_name) ? `'${r.product_name}` : r.product_name })),
  });
  return fileResponse(Buffer.from(await wb.xlsx.writeBuffer()), `${name}.xlsx`, 'xlsx');
}
