import { Skeleton } from '@/components/ui/misc';
import { ProductGridSkeleton } from '@/components/shop/product-card';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda">
      <Skeleton className="mb-4 h-8 w-56" />
      <ProductGridSkeleton count={10} />
    </div>
  );
}
