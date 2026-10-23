import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/** Joriy foydalanuvchi sessiyasi bilan ishlaydigan klient (RLS amal qiladi). */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component ichida cookie yozib bo'lmaydi; sessiya middleware'da yangilanadi.
        }
      },
    },
  });
}

/** Cookie'siz anonim klient: keshlanadigan ommaviy ma'lumotlar uchun (RLS amal qiladi). */
export function getPublicSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
