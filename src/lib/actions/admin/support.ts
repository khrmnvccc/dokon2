'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withPermission } from '@/lib/admin/action';
import { replyToCustomer } from '@/lib/telegram/shop-bot';
import type { ActionResult } from '@/lib/types';

const schema = z.object({ chatId: z.number().int(), text: z.string().trim().min(1, 'Javob yozing').max(3500, 'Juda uzun') });

/** Murojaatga javob: doʻkon boti orqali mijozning Telegramiga. */
export async function replySupport(chatId: number, text: string): Promise<ActionResult> {
  return withPermission('customers.read', async (ctx) => {
    const parsed = schema.safeParse({ chatId, text });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Notoʻgʻri soʻrov' };
    try {
      await replyToCustomer(parsed.data.chatId, parsed.data.text, ctx.userId);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Yuborib boʻlmadi' };
    }
    revalidatePath('/admin/support');
    return { ok: true, message: 'Javob yuborildi' };
  });
}
