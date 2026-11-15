'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser, getCurrentProfile } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { TAGS } from '@/lib/cache-tags';
import { fieldErrors, profileSchema, reviewSchema, savedAddressSchema } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';
import { after } from 'next/server';
import { z } from 'zod';
import { addressSchema } from '@/lib/validation';
import { onDeliveryRequest } from '@/lib/telegram/events';

export async function submitReview(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sharh qoldirish uchun tizimga kiring' };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ma’lumotlar noto‘g‘ri', fieldErrors: fieldErrors(parsed.error) };
  if (!(await rateLimit(`review:${user.id}`, 5, 600))) return { ok: false, error: 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring' };

  const profile = await getCurrentProfile();
  if (profile?.is_blocked) return { ok: false, error: 'Hisobingiz bloklangan' };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from('reviews').insert({
    product_id: parsed.data.productId,
    user_id: user.id,
    author_name: profile?.full_name?.split(' ')[0] ?? 'Xaridor',
    rating: parsed.data.rating,
    body: parsed.data.body || null,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Siz bu mahsulotga allaqachon sharh qoldirgansiz' };
    return { ok: false, error: 'Sharhni saqlab bo‘lmadi' };
  }
  revalidateTag(TAGS.reviews);
  revalidateTag(TAGS.products);
  return { ok: true, message: 'Rahmat! Sharhingiz qo‘shildi' };
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Tizimga kiring' };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ma’lumotlar noto‘g‘ri', fieldErrors: fieldErrors(parsed.error) };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id);
  if (error) return { ok: false, error: 'Saqlab bo‘lmadi' };
  revalidatePath('/account');
  return { ok: true, message: 'Profil yangilandi' };
}

export async function saveAddress(input: unknown, id?: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Tizimga kiring' };
  const parsed = savedAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Ma’lumotlar noto‘g‘ri', fieldErrors: fieldErrors(parsed.error) };
  const supabase = await getServerSupabase();
  const data = { ...parsed.data, user_id: user.id, is_default: parsed.data.is_default ?? false };
  if (data.is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
  const { error } = id
    ? await supabase.from('addresses').update(data).eq('id', id).eq('user_id', user.id)
    : await supabase.from('addresses').insert(data);
  if (error) return { ok: false, error: 'Manzilni saqlab bo‘lmadi' };
  revalidatePath('/account/addresses');
  return { ok: true, message: 'Manzil saqlandi' };
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Tizimga kiring' };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: 'O‘chirib bo‘lmadi' };
  revalidatePath('/account/addresses');
  return { ok: true, message: 'Manzil o‘chirildi' };
}

export async function cancelMyOrder(orderId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Tizimga kiring' };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc('cancel_my_order', { p_order_id: orderId });
  if (error) {
    return { ok: false, error: error.message.includes('INVALID_TRANSITION') ? 'Buyurtma allaqachon qayta ishlanmoqda, bekor qilish uchun operatorga murojaat qiling' : 'Bekor qilib bo‘lmadi' };
  }
  revalidatePath('/account/orders');
  revalidatePath(`/account/orders/${orderId}`);
  revalidateTag(TAGS.products);
  return { ok: true, message: 'Buyurtma bekor qilindi' };
}

export async function markMyNotificationsRead(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Tizimga kiring' };
  const supabase = await getServerSupabase();
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  revalidatePath('/account');
  return { ok: true };
}

/** Profil → “Bildirishnomalar” va “Aksiya va kuponlar” tugmalari. */
export async function setMyPrefs(input: { notify_orders?: boolean; notify_promo?: boolean }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Tizimga kiring' };
  const patch: { notify_orders?: boolean; notify_promo?: boolean } = {};
  if (typeof input?.notify_orders === 'boolean') patch.notify_orders = input.notify_orders;
  if (typeof input?.notify_promo === 'boolean') patch.notify_promo = input.notify_promo;
  if (!Object.keys(patch).length) return { ok: false, error: 'Maʼlumot yoʻq' };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) return { ok: false, error: 'Saqlab boʻlmadi' };
  revalidatePath('/account');
  return { ok: true };
}

const fulfillmentSchema = z.discriminatedUnion('kind', [
  z.object({ orderId: z.string().uuid(), kind: z.literal('delivery'), methodId: z.string().uuid('Yetkazish usulini tanlang'), address: addressSchema }),
  z.object({ orderId: z.string().uuid(), kind: z.literal('pickup'), methodId: z.string().uuid('Olib ketish joyini tanlang') }),
]);

const FULFILLMENT_ERRORS: Record<string, string> = {
  NOT_ARRIVED: 'Buyurtma hali Oʻzbekistonga yetib kelmagan',
  ALREADY_APPROVED: 'Arizangiz allaqachon tasdiqlangan. Oʻzgartirish uchun bizga yozing',
  METHOD_UNAVAILABLE: 'Bu usul hozir mavjud emas',
  ADDRESS_REQUIRED: 'Manzilni toʻliq kiriting',
};

/** “Oʻzbekistonda” boʻlgan buyurtma: yetkazishga ariza yoki oʻzi olib ketish. */
export async function requestFulfillment(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Tizimga kiring' };
  const parsed = fulfillmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Maʼlumotlar notoʻgʻri', fieldErrors: fieldErrors(parsed.error) };
  if (!(await rateLimit(`fulfill:${user.id}`, 10, 600))) return { ok: false, error: 'Juda koʻp urinish. Birozdan soʻng qayta urinib koʻring' };
  const d = parsed.data;
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc('request_fulfillment', {
    p_order_id: d.orderId, p_kind: d.kind, p_method_id: d.methodId, p_address: d.kind === 'delivery' ? d.address : null,
  });
  if (error) {
    const code = Object.keys(FULFILLMENT_ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: code ? FULFILLMENT_ERRORS[code] : 'Arizani yuborib boʻlmadi' };
  }
  revalidatePath(`/account/orders/${d.orderId}`);
  after(() => onDeliveryRequest(d.orderId));
  return { ok: true, message: d.kind === 'delivery' ? 'Ariza yuborildi — tasdiqlanishini kuting' : 'Tanlovingiz yuborildi — tayyor boʻlganda xabar beramiz' };
}
