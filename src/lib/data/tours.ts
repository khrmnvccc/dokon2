import 'server-only';
import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { DEFAULT_TOURS, cleanTours, type Tours } from '@/lib/tours';

/** Yoʻl-yoʻriq matnlari (app_meta 'tours'). Ommaviy maʼlumot, 5 daqiqa keshlanadi; saqlanganda 'tours' tegi tozalanadi. */
export const getTours = unstable_cache(async (): Promise<Tours> => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return DEFAULT_TOURS;
  try {
    const { data } = await getServiceSupabase().from('app_meta').select('value').eq('key', 'tours').maybeSingle();
    return data?.value ? cleanTours(data.value) : DEFAULT_TOURS;
  } catch {
    return DEFAULT_TOURS;
  }
}, ['tours-v1'], { tags: ['tours'], revalidate: 300 });
