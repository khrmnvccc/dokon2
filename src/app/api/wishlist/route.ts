import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ids: [] });
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('wishlists').select('product_id').eq('user_id', user.id).limit(500);
  return NextResponse.json({ ids: (data ?? []).map((r) => r.product_id) });
}

const bodySchema = z.object({ productId: z.string().uuid(), add: z.boolean() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const supabase = await getServerSupabase();
  const { error } = parsed.data.add
    ? await supabase.from('wishlists').upsert({ user_id: user.id, product_id: parsed.data.productId }, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
    : await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', parsed.data.productId);
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
