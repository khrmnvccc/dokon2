import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ productId: z.string().uuid(), variantId: z.string().uuid().nullable().optional(), add: z.boolean() });

/** Mijoz: “Kelganda xabar ber” obunasi (faqat oʻzi uchun, RLS bilan). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const productId = new URL(request.url).searchParams.get('productId') ?? '';
  if (!user || !/^[0-9a-f-]{36}$/i.test(productId)) return NextResponse.json({ variants: [] });
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('stock_alerts').select('variant_id').eq('user_id', user.id).eq('product_id', productId).is('notified_at', null);
  return NextResponse.json({ variants: (data ?? []).map((r) => r.variant_id ?? '') });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { productId, variantId, add } = parsed.data;
  const supabase = await getServerSupabase();
  if (add) {
    const { count } = await supabase.from('stock_alerts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('notified_at', null);
    if ((count ?? 0) >= 100) return NextResponse.json({ error: 'limit' }, { status: 429 });
    // Avval xabar olgan boʻlsa — qayta kutishga qoʻyiladi
    let del = supabase.from('stock_alerts').delete().eq('user_id', user.id).eq('product_id', productId);
    del = variantId ? del.eq('variant_id', variantId) : del.is('variant_id', null);
    await del;
    const { error } = await supabase.from('stock_alerts').insert({ user_id: user.id, product_id: productId, variant_id: variantId ?? null });
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
  } else {
    let del = supabase.from('stock_alerts').delete().eq('user_id', user.id).eq('product_id', productId);
    del = variantId ? del.eq('variant_id', variantId) : del.is('variant_id', null);
    const { error } = await del;
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
