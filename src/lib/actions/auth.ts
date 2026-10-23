'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { emailSchema, fieldErrors, loginSchema, passwordSchema, registerSchema } from '@/lib/validation';
import { SITE_URL } from '@/lib/env';
import { safeNext } from '@/lib/safe-next';
import type { ActionResult } from '@/lib/types';

const TOO_MANY = 'Juda ko‘p urinish. 10 daqiqadan so‘ng qayta urinib ko‘ring';

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : SITE_URL;
}

export async function login(input: unknown, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ma’lumotlar noto‘g‘ri', fieldErrors: fieldErrors(parsed.error) };
  const ip = await getClientIp();
  if (!(await rateLimit(`login:${ip}`, 10, 600)) || !(await rateLimit(`login:${parsed.data.email}`, 8, 600))) {
    return { ok: false, error: TOO_MANY };
  }
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === 'email_not_confirmed') return { ok: false, error: 'Email tasdiqlanmagan. Pochtangizdagi havolani bosing' };
    return { ok: false, error: 'Email yoki parol noto‘g‘ri' };
  }
  return { ok: true, data: { redirectTo: safeNext(next) } };
}

export async function register(input: unknown, next?: string): Promise<ActionResult<{ redirectTo?: string; needsConfirmation?: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Formadagi xatolarni tuzating', fieldErrors: fieldErrors(parsed.error) };
  if (!(await rateLimit(`register:${await getClientIp()}`, 5, 3600))) return { ok: false, error: TOO_MANY };

  const supabase = await getServerSupabase();
  // Ro'yxatdan o'tish hech qachon xodim rolini bermaydi (handle_new_user faqat profil yaratadi)
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });
  if (error) {
    if (error.code === 'user_already_exists' || /already registered/i.test(error.message)) {
      return { ok: false, error: 'Bu email bilan hisob mavjud. Kirish sahifasidan foydalaning', fieldErrors: { email: 'Bu email band' } };
    }
    if (error.code === 'weak_password') return { ok: false, error: 'Parol juda oddiy', fieldErrors: { password: 'Kuchliroq parol tanlang' } };
    console.error('signUp', error.message);
    return { ok: false, error: 'Ro‘yxatdan o‘tib bo‘lmadi. Keyinroq urinib ko‘ring' };
  }
  if (!data.session) return { ok: true, data: { needsConfirmation: true }, message: 'Pochtangizga tasdiqlash havolasi yuborildi' };
  return { ok: true, data: { redirectTo: safeNext(next) } };
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Email noto‘g‘ri', fieldErrors: fieldErrors(parsed.error) };
  if (!(await rateLimit(`reset:${await getClientIp()}`, 5, 3600))) return { ok: false, error: TOO_MANY };
  const supabase = await getServerSupabase();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  // Email mavjudligini oshkor qilmaslik uchun har doim bir xil javob
  return { ok: true, message: 'Agar bu email ro‘yxatdan o‘tgan bo‘lsa, parolni tiklash havolasi yuborildi' };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ password: passwordSchema, password_confirm: z.string() })
    .refine((d) => d.password === d.password_confirm, { path: ['password_confirm'], message: 'Parollar mos emas' })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Formadagi xatolarni tuzating', fieldErrors: fieldErrors(parsed.error) };
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Havola eskirgan. Parolni tiklashni qaytadan so‘rang' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.code === 'same_password' ? 'Yangi parol eskisidan farq qilishi kerak' : 'Parolni yangilab bo‘lmadi' };
  return { ok: true, message: 'Parol yangilandi' };
}

export async function logout() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect('/');
}
