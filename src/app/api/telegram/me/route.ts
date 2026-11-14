import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

// Mini-ilova raqam yuborilganini kutadi: joriy foydalanuvchining telefoni saqlandimi va ID raqami.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data } = await supabase.from('profiles').select('phone, client_no').eq('id', user.id).maybeSingle();
  return NextResponse.json({ ok: true, hasPhone: Boolean(data?.phone), clientNo: data?.client_no ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
