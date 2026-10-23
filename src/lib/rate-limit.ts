import 'server-only';
import { headers } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase/admin';

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

/**
 * Bazaga asoslangan rate limit (serverless muhitda ham ishlaydi).
 * true — ruxsat, false — limitdan oshdi.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('rateLimit: SUPABASE_SERVICE_ROLE_KEY yo‘q, cheklov o‘chirilgan');
    return true;
  }
  const { data, error } = await getServiceSupabase().rpc('check_rate_limit', {
    p_key: key.slice(0, 200),
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('rateLimit', error.message);
    return true;
  }
  return data === true;
}
