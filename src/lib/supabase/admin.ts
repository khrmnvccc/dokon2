import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

/**
 * Service role klient — RLS ni chetlab o'tadi. FAQAT serverda, tekshiruvlardan keyin ishlatiladi
 * (buyurtma yaratish, rate limit, kupon tekshiruvi). Hech qachon brauzerga chiqmaydi.
 */
export function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY sozlanmagan (.env.local ga qarang)');
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
