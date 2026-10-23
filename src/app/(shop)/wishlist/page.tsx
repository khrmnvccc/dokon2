import type { Metadata } from 'next';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCatalog } from '@/lib/data/public';
import { EmptyState } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';
import { ProductGrid } from '@/components/shop/product-card';

export const metadata: Metadata = { title: 'Sevimlilar', robots: { index: false } };

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <EmptyState icon={<Heart className="h-8 w-8" />} title="Sevimlilar" text="Yoqqan mahsulotlarni saqlash uchun tizimga kiring."
      action={<Link href="/login?next=/wishlist" className={buttonClass('primary')}>Kirish</Link>} />;
  }
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('wishlists').select('product_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  const ids = (data ?? []).map((r) => r.product_id as string);
  const { items } = ids.length ? await getCatalog({ ids, limit: 100 }) : { items: [] };
  const ordered = ids.map((id) => items.find((p) => p.id === id)).filter((p) => p !== undefined);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Sevimlilar <span className="text-base font-medium text-muted">({ordered.length})</span></h1>
      {ordered.length === 0 ? (
        <EmptyState icon={<Heart className="h-8 w-8" />} title="Hozircha bo‘sh" text="Mahsulot kartasidagi yurakchani bosing — u shu yerda saqlanadi."
          action={<Link href="/catalog" className={buttonClass('primary')}>Katalogga o‘tish</Link>} />
      ) : (
        <ProductGrid products={ordered} />
      )}
    </div>
  );
}
