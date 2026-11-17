import { NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getPaymentMethods } from '@/lib/data/public';
import { usablePaymentMethods } from '@/lib/payments';
import { rateLimit } from '@/lib/rate-limit';
import { loadImportRequest } from '@/lib/import-requests-server';
import { onNewOrder } from '@/lib/telegram/events';

export const dynamic = 'force-dynamic';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept'), paymentMethodId: z.string().uuid() }),
  z.object({ action: z.literal('cancel') }),
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mijoz narxni qabul qiladi (buyurtma yaratiladi) yoki soʻrovni bekor qiladi. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return fail('Soʻrov topilmadi', 404);
  const user = await getCurrentUser();
  if (!user) return fail('Avval tizimga kiring', 401);
  if (!(await rateLimit(`import-act:${user.id}`, 20, 600))) return fail('Juda koʻp urinish', 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Maʼlumotlar notoʻgʻri');
  const r = await loadImportRequest(id);
  if (!r || r.user_id !== user.id) return fail('Soʻrov topilmadi', 404);
  const s = getServiceSupabase();

  if (parsed.data.action === 'cancel') {
    if (r.status !== 'new' && r.status !== 'quoted') return fail('Bu soʻrovni endi bekor qilib boʻlmaydi');
    await s.from('import_requests').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id).in('status', ['new', 'quoted']);
    revalidatePath(`/account/requests/${id}`);
    return NextResponse.json({ ok: true });
  }

  const methodId = parsed.data.paymentMethodId;
  const methods = await usablePaymentMethods(await getPaymentMethods());
  const method = methods.find((m) => m.id === methodId && !m.installment);
  if (!method) return fail('Bu toʻlov usuli hozir mavjud emas');
  const { data, error } = await s.rpc('_import_request_to_order', { p_id: id, p_user: user.id, p_payment_method: method.id });
  if (error) {
    const m = error.message ?? '';
    if (m.includes('QUOTE_EXPIRED')) return fail('Narx muddati tugagan. Yangi narx soʻrang yoki doʻkon bilan bogʻlaning', 409);
    if (m.includes('NOT_QUOTED')) return fail('Narx hali berilmagan', 409);
    if (m.includes('USER_BLOCKED')) return fail('Hisobingiz bloklangan', 403);
    console.error('import accept', m);
    return fail('Buyurtma yaratib boʻlmadi. Qayta urinib koʻring', 500);
  }
  const order = data as { id: string; number: number; token: string; duplicate: boolean };
  if (!order.duplicate) after(() => onNewOrder(order.id));
  revalidatePath(`/account/requests/${id}`);
  const payUrl = method.kind === 'online' ? `/api/pay/go/${order.id}?t=${order.token}` : null;
  return NextResponse.json({ ok: true, orderId: order.id, number: order.number, payUrl });
}
