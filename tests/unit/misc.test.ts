import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { markdownToHtml } from '@/lib/markdown';
import { parseCatalogParams } from '@/lib/catalog-params';
import { ORDER_TRANSITIONS, ORDER_STATUSES } from '@/lib/order-status';
import { parseCsv, rowsToRecords, toCsv } from '@/lib/admin/spreadsheet';

describe('markdown xavfsizligi', () => {
  it('HTML va script ekranlanadi', () => {
    const html = markdownToHtml('<script>alert(1)</script> **qalin**');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<strong>qalin</strong>');
  });
  it('javascript: havolalari o‘chiriladi', () => {
    expect(markdownToHtml('[bos](javascript:alert(1))')).not.toContain('href');
    expect(markdownToHtml('[katalog](/catalog)')).toContain('href="/catalog"');
  });
  it('FAQ akkordeoni', () => {
    expect(markdownToHtml('### Savol?\nJavob', { accordion: true })).toContain('<details');
  });
});

describe('katalog parametrlari', () => {
  it('noto‘g‘ri qiymatlarni e’tiborsiz qoldiradi', () => {
    const { params, page } = parseCatalogParams({ sort: 'drop table', min: '-5', page: '0', rating: '9' });
    expect(params.sort).toBe('popular');
    expect(params.min_price).toBeUndefined();
    expect(page).toBe(1);
  });
  it('to‘g‘ri filtrlar', () => {
    const { params, page } = parseCatalogParams({ sort: 'price_asc', min: '1000', max: '50000', discount: '1', color: 'Qora,Oq', page: '3' });
    expect(params).toMatchObject({ sort: 'price_asc', min_price: 1000, max_price: 50000, discount: true, colors: ['Qora', 'Oq'] });
    expect(page).toBe(3);
  });
});

describe('buyurtma holatlari', () => {
  it('TypeScript va SQL dagi holat o‘tishlari bir xil', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261023000002_functions.sql'), 'utf8');
    const fn = sql.slice(sql.indexOf('function public.order_transition_allowed'));
    for (const from of ORDER_STATUSES) {
      const m = fn.match(new RegExp(`when '${from}' then p_to in \\(([^)]*)\\)`));
      const sqlTargets = m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]).sort() : [];
      expect([...ORDER_TRANSITIONS[from]].sort(), from).toEqual(sqlTargets);
    }
  });
});

describe('CSV', () => {
  it('qo‘shtirnoq, vergul va yangi qatorni to‘g‘ri o‘qiydi', () => {
    const rows = parseCsv('﻿sku,name,price\r\nA1,"Ko‘ylak, oq",100\nA2,"Ikki\nqator ""tirnoq""",200\n');
    expect(rows).toEqual([['sku', 'name', 'price'], ['A1', 'Ko‘ylak, oq', '100'], ['A2', 'Ikki\nqator "tirnoq"', '200']]);
  });
  it('nuqtali vergul ajratuvchini aniqlaydi', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('formula injection himoyasi va qayta o‘qish', () => {
    const csv = toCsv({ columns: [{ key: 'name', header: 'name' }], rows: [{ name: '=HYPERLINK("x")' }, { name: 'Oddiy' }] });
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    const recs = rowsToRecords(parseCsv(csv), {});
    expect(recs[0].name).toBe('=HYPERLINK("x")');
  });
});
