import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { AppRole, Profile } from '@/lib/types';

export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile) ?? null;
});

export interface StaffContext {
  userId: string;
  email: string | null;
  roles: AppRole[];
  permissions: Set<string>;
}

/** Xodim konteksti: ruxsatlar bazadan (role_permissions) olinadi — yagona manba. */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await getServerSupabase();
  const [{ data: perms }, { data: roles }] = await Promise.all([supabase.rpc('my_permissions'), supabase.rpc('my_roles')]);
  if (!roles || !(roles as AppRole[]).length) return null;
  return { userId: user.id, email: user.email ?? null, roles: roles as AppRole[], permissions: new Set((perms as string[]) ?? []) };
});

export class ForbiddenError extends Error {
  constructor(message = 'Bu amal uchun ruxsat yo‘q') {
    super(message);
  }
}

/** Server action'lar ichida: ruxsat bo'lmasa xato tashlaydi. RLS esa bazada yana bir bor tekshiradi. */
export async function requirePermission(permission: string): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx || !ctx.permissions.has(permission)) throw new ForbiddenError();
  return ctx;
}

/** Sahifalar uchun: ruxsat bo'lmasa yo'naltiradi */
export async function requirePagePermission(permission: string): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect('/login?next=/admin');
  if (!ctx.permissions.has(permission)) redirect('/admin?denied=1');
  return ctx;
}

export async function requireUser(next = '/account') {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
