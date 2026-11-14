'use client';

import { useL } from '@/components/providers';
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/lib/types';
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
        className="object-cover object-[78%_50%] transition-transform duration-700 ease-out group-hover/banner:scale-[1.03] sm:object-center"
        unoptimized={isUnoptimizable(banner.image_url)}
      />
      {hasText && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-r from-black/45 via-black/15 to-transparent p-4 sm:justify-center sm:gap-2.5 sm:p-10 md:p-12',
            compact && 'sm:p-7 md:p-8',
          )}
          style={{ color: banner.text_color ?? '#fff' }}
        >
          {banner.title && (
            <h2 className={cn('max-w-[78%] text-[22px] font-bold leading-[1.1] tracking-tight drop-shadow-sm sm:max-w-[60%] sm:text-4xl md:text-[44px]', compact && 'sm:text-3xl md:text-3xl')}>
              {banner.title}
            </h2>
          )}
          {banner.subtitle && (
            <p className={cn('line-clamp-2 max-w-[72%] text-[13px] leading-snug opacity-90 sm:max-w-[50%] sm:text-base md:text-lg', compact && 'md:text-base')}>{banner.subtitle}</p>
          )}
          {banner.button_text && banner.link_url && (
            <span className="mt-1.5 inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-neutral-900 shadow-[0_6px_20px_-6px_rgba(0,0,0,.45)] transition group-hover/banner:gap-2.5 sm:mt-2 sm:h-11 sm:px-5 sm:text-[15px]">
              {banner.button_text}
              <ArrowRight className="size-4" />
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
export function HeroSlider({ banners }: { banners: Banner[] }) {
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
              'relative aspect-[4/3] shrink-0 snap-center overflow-hidden rounded-[28px] shadow-[0_18px_40px_-24px_rgba(15,23,42,.55)] ring-1 ring-black/5 transition-[transform,opacity] duration-500 sm:aspect-[16/6] sm:w-full sm:rounded-[32px] min-[420px]:aspect-[16/10]',
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
