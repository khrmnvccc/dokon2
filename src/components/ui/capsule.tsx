import { cn } from './cn';

export interface CapsulePart { label: string; value: number; color: string; display?: string }

/**
 * "Kapsula" ulush chizig'i: dumaloq ~36px, har bo'lak o'z rangida, kengligi foiziga teng, ustida 45° oq chiziqlar
 * va oq qalin "Naqd 39%" matn. Ostida: rangli nuqta · nomi · foiz · summa.
 */
export function Capsule({ parts, className, legend = true }: { parts: CapsulePart[]; className?: string; legend?: boolean }) {
  const shown = parts.filter((p) => p.value > 0);
  const total = shown.reduce((s, p) => s + p.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <div className={className}>
      <div className="flex h-9 w-full overflow-hidden rounded-full bg-surface-2" role="img"
        aria-label={shown.map((p) => `${p.label} ${pct(p.value)}%`).join(', ') || 'Maʼlumot yoʻq'}>
        {shown.map((p) => (
          <div key={p.label} className="capsule-stripes flex min-w-0 items-center justify-center overflow-hidden px-2 text-[13px] font-semibold text-white"
            style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color }}>
            {pct(p.value) >= 12 && <span className="truncate">{p.label} {pct(p.value)}%</span>}
          </div>
        ))}
      </div>
      {legend && (
        <ul className="mt-3 space-y-1.5">
          {shown.map((p) => (
            <li key={p.label} className="flex items-center gap-2 text-[13px]">
              <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="min-w-0 flex-1 truncate text-ink-2">{p.label}</span>
              <span className={cn('font-semibold text-ink num')}>{pct(p.value)}%</span>
              <span className="w-28 text-right text-ink-3 num">{p.display ?? p.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
