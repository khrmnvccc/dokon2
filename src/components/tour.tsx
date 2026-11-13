'use client';

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/components/ui/cn';

// Yoʻl-yoʻriq: birinchi kirishda bir necha qadam. Har qadam [data-tour="…"] elementini yoritadi;
// element koʻrinmasa (masalan telefonda yashirin) — karta ekran oʻrtasida chiqadi.
// Koʻrilganini localStorage eslab qoladi; “Yoʻriqnoma” tugmasi bilan qayta ochish mumkin (dk:tour hodisasi).

export interface TourStep { target?: string; title: string; text: ReactNode; icon?: ReactNode }

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(name?: string): Rect | null {
  if (!name) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

export function Tour({ id, steps, delay = 700 }: { id: string; steps: TourStep[]; delay?: number }) {
  const key = `dk_tour_${id}`;
  const [i, setI] = useState<number | null>(null);
  const [list, setList] = useState<TourStep[]>(steps);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    // Shu ekranda koʻrinmaydigan joylar (masalan telefonda yashirin menyu) oʻtkazib yuboriladi.
    const open = () => { setList(steps.filter((s) => !s.target || findTarget(s.target))); setI(0); };
    window.addEventListener(`dk:tour:${id}`, open);
    let seen = true;
    try { seen = localStorage.getItem(key) === '1'; } catch { /* */ }
    // Telegram ichida ham, oddiy brauzerda ham — faqat birinchi marta
    const t = seen ? undefined : setTimeout(open, delay);
    return () => { window.removeEventListener(`dk:tour:${id}`, open); if (t) clearTimeout(t); };
  }, [id, key, delay, steps]);

  const close = useCallback(() => {
    setI(null);
    try { localStorage.setItem(key, '1'); } catch { /* */ }
  }, [key]);

  const step = i === null ? null : list[i];
  useLayoutEffect(() => {
    if (!step) return;
    const update = () => setRect(findTarget(step.target));
    update();
    addEventListener('resize', update);
    addEventListener('scroll', update, true);
    return () => { removeEventListener('resize', update); removeEventListener('scroll', update, true); };
  }, [step]);

  useEffect(() => {
    if (i === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [i, close]);

  if (!step || i === null) return null;
  const last = i === list.length - 1;
  const pad = 6;
  // Karta: element ostida, joy boʻlmasa ustida; element yoʻq boʻlsa — pastda (telefon) / oʻrtada
  const below = rect ? rect.top + rect.height + 16 + 220 < innerHeight : false;
  const cardStyle: React.CSSProperties = rect
    ? {
        left: Math.min(Math.max(12, rect.left + rect.width / 2 - 170), innerWidth - 352 > 12 ? innerWidth - 352 : 12),
        ...(below ? { top: rect.top + rect.height + pad + 12 } : { bottom: innerHeight - rect.top + pad + 12 }),
      }
    : {};

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(8,14,24,.55)' }} />
      ) : <div className="absolute inset-0 bg-[rgba(8,14,24,.55)]" />}
      <div className="absolute inset-0" onClick={close} />
      <div key={i} style={cardStyle}
        className={cn('anim-pop absolute w-[min(340px,calc(100vw-24px))] rounded-2xl bg-surface-solid p-4 text-ink shadow-pop',
          !rect && 'inset-x-0 bottom-6 mx-auto sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2')}>
        <button type="button" onClick={close} aria-label="Yopish" className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"><X className="size-4" /></button>
        <div className="flex items-start gap-3 pr-6">
          {step.icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">{step.icon}</span>}
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-snug">{step.title}</div>
            <div className="mt-1 text-sm leading-relaxed text-ink-2">{step.text}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex gap-1">{list.map((_, k) => <span key={k} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-primary' : 'w-1.5 bg-line-strong')} />)}</div>
          <div className="flex-1" />
          {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="h-9 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface-2">Orqaga</button>}
          {!last && i === 0 && <button type="button" onClick={close} className="h-9 rounded-lg px-3 text-sm font-medium text-ink-3 hover:bg-surface-2">Oʻtkazib yuborish</button>}
          <button type="button" onClick={() => (last ? close() : setI(i + 1))} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg">{last ? 'Tushunarli' : 'Keyingi'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const openTour = (id: string) => window.dispatchEvent(new Event(`dk:tour:${id}`));
