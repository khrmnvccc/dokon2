import { NextResponse } from 'next/server';
import { quoteRequestSchema } from '@/lib/validation';
import { buildQuote } from '@/lib/checkout';
import { localizeCards } from '@/lib/data/public';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/auth';

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
    userId: parsed.data.couponCode ? (await getCurrentUser())?.id ?? null : null,
  });
  // Tannarx mijozga yuborilmaydi; nom joriy tilda (buyurtmaga esa asl nomi yoziladi)
  const named = await localizeCards(quote.lines.map((l) => ({ id: l.productId, name: l.name })));
  return NextResponse.json({ ...quote, costTotal: null, lines: quote.lines.map((l, i) => ({ ...l, name: named[i].name, costPrice: null })) });
}
