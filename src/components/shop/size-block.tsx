'use client';

import { createContext, useContext, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { Loader2, Maximize2 } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/components/ui/cn';
import { saveSetting } from '@/lib/actions/admin/settings';
import { useEditing } from './site-editor';

// Har sahifadagi bloklar oʻlchami (S / M / L). Ega/xodim tahrir rejimida blok ustidagi tugmalar bilan tanlaydi,
// hamma uchun saqlanadi (site_settings 'block_sizes'). Oddiy blok — butunligicha kichrayadi/kattalashadi (zoom),
// mahsulotlar toʻri — ustunlar soni oʻzgaradi (S — koʻproq, mayda; L — kamroq, yirik).

export type BlockSize = 'sm' | 'md' | 'lg';
const ZOOM: Record<BlockSize, number> = { sm: 0.88, md: 1, lg: 1.12 };

let sizes: Record<string, BlockSize> = {};
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const setSizes = (next: Record<string, BlockSize>) => { sizes = next; listeners.forEach((l) => l()); };

/** Layout'da bir marta: serverdan kelgan oʻlchamlarni yuklaydi (SSR'da ham toʻgʻri chiqadi). */
export function SizeBoot({ value }: { value: Record<string, BlockSize> }) {
  if (sizes !== value && JSON.stringify(sizes) !== JSON.stringify(value)) sizes = value;
  return null;
}
const useSizes = () => useSyncExternalStore(subscribe, () => sizes, () => sizes);

const Ctx = createContext<BlockSize>('md');
/** Ichki komponent (masalan mahsulotlar toʻri) qaysi oʻlchamda ekanini biladi. */
export const useBlockSize = () => useContext(Ctx);

export function SizeBlock({ id, label, mode = 'zoom', className, children }: {
  id: string; label: string; mode?: 'zoom' | 'grid'; className?: string; children: ReactNode;
}) {
  const L = useL();
  const toast = useToast();
  const { isStaff } = useApp();
  const editing = useEditing() && isStaff;
  const all = useSizes();
  const size = all[id] ?? 'md';
  const [pending, start] = useTransition();
  const [hover, setHover] = useState(false);

  const choose = (z: BlockSize) => {
    const prev = sizes;
    const next = { ...sizes };
    if (z === 'md') delete next[id]; else next[id] = z;
    setSizes(next);
    start(async () => {
      const res = await saveSetting('block_sizes', next);
      if (!res.ok) { setSizes(prev); toast(res.error ?? L('Saqlanmadi'), 'error'); }
    });
  };

  const body = mode === 'zoom' && size !== 'md'
    ? <div style={{ zoom: ZOOM[size] }}>{children}</div>
    : children;

  return (
    <Ctx.Provider value={size}>
      <div className={cn('relative', editing && 'rounded-[22px] outline-2 outline-offset-4 outline-dashed outline-primary/45', className)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {editing && (
          <div className={cn('anim-pop absolute -top-3 left-2 z-30 flex items-center gap-1 rounded-full border border-line bg-[var(--panel)] p-0.5 pl-2 shadow-pop', hover && 'ring-2 ring-primary/40')}>
            <Maximize2 className="size-3.5 text-primary" aria-hidden />
            <span className="max-w-[120px] truncate px-1 text-[11px] font-semibold text-ink-2">{L(label)}</span>
            {(['sm', 'md', 'lg'] as const).map((z) => (
              <button key={z} type="button" onClick={() => choose(z)} aria-pressed={size === z} aria-label={`${L(label)}: ${z.toUpperCase()}`}
                className={cn('h-6 w-7 rounded-full text-[11px] font-bold transition', size === z ? 'bg-primary text-primary-fg' : 'text-ink-3 hover:text-ink')}>
                {z === 'sm' ? 'S' : z === 'md' ? 'M' : 'L'}
              </button>
            ))}
            {pending && <Loader2 className="mr-1 size-3.5 animate-spin text-ink-3" />}
          </div>
        )}
        {body}
      </div>
    </Ctx.Provider>
  );
}
