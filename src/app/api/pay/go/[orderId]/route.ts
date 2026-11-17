import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessOrder, loadOrderAccess } from '@/lib/payments/receipts';
import { getPaymentKeys, providerReady } from '@/lib/payments/config';
import { providerPayUrl, type OnlineProvider } from '@/lib/payments';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Mijoz “Toʻlash” tugmasini bosdi: Click yoki Payme toʻlov sahifasiga yoʻnaltiriladi. */
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const back = (path: string) => NextResponse.redirect(`${SITE_URL}${path}`, 303);
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return back('/');
  const [o, user] = await Promise.all([loadOrderAccess(orderId), getCurrentUser()]);
  if (!o || !canAccessOrder(o, user?.id ?? null, token)) return back('/track');
  const returnPath = o.user_id && user?.id === o.user_id ? `/account/orders/${o.id}` : `/order/success?token=${o.public_token}`;
  if (o.payment_status === 'paid' || o.status === 'cancelled' || o.status === 'returned') return back(returnPath);
  const { data: method } = o.payment_method_id
    ? await getServiceSupabase().from('payment_methods').select('kind, provider').eq('id', o.payment_method_id).maybeSingle()
    : { data: null };
  const keys = await getPaymentKeys();
  const provider = (method?.kind === 'online' ? method.provider : null) as OnlineProvider | null;
  if (!provider || !providerReady(keys, provider)) return back(returnPath);
  const target = providerPayUrl(keys, provider, { number: o.number, total: Number(o.total) }, returnPath);
  return target ? NextResponse.redirect(target, 303) : back(returnPath);
}
