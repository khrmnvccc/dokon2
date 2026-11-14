'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { dbErrorText, withPermission } from '@/lib/admin/action';
import { TAGS } from '@/lib/cache-tags';
import type { ActionResult } from '@/lib/types';

export async function setCustomerBlocked(userId: string, blocked: boolean, reason?: string): Promise<ActionResult> {
  return withPermission('customers.block', async (ctx) => {
    const parsed = z.object({ id: z.string().uuid(), reason: z.string().trim().max(300).optional() }).safeParse({ id: userId, reason });
    if (!parsed.success) return { ok: false, error: 'Noto‘g‘ri so‘rov' };
    if (userId === ctx.userId) return { ok: false, error: 'O‘zingizni bloklay olmaysiz' };
    const supabase = await getServerSupabase();
    if (!ctx.permissions.has('staff.manage')) {
      const { count } = await supabase.from('user_roles').select('role', { count: 'exact', head: true }).eq('user_id', userId);
      if (count) return { ok: false, error: 'Xodimni faqat super admin bloklashi mumkin' };
    }
    const { error } = await supabase.from('profiles').update({ is_blocked: blocked, blocked_reason: blocked ? parsed.data.reason || null : null }).eq('id', userId);
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidatePath(`/admin/customers/${userId}`);
    revalidatePath('/admin/customers');
    return { ok: true, message: blocked ? 'Mijoz bloklandi' : 'Blok olib tashlandi' };
  });
}

export async function moderateReview(id: string, action: 'approve' | 'hide' | 'delete'): Promise<ActionResult> {
  return withPermission('reviews.moderate', async () => {
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Noto‘g‘ri so‘rov' };
    const supabase = await getServerSupabase();
    const { error } = action === 'delete'
      ? await supabase.from('reviews').delete().eq('id', id)
      : await supabase.from('reviews').update({ is_approved: action === 'approve' }).eq('id', id);
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidateTag(TAGS.reviews);
    revalidateTag(TAGS.products);
    revalidatePath('/admin/reviews');
    return { ok: true, message: action === 'delete' ? 'Sharh o‘chirildi' : action === 'approve' ? 'Sharh ko‘rsatildi' : 'Sharh yashirildi' };
  });
}

/** Sharhga doʻkon nomidan javob (boʻsh — javobni oʻchirish). Mijozga bildirishnoma boradi. */
export async function replyReview(id: string, reply: string): Promise<ActionResult> {
  return withPermission('reviews.moderate', async () => {
    const parsed = z.object({ id: z.string().uuid(), reply: z.string().trim().max(2000, 'Juda uzun (2000 belgigacha)') }).safeParse({ id, reply });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Noto‘g‘ri so‘rov' };
    const text = parsed.data.reply || null;
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('reviews')
      .update({ reply: text, replied_at: text ? new Date().toISOString() : null })
      .eq('id', parsed.data.id).select('user_id, products(slug, name)').single();
    if (error) return { ok: false, error: dbErrorText(error) };
    const product = (Array.isArray(data.products) ? data.products[0] : data.products) as { slug: string; name: string } | null;
    if (text && data.user_id && product) {
      await getServiceSupabase().from('notifications').insert({
        user_id: data.user_id, type: 'review', title: 'Sharhingizga javob berildi', body: text.slice(0, 200), link: `/product/${product.slug}#reviews`,
      });
    }
    revalidateTag(TAGS.reviews);
    revalidatePath('/admin/reviews');
    if (product) revalidatePath(`/product/${product.slug}`);
    return { ok: true, message: text ? 'Javob saqlandi' : 'Javob oʻchirildi' };
  });
}

const roleSchema = z.object({ email: z.string().trim().toLowerCase().email('Email noto‘g‘ri'), role: z.enum(['super_admin', 'manager', 'operator', 'warehouse']), grant: z.boolean() });

/** Rol berish/olish. Tekshiruv (staff.manage, oxirgi super admin) bazadagi admin_set_role ichida. */
export async function setStaffRole(input: z.input<typeof roleSchema>): Promise<ActionResult> {
  return withPermission('staff.manage', async (ctx) => {
    const parsed = roleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Noto‘g‘ri so‘rov' };
    if (!parsed.data.grant && parsed.data.email === ctx.email?.toLowerCase() && parsed.data.role === 'super_admin') {
      return { ok: false, error: 'O‘zingizdan super admin rolini ololmaysiz' };
    }
    const supabase = await getServerSupabase();
    const { error } = await supabase.rpc('admin_set_role', { p_email: parsed.data.email, p_role: parsed.data.role, p_grant: parsed.data.grant });
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidatePath('/admin/staff');
    return { ok: true, message: parsed.data.grant ? 'Rol berildi' : 'Rol olib tashlandi' };
  });
}

const accessSchema = z.object({
  userId: z.string().uuid(),
  // null — rol boʻyicha standart ruxsatlar
  perms: z.array(z.string().regex(/^[a-z]+\.[a-z]+$/)).max(60).nullable(),
  // boʻsh — barcha filiallar
  branches: z.array(z.number().int().positive()).max(100),
});

/** Xodimning shaxsiy ruxsatlari va filiallari (kassa 3.2, 3.4). Tekshiruv bazadagi admin_set_staff_access ichida. */
export async function setStaffAccess(input: z.input<typeof accessSchema>): Promise<ActionResult> {
  return withPermission('staff.manage', async (ctx) => {
    const parsed = accessSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Notoʻgʻri soʻrov' };
    if (parsed.data.userId === ctx.userId) return { ok: false, error: 'Oʻz ruxsatlaringizni oʻzgartira olmaysiz' };
    const supabase = await getServerSupabase();
    const { error } = await supabase.rpc('admin_set_staff_access', {
      p_user: parsed.data.userId, p_perms: parsed.data.perms, p_branches: parsed.data.branches,
    });
    if (error) return { ok: false, error: dbErrorText(error) };
    revalidatePath('/admin/staff');
    return { ok: true, message: 'Ruxsatlar saqlandi' };
  });
}
