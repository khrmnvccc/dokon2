import { NextResponse } from 'next/server';
import { getPublicSupabase } from '@/lib/supabase/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { trackSchema } from '@/lib/validation';
import { getSettings } from '@/lib/data/public';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  // Trek raqami bilan (telefonsiz): faqat yuk bosqichlari, shaxsiy maʼlumot yoʻq. Kargo sozlamasida oʻchirsa boʻladi.
  if (body && typeof body.track === 'string') {
    const settings = await getSettings();
    if (!settings.cargo.enabled || !settings.cargo.track_by_number) return NextResponse.json({ error: 'Trek bilan kuzatish oʻchirilgan' }, { status: 403 });
    const track = body.track.trim();
    if (track.length < 4 || track.length > 80) return NextResponse.json({ error: 'Trek raqamini toʻgʻri kiriting' }, { status: 400 });
    if (!(await rateLimit(`track:${await getClientIp()}`, 10, 600))) {
      return NextResponse.json({ error: 'Juda ko‘p urinish. 10 daqiqadan so‘ng qayta urinib ko‘ring' }, { status: 429 });
    }
    const { data, error } = await getPublicSupabase().rpc('track_cargo', { p_track: track });
    if (error) return NextResponse.json({ error: 'Xatolik yuz berdi' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Bu trek raqami bilan buyurtma topilmadi' }, { status: 404 });
    return NextResponse.json({ order: data });
  }
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Ma’lumotlar noto‘g‘ri' }, { status: 400 });
  if (!(await rateLimit(`track:${await getClientIp()}`, 10, 600))) {
    return NextResponse.json({ error: 'Juda ko‘p urinish. 10 daqiqadan so‘ng qayta urinib ko‘ring' }, { status: 429 });
  }
  const { data, error } = await getPublicSupabase().rpc('track_order', { p_number: parsed.data.number, p_phone: parsed.data.phone });
  if (error) return NextResponse.json({ error: 'Xatolik yuz berdi' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Buyurtma topilmadi. Raqam va telefonni tekshiring' }, { status: 404 });
  return NextResponse.json({ order: data });
}
