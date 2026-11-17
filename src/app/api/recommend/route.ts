import { NextResponse } from 'next/server';
import { getBoughtTogether, getSettings } from '@/lib/data/public';

export const dynamic = 'force-dynamic';

/** Savatcha uchun “Bunga qoʻshib oling”: savatdagi mahsulotlar bilan birga olinganlar. */
export async function GET(request: Request) {
  const settings = await getSettings();
  const rec = settings.recommendations;
  if (!rec.cart_enabled) return NextResponse.json({ title: '', items: [] });
  const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 30);
  if (!ids.length) return NextResponse.json({ title: rec.cart_title, items: [] });
  const items = await getBoughtTogether(ids, rec.together_limit, rec.fill_with_popular);
  return NextResponse.json({ title: rec.cart_title, items }, { headers: { 'cache-control': 'private, max-age=60' } });
}
