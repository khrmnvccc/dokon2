import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';

export interface Branch { id: number; name: string; is_active: boolean; sort_order: number }
export interface BranchState { all: Branch[]; mine: Branch[]; current: number }

export const BRANCH_COOKIE = 'dk_branch';

/**
 * Filiallar (kassa 3.4): sarlavhadagi tanlov qurilmada (cookie) eslab qolinadi.
 * current = 0 — "Barcha filiallar". Bitta filiali bor xodimda doim o'sha filial.
 */
export const getBranchState = cache(async (): Promise<BranchState> => {
  const supabase = await getServerSupabase();
  const [{ data: all }, { data: limited }] = await Promise.all([
    supabase.from('branches').select('id, name, is_active, sort_order').order('sort_order').order('id'),
    supabase.rpc('my_branches'),
  ]);
  const list = ((all ?? []) as Branch[]).filter((b) => b.is_active);
  const allowed = limited as number[] | null;
  const mine = allowed ? list.filter((b) => allowed.includes(b.id)) : list;
  const raw = Number((await cookies()).get(BRANCH_COOKIE)?.value ?? 0);
  let current = mine.some((b) => b.id === raw) ? raw : 0;
  if (mine.length === 1) current = mine[0].id;
  // Cheklangan xodim "Barcha filiallar"ni tanlasa, RLS baribir faqat o'z filiallarini qaytaradi.
  return { all: (all ?? []) as Branch[], mine, current };
});
