import { NextResponse, after } from 'next/server';
import { deliverDue } from '@/lib/telegram/broadcast';
import { getStaffContext } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Jonli yangilanish (kassa GET /version): admin panel buni har bir necha soniyada so'raydi,
 * raqam o'zgarsa joriy sahifa yangilanadi. Faqat xodimlar uchun.
 */
export async function GET() {
  const ctx = await getStaffContext();
  if (!ctx) return NextResponse.json({ error: 'Ruxsat yoʻq' }, { status: 403 });
  const supabase = await getServerSupabase();
  const [orders, products] = await Promise.all([
    ctx.permissions.has('orders.read')
      ? supabase.from('orders').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    ctx.permissions.has('products.read')
      ? supabase.from('products').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  // Rejalashtirilgan ommaviy xabarlar: panel ochiq turganda ham tekshiriladi (daqiqasiga bir marta).
  after(() => deliverDue().catch((e) => console.error('deliverDue', e)));
  const v = [orders.data?.updated_at, products.data?.updated_at].filter(Boolean).join('|');
  return NextResponse.json({ v }, { headers: { 'cache-control': 'no-store' } });
}
