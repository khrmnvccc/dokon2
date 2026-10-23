import 'server-only';
import ExcelJS from 'exceljs';

export type Cell = string | number | boolean | null | undefined;
export interface Sheet { columns: { key: string; header: string; width?: number }[]; rows: Record<string, Cell>[] }

/** Excel/CSV formula injection'dan himoya: matn =,+,-,@ bilan boshlansa ' qo'shiladi */
function safeText(v: Cell): Cell {
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
}

export function toCsv(sheet: Sheet): string {
  const esc = (v: Cell) => {
    const s = v === null || v === undefined ? '' : String(safeText(v));
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [sheet.columns.map((c) => esc(c.header)).join(',')];
  for (const row of sheet.rows) lines.push(sheet.columns.map((c) => esc(row[c.key])).join(','));
  // BOM — Excel UTF-8 (kirill, o‘) ni to'g'ri ochishi uchun
  return '﻿' + lines.join('\r\n');
}

export async function toXlsx(sheet: Sheet, title = 'Sheet1'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin panel';
  const ws = wb.addWorksheet(title);
  ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(10, c.header.length + 2) }));
  for (const row of sheet.rows) ws.addRow(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, safeText(v)])));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** RFC 4180 CSV parser (qo'shtirnoq, qatorlar ichidagi vergul/yangi qator). ; ajratuvchi ham qo'llanadi. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const values: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = r.getCell(c).value;
      const text =
        v === null || v === undefined ? '' :
        typeof v === 'object' && 'text' in v ? String(v.text) :
        typeof v === 'object' && 'result' in v ? String(v.result ?? '') :
        typeof v === 'object' && 'richText' in v ? v.richText.map((t) => t.text).join('') :
        v instanceof Date ? v.toISOString() : String(v);
      values.push(text);
    }
    rows.push(values);
  });
  return rows;
}

/** Sarlavha qatoridan obyektlar ro'yxatiga; ' prefiksi olib tashlanadi */
export function rowsToRecords(rows: string[][], headerMap: Record<string, string>): Record<string, string>[] {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => {
    const k = h.trim().toLowerCase();
    return headerMap[k] ?? k;
  });
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim().replace(/^'(?=[=+\-@])/, '')])));
}

export function fileResponse(body: string | Buffer, filename: string, type: 'csv' | 'xlsx') {
  return new Response(typeof body === 'string' ? body : new Uint8Array(body), {
    headers: {
      'content-type': type === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
