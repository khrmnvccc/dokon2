import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { cartSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// Tizimga kirgan foydalanuvchining savatchasi (qurilmalar orasida sinxron). Narx bu yerda saqlanmaydi.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] });
  const supabase = await getServerSupabase();
  const { data: cart } = await supabase.from('carts').select('id').eq('user_id', user.id).maybeSingle();
  if (!cart) return NextResponse.json({ items: [] });
  const { data } = await supabase.from('cart_items').select('product_id, variant_id, quantity').eq('cart_id', cart.id).order('added_at');
  return NextResponse.json({
    items: (data ?? []).map((i) => ({ productId: i.product_id, variantId: i.variant_id, quantity: i.quantity })),
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = cartSchema.safeParse(body?.items);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const supabase = await getServerSupabase();
  const { data: cart, error } = await supabase
    .from('carts')
    .upsert({ user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (error || !cart) return NextResponse.json({ error: 'failed' }, { status: 500 });

  // Bir xil qatorlarni birlashtirish (unique: cart_id, product_id, variant_id)
  const merged = new Map<string, { product_id: string; variant_id: string | null; quantity: number }>();
  for (const i of parsed.data) {
    const key = `${i.productId}:${i.variantId ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, { product_id: i.productId, variant_id: i.variantId ?? null, quantity: Math.min(999, (prev?.quantity ?? 0) + i.quantity) });
  }
  await supabase.from('cart_items').delete().eq('cart_id', cart.id);
  if (merged.size) {
    const { error: insertError } = await supabase
      .from('cart_items')
      .insert([...merged.values()].map((i) => ({ ...i, cart_id: cart.id })));
    // Mahsulot o'chirilgan bo'lsa (FK xatosi) — savatcha baribir localStorage'da saqlanadi
    if (insertError) return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
