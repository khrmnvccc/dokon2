'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/lib/types';
import { cn } from '@/components/ui/cn';
import { isUnoptimizable } from './product-image';

export function BannerSlide({ banner, priority, className }: { banner: Banner; priority?: boolean; className?: string }) {
  const content = (
    <div className={cn('relative h-full w-full overflow-hidden', className)} style={{ backgroundColor: banner.bg_color ?? undefined }}>
      <Image src={banner.image_url} alt={banner.title ?? ''} fill priority={priority} sizes="(max-width: 1280px) 100vw, 1280px" className="object-cover" unoptimized={isUnoptimizable(banner.image_url)} />
      {(banner.title || banner.subtitle || banner.button_text) && (
        <div className="absolute inset-0 flex flex-col justify-center gap-2 bg-gradient-to-r from-black/35 via-black/10 to-transparent p-5 sm:gap-3 sm:p-10 md:p-14" style={{ color: banner.text_color ?? '#fff' }}>
          {banner.title && <h2 className="max-w-[70%] text-xl font-extrabold leading-tight sm:text-3xl md:text-4xl">{banner.title}</h2>}
          {banner.subtitle && <p className="max-w-[60%] text-sm opacity-90 sm:text-base md:text-lg">{banner.subtitle}</p>}
          {banner.button_text && banner.link_url && (
            <span className="mt-1 inline-flex w-fit rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm sm:px-5 sm:py-2.5">{banner.button_text}</span>
          )}
        </div>
      )}
    </div>
  );
  return banner.link_url ? <Link href={banner.link_url} className="block h-full" aria-label={banner.title ?? 'Banner'}>{content}</Link> : content;
}

export function HeroSlider({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = banners.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(id);
  }, [count, paused]);

  if (!count) return null;
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Aksiya bannerlari"
      className="group relative aspect-[16/9] overflow-hidden rounded-2xl bg-slate-200 sm:aspect-[16/6] sm:rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((b, i) => (
          <div key={b.id} className="h-full w-full shrink-0" aria-hidden={i !== index} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${count}`}>
            <BannerSlide banner={b} priority={i === 0} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          <button onClick={() => go(index - 1)} className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow opacity-0 transition group-hover:opacity-100 sm:flex" aria-label="Oldingi">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => go(index + 1)} className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow opacity-0 transition group-hover:opacity-100 sm:flex" aria-label="Keyingi">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((b, i) => (
              <button key={b.id} onClick={() => go(i)} aria-label={`${i + 1}-banner`} aria-current={i === index} className={cn('h-2 rounded-full bg-white transition-all', i === index ? 'w-6' : 'w-2 opacity-60')} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
