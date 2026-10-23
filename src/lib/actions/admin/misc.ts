'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { withPermission } from '@/lib/admin/action';
import type { ActionResult } from '@/lib/types';

export async function markStaffNotificationsRead(): Promise<ActionResult> {
  return withPermission('orders.read', async () => {
    const supabase = await getServerSupabase();
    await supabase.from('notifications').update({ is_read: true }).is('user_id', null).eq('is_read', false);
    revalidatePath('/admin', 'layout');
    return { ok: true };
  });
}
