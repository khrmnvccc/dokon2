'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { useL } from '@/components/providers';
import { cn } from '@/components/ui/cn';

const pad = (n: number) => String(n).padStart(2, '0');

/** Flash sale tugashigacha qolgan vaqt (soniyalab). Tugasa — yashirinadi. */
export function FlashCountdown({ endsAt, title, subtitle, href, className, compact }: { endsAt: string; title: string; subtitle?: string; href?: string; className?: string; compact?: boolean }) {
  const L = useL();
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : Math.max(0, end - now);
  if (left === 0) return null;
  const s = left === null ? 0 : Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const parts = [...(d ? [[d, L('kun')]] : []), [Math.floor((s % 86400) / 3600), L('soat')], [Math.floor((s % 3600) / 60), L('daq')], [s % 60, L('son')]] as [number, string][];
  const body = (
    <div className={cn('flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-pop', compact ? 'py-2.5' : 'sm:px-5 sm:py-4', className)}
      style={{ background: 'linear-gradient(120deg, #e0192d, #7c0a14)' }}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15"><Zap className="size-5 fill-current" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{title}</p>
        {subtitle && !compact && <p className="truncate text-[13px] opacity-85">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5" aria-label={L('Tugashiga qoldi')}>
        {parts.map(([n, u], i) => (
          <span key={i} className="flex min-w-10 flex-col items-center rounded-lg bg-black/25 px-1.5 py-1">
            <span className="num text-[17px] font-bold leading-none">{left === null ? '--' : pad(n)}</span>
            <span className="mt-0.5 text-[10px] uppercase opacity-80">{u}</span>
          </span>
        ))}
      </div>
    </div>
  );
  return href ? <a href={href} className="block">{body}</a> : body;
}
