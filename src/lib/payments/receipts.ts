import 'server-only';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { cleanCard, type PaymentCard } from '@/lib/payment-card';

// Kartaga oʻtkazma: mijozga karta va chek holati; xodimga chek rasmlari. Cheklar yopiq “receipts”
// bucket’ida, faqat server (service role) oʻqiydi/yozadi. Chaqiruvchi buyurtmaga ruxsatni oldin tekshiradi.

export interface ReceiptInfo { id: string; status: 'submitted' | 'approved' | 'rejected'; note: string | null; created_at: string }
export interface OrderPayment {
  orderId: string; number: number; total: number; status: string; paymentStatus: string;
  card: PaymentCard; receipts: ReceiptInfo[];
}
export interface OrderAccessRow {
  id: string; number: number; total: number; status: string; payment_status: string; payment_method_id: string | null;
  payment_method_name: string; customer_name: string; customer_phone: string; user_id: string | null; public_token: string; created_at: string;
}

const db = () => getServiceSupabase();
export const TOKEN_TTL_MS = 30 * 86_400_000;

export async function loadOrderAccess(orderId: string) {
  const { data } = await db().from('orders')
    .select('id, number, total, status, payment_status, payment_method_id, payment_method_name, customer_name, customer_phone, user_id, public_token, created_at')
    .eq('id', orderId).maybeSingle();
  return data as OrderAccessRow | null;
}

/** Buyurtma egasi yoki 30 kunlik havola (token) egasi. */
export function canAccessOrder(o: OrderAccessRow, userId: string | null, token: string | null) {
  if (userId && o.user_id === userId) return true;
  return Boolean(token && token === o.public_token && Date.now() - new Date(o.created_at).getTime() < TOKEN_TTL_MS);
}

export async function methodCard(methodId: string | null): Promise<PaymentCard | null> {
  if (!methodId) return null;
  const { data } = await db().from('payment_methods').select('kind, card').eq('id', methodId).maybeSingle();
  return data?.kind === 'bank_transfer' ? cleanCard(data.card) : null;
}

/** Karta toʻlovi boʻlmasa null. */
export async function getOrderPayment(orderId: string): Promise<OrderPayment | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const o = await loadOrderAccess(orderId);
  if (!o) return null;
  const card = await methodCard(o.payment_method_id);
  if (!card) return null;
  const { data } = await db().from('payment_receipts').select('id, status, note, created_at')
    .eq('order_id', orderId).order('created_at', { ascending: false }).limit(20);
  return { orderId, number: o.number, total: Number(o.total), status: o.status, paymentStatus: o.payment_status, card, receipts: (data ?? []) as ReceiptInfo[] };
}

/** Xodim uchun: cheklar va 10 daqiqalik koʻrish havolalari. */
export async function getReceiptsForStaff(orderId: string) {
  const { data } = await db().from('payment_receipts').select('id, path, status, note, created_at, decided_at')
    .eq('order_id', orderId).order('created_at', { ascending: false }).limit(20);
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: signed } = await db().storage.from('receipts').createSignedUrls(rows.map((r) => r.path as string), 600);
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id as string, status: r.status as ReceiptInfo['status'], note: r.note as string | null,
    created_at: r.created_at as string, decided_at: r.decided_at as string | null, url: urls.get(r.path as string) ?? null,
  }));
}
export type StaffReceipt = Awaited<ReturnType<typeof getReceiptsForStaff>>[number];
