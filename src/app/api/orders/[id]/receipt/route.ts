import { randomUUID } from 'node:crypto';
import { NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { RECEIPT_MAX_BYTES, RECEIPT_MAX_PER_ORDER, sniffImage } from '@/lib/payment-card';
import { canAccessOrder, loadOrderAccess, methodCard } from '@/lib/payments/receipts';
import { onReceiptUploaded } from '@/lib/telegram/events';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/** Mijoz kartaga oʻtkazma chekini yuklaydi (buyurtma egasi yoki buyurtma havolasi orqali). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return fail('Buyurtma topilmadi', 404);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail('Server sozlanmagan', 503);
  // Boshqa saytdan yuborilgan soʻrov qabul qilinmaydi
  const origin = request.headers.get('origin');
  const originHost = (() => { try { return origin ? new URL(origin).host : null; } catch { return '?'; } })();
  if (originHost && originHost !== (request.headers.get('x-forwarded-host') || request.headers.get('host'))) return fail('Ruxsat yoʻq', 403);
  if (!(await rateLimit(`receipt:${await getClientIp()}`, 12, 3600))) return fail('Juda koʻp urinish. Birozdan keyin qayta urinib koʻring', 429);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const tokenRaw = form?.get('token');
  const token = typeof tokenRaw === 'string' && UUID.test(tokenRaw) ? tokenRaw : null;
  if (!(file instanceof Blob) || !file.size) return fail('Chek rasmini tanlang');
  if (file.size > RECEIPT_MAX_BYTES) return fail('Rasm juda katta (4 MB gacha)');

  const [order, user] = await Promise.all([loadOrderAccess(id), getCurrentUser()]);
  if (!order || !canAccessOrder(order, user?.id ?? null, token)) return fail('Buyurtma topilmadi', 404);
  if (!(await methodCard(order.payment_method_id))) return fail('Bu buyurtma kartaga toʻlanmaydi');
  if (order.payment_status === 'paid') return fail('Toʻlov allaqachon tasdiqlangan');
  if (order.status === 'cancelled' || order.status === 'returned') return fail('Buyurtma bekor qilingan');

  const s = getServiceSupabase();
  const { data: prev } = await s.from('payment_receipts').select('status').eq('order_id', id);
  if ((prev ?? []).some((r) => r.status === 'submitted')) return fail('Chek allaqachon yuborilgan — tekshirilmoqda');
  if ((prev?.length ?? 0) >= RECEIPT_MAX_PER_ORDER) return fail('Cheklar soni chegarasiga yetdi. Doʻkon bilan bogʻlaning');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return fail('Faqat rasm (JPG, PNG yoki WEBP)');
  const path = `${id}/${randomUUID()}.${EXT[mime]}`;
  const up = await s.storage.from('receipts').upload(path, bytes, { contentType: mime, upsert: false });
  if (up.error) { console.error('receipt upload', up.error.message); return fail('Rasmni saqlab boʻlmadi. Qayta urinib koʻring', 500); }
  const ins = await s.from('payment_receipts').insert({ order_id: id, path, mime, size: bytes.length, uploaded_by: user?.id ?? null }).select('id').single();
  if (ins.error) {
    await s.storage.from('receipts').remove([path]);
    console.error('receipt insert', ins.error.message);
    return fail('Chekni saqlab boʻlmadi. Qayta urinib koʻring', 500);
  }
  await s.from('notifications').insert({
    user_id: null, type: 'payment', title: `Chek yuklandi · №${order.number}`,
    body: `${order.customer_name} — tekshirib tasdiqlang`, link: `/admin/orders/${id}`,
  });
  after(() => onReceiptUploaded(id, { bytes, mime, name: `chek-${order.number}.${EXT[mime]}` }));
  revalidatePath(`/account/orders/${id}`);
  return NextResponse.json({ ok: true });
}
