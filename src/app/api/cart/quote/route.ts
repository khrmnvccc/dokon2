import { NextResponse } from 'next/server';
import { quoteRequestSchema } from '@/lib/validation';
import { buildQuote } from '@/lib/checkout';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Savatcha ma’lumotlari noto‘g‘ri' }, { status: 400 });
  if (parsed.data.couponCode && !(await rateLimit(`coupon:${await getClientIp()}`, 20, 600))) {
    return NextResponse.json({ error: 'Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring' }, { status: 429 });
  }
  const { quote } = await buildQuote({
    items: parsed.data.items,
    couponCode: parsed.data.couponCode,
    shippingMethodId: parsed.data.shippingMethodId,
  });
  // Tannarx mijozga yuborilmaydi
  return NextResponse.json({ ...quote, costTotal: null, lines: quote.lines.map((l) => ({ ...l, costPrice: null })) });
}
