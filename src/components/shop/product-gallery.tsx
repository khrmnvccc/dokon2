'use client';

import { useState } from 'react';
import type { ProductImage as Img } from '@/lib/types';
import { cn } from '@/components/ui/cn';
import { ProductImage } from './product-image';

export function ProductGallery({ images, name }: { images: Img[]; name: string }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [{ id: 'none', url: '', alt: name } as Img];
  const current = list[Math.min(active, list.length - 1)];
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      {list.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto md:w-20 md:flex-col md:overflow-visible">
          {list.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn('relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border-2 md:w-full', i === active ? 'border-brand' : 'border-transparent opacity-75 hover:opacity-100')}
              aria-label={`Rasm ${i + 1}`}
              aria-current={i === active}
            >
              <ProductImage src={img.url} alt="" sizes="80px" />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-square flex-1 overflow-hidden rounded-2xl bg-white">
        <ProductImage src={current.url || null} alt={current.alt || name} sizes="(max-width: 768px) 100vw, 50vw" priority />
      </div>
    </div>
  );
}
