import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';

// Email tasdiqlash va parolni tiklash havolalari shu yerga qaytadi
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'), '/account');
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
