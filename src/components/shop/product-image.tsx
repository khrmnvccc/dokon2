import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { cn } from '@/components/ui/cn';

export function isUnoptimizable(src: string) {
  return src.endsWith('.svg') || src.startsWith('data:');
}

/** Mahsulot rasmi: lazy loading, placeholder fon va rasm bo'lmasa ikonka */
export function ProductImage({ src, alt, sizes, priority, className }: { src: string | null; alt: string; sizes: string; priority?: boolean; className?: string }) {
  if (!src) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center bg-slate-100 text-slate-300', className)}>
        <ImageOff className="h-10 w-10" aria-hidden />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={isUnoptimizable(src)}
      className={cn('object-cover bg-slate-100', className)}
    />
  );
}
