'use server';

import { revalidatePath } from 'next/cache';
import { getStaffContext } from '@/lib/auth';
import { postProductToChannel, testChannel } from '@/lib/telegram/channel';
import type { ActionResult } from '@/lib/types';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Yuborib boʻlmadi');

export async function testChannelAction(chat: string): Promise<ActionResult> {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('messages.manage')) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  const c = chat.trim();
  if (!/^@[A-Za-z0-9_]{4,32}$|^-100\d{5,16}$/.test(c)) return { ok: false, error: 'Kanal manzili @kanal_nomi yoki -100… koʻrinishida boʻlsin' };
  try {
    const r = await testChannel(c);
    return { ok: true, message: `“${r.title}” kanaliga sinov xabari yuborildi` };
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
}

/** Mahsulot sahifasidagi “Kanalga yuborish”. */
export async function postProductAction(productId: string): Promise<ActionResult> {
  const ctx = await getStaffContext();
  if (!ctx?.permissions.has('products.write')) return { ok: false, error: 'Bu amal uchun ruxsat yo‘q' };
  try {
    await postProductToChannel(productId);
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: 'Kanalga yuborildi' };
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
}
