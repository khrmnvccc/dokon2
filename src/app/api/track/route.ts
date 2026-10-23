import { NextResponse } from 'next/server';
import { getPublicSupabase } from '@/lib/supabase/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { trackSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = trackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Ma’lumotlar noto‘g‘ri' }, { status: 400 });
  if (!(await rateLimit(`track:${await getClientIp()}`, 10, 600))) {
    return NextResponse.json({ error: 'Juda ko‘p urinish. 10 daqiqadan so‘ng qayta urinib ko‘ring' }, { status: 429 });
  }
  const { data, error } = await getPublicSupabase().rpc('track_order', { p_number: parsed.data.number, p_phone: parsed.data.phone });
  if (error) return NextResponse.json({ error: 'Xatolik yuz berdi' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Buyurtma topilmadi. Raqam va telefonni tekshiring' }, { status: 404 });
  return NextResponse.json({ order: data });
}
