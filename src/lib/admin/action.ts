import 'server-only';
import { ForbiddenError, requirePermission, type StaffContext } from '@/lib/auth';
import type { ActionResult } from '@/lib/types';

/** Postgres xatolarini foydalanuvchiga tushunarli matnga aylantirish */
export function dbErrorText(error: { code?: string; message?: string } | null | undefined, fallback = 'Saqlab bo‘lmadi'): string {
  if (!error) return fallback;
  const msg = error.message ?? '';
  if (error.code === '23505') {
    if (msg.includes('slug')) return 'Bu slug (URL) band. Boshqasini kiriting';
    if (msg.includes('sku')) return 'Bu SKU boshqa mahsulotda mavjud';
    if (msg.includes('code')) return 'Bu kod band';
    return 'Bunday yozuv allaqachon mavjud';
  }
  if (error.code === '23503') return 'Bu yozuv boshqa ma’lumotlarda ishlatilmoqda, o‘chirib bo‘lmaydi';
  if (error.code === '23514') return 'Qiymat ruxsat etilgan chegaradan tashqarida';
  if (error.code === '42501' || msg.includes('FORBIDDEN')) return 'Bu amal uchun ruxsat yo‘q';
  if (msg.includes('INVALID_TRANSITION')) return 'Bu holatga o‘tkazib bo‘lmaydi';
  if (msg.includes('LAST_SUPER_ADMIN')) return 'Oxirgi super adminni o‘chirib bo‘lmaydi';
  if (msg.includes('USER_NOT_FOUND')) return 'Bu email bilan foydalanuvchi topilmadi. Avval saytda ro‘yxatdan o‘tsin';
  console.error('db', error.code, msg);
  return fallback;
}

/** Ruxsatni tekshirib, xatolarni ActionResult ga o'giradi */
export async function withPermission<T>(perm: string, fn: (ctx: StaffContext) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const ctx = await requirePermission(perm);
    return await fn(ctx);
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    // redirect() va notFound() Next.js ichki xatolari qayta tashlanadi
    if (e && typeof e === 'object' && 'digest' in e) throw e;
    console.error(e);
    return { ok: false, error: 'Kutilmagan xatolik yuz berdi' };
  }
}
