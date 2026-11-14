'use client';

import { useL } from '@/components/providers';
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/lib/types';
import type { SectionSize } from '@/lib/settings-schema';
import { cn } from '@/components/ui/cn';
import { isUnoptimizable } from './product-image';

const AUTOPLAY_MS = 6000;

/**
 * One modern banner card: rounded, image anchored to the right so the art is never
 * cropped on phones, soft left-to-right scrim for readable text and a pill CTA.
 */
export function BannerSlide({ banner, priority, className, compact }: { banner: Banner; priority?: boolean; className?: string; compact?: boolean }) {
  const hasText = !!(banner.title || banner.subtitle || banner.button_text);
  const content = (
    <div
      className={cn('group/banner relative h-full w-full overflow-hidden rounded-[inherit] bg-surface-2', className)}
      style={{ backgroundColor: banner.bg_color ?? undefined }}
    >
      <Image
        src={banner.image_url}
        alt={banner.title ?? ''}
        fill
        priority={priority}
        sizes="(max-width: 640px) 92vw, (max-width: 1280px) 100vw, 1280px"
        className="object-cover object-right transition-transform duration-700 ease-out group-hover/banner:scale-[1.02]"
        unoptimized={isUnoptimizable(banner.image_url)}
      />
      {hasText && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col justify-center gap-1 bg-gradient-to-r from-black/20 to-transparent p-5 sm:gap-2 sm:p-10 md:p-12',
            compact && 'p-4 sm:p-7 md:p-8',
          )}
          style={{ color: banner.text_color ?? '#fff' }}
        >
          {banner.title && (
            <h2 className={cn('max-w-[62%] text-[20px] font-extrabold leading-[1.08] tracking-tight sm:max-w-[60%] sm:text-[34px] md:text-[40px]', compact && 'text-[18px] sm:text-[26px] md:text-[28px]')}>
              {banner.title}
            </h2>
          )}
          {banner.subtitle && (
            <p className={cn('line-clamp-2 max-w-[60%] text-[12.5px] leading-snug opacity-85 sm:max-w-[50%] sm:text-base md:text-lg', compact && 'md:text-base')}>{banner.subtitle}</p>
          )}
          {banner.button_text && banner.link_url && (
            <span className="mt-2 inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[12.5px] font-semibold text-neutral-900 transition group-hover/banner:gap-2.5 sm:mt-3 sm:h-10 sm:px-5 sm:text-[15px]">
              {banner.button_text}
              <ArrowRight className="size-3.5 sm:size-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
  return banner.link_url ? (
    <Link href={banner.link_url} className="block h-full rounded-[inherit]" aria-label={banner.title ?? 'Banner'}>
      {content}
    </Link>
  ) : (
    content
  );
}

/**
 * Swipeable card carousel. On phones the next card peeks in from the right (native
 * scroll-snap, so swiping feels like iOS); on larger screens one card fills the row.
 * Autoplays with a progress bar on the active indicator, pauses on hover/touch/hidden tab.
 */
export function HeroSlider({ banners, size = 'md' }: { banners: Banner[]; size?: SectionSize }) {
  const L = useL();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const count = banners.length;

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || !count) return;
      const n = ((i % count) + count) % count;
      const card = el.children[n] as HTMLElement | undefined;
      if (card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: 'smooth' });
    },
    [count],
  );

  // Track which card is centred while the user swipes.
  useEffect(() => {
    const el = track.current;
    if (!el || count < 2) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        Array.from(el.children).forEach((c, i) => {
          const card = c as HTMLElement;
          const d = Math.abs(card.offsetLeft - el.offsetLeft + card.clientWidth / 2 - mid);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        setIndex((prev) => {
          if (prev !== best) setCycle((c) => c + 1);
          return best;
        });
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [count]);

  // Autoplay; restarts whenever the active card changes.
  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [count, paused, index, cycle, go]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (!count) return null;
  return (
    <section
      data-tour="banner"
      aria-roledescription="carousel"
      aria-label={L("Aksiya bannerlari")}
      className="group relative -mx-4 sm:mx-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        ref={track}
        className={cn(
          'no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 sm:gap-4 sm:px-0',
          count === 1 && 'overflow-hidden',
        )}
      >
        {banners.map((b, i) => (
          <div
            key={b.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            className={cn(
              'relative shrink-0 snap-center overflow-hidden rounded-[24px] ring-1 ring-black/5 transition-[transform,opacity] duration-500 sm:w-full sm:rounded-[28px]',
              size === 'sm' ? 'aspect-[21/9] sm:aspect-[16/4]' : size === 'lg' ? 'aspect-[4/3] sm:aspect-[16/6]' : 'aspect-[16/9] sm:aspect-[16/5]',
              count > 1 ? 'w-[88%]' : 'w-full',
              count > 1 && i !== index && 'scale-[0.97] opacity-80 sm:scale-100 sm:opacity-100',
            )}
          >
            <BannerSlide banner={b} priority={i === 0} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          <button onClick={() => go(index - 1)} className="absolute left-4 top-[calc(50%-14px)] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-soft backdrop-blur transition hover:bg-white sm:flex sm:opacity-0 sm:group-hover:opacity-100" aria-label={L("Oldingi")}>
            <ChevronLeft className="size-5" />
          </button>
          <button onClick={() => go(index + 1)} className="absolute right-4 top-[calc(50%-14px)] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-soft backdrop-blur transition hover:bg-white sm:flex sm:opacity-0 sm:group-hover:opacity-100" aria-label={L("Keyingi")}>
            <ChevronRight className="size-5" />
          </button>
          <div className="mt-3 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => go(i)}
                aria-label={`${i + 1}-banner`}
                aria-current={i === index}
                className={cn('relative h-1.5 overflow-hidden rounded-full bg-ink/15 transition-all duration-300', i === index ? 'w-8' : 'w-1.5 hover:bg-ink/30')}
              >
                {i === index && (
                  <span
                    key={`${index}-${cycle}-${paused}`}
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    style={paused ? { width: '100%' } : { animation: `banner-progress ${AUTOPLAY_MS}ms linear both` }}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
