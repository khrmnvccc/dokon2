import { getL } from '@/lib/i18n/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCatalog, getSettings } from '@/lib/data/public';
import { EmptyState } from '@/components/ui/misc';
import { buttonClass } from '@/components/ui/button';
import { ProductGrid } from '@/components/shop/product-card';
import { SizeBlock } from '@/components/shop/size-block';

export const metadata: Metadata = { title: 'Sevimlilar', robots: { index: false } };

export default async function WishlistPage() {
  const L = await getL();
  const user = await getCurrentUser();
  if (!user) {
    return <EmptyState icon={<Heart className="h-8 w-8" />} title={L("Sevimlilar")} text={L("Yoqqan mahsulotlarni saqlash uchun tizimga kiring.")}
      action={<Link href="/login?next=/wishlist" className={buttonClass('primary')}>{L("Kirish")}</Link>} />;
  }
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('wishlists').select('product_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  const ids = (data ?? []).map((r) => r.product_id as string);
  const [{ items }, settings] = await Promise.all([ids.length ? getCatalog({ ids, limit: 100 }) : Promise.resolve({ items: [] }), getSettings()]);
  const restockHint = settings.stock_alerts.restock_enabled && settings.stock_alerts.restock_wishlist;
  const ordered = ids.map((id) => items.find((p) => p.id === id)).filter((p) => p !== undefined);

  return (
    <div>
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight sm:text-2xl">{L("Sevimlilar")} <span className="text-base font-medium text-ink-3">({ordered.length})</span></h1>
      {ordered.length === 0 ? (
        <EmptyState icon={<Heart className="h-8 w-8" />} title={L("Hozircha bo‘sh")} text={L("Mahsulot kartasidagi yurakchani bosing — u shu yerda saqlanadi.")}
          action={<Link href="/catalog" className={buttonClass('primary')}>{L("Katalogga o‘tish")}</Link>} />
      ) : (
        <>
          {restockHint && <p className="mb-3 rounded-lg bg-primary-soft/50 px-3 py-2 text-sm text-ink-2">🔔 {L("Tugagan mahsulot qayta kelsa, Telegram botimiz orqali xabar beramiz")}</p>}
          <SizeBlock id="grid.wishlist" label="Mahsulotlar" mode="grid"><ProductGrid products={ordered} /></SizeBlock>
        </>
      )}
    </div>
  );
}
