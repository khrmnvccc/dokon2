import { COUPON_THEMES, type CouponDesign } from '@/lib/coupon-design';
import { cn } from '@/components/ui/cn';

export interface CouponCardProps {
  design: CouponDesign;
  /** "Kupon" yoki "Aksiya" */
  kind: string;
  /** Katta raqam, masalan "30 000" yoki "15" */
  value: string;
  /** Raqam yonidagi birlik: "soʻm" yoki "%" */
  unit: string;
  /** Pastki yozuv: "Min. 150 000 soʻm" */
  note?: string | null;
  /** Oʻng yuqoridagi kichik belgi: "Barcha mahsulot" */
  tag?: string | null;
  /** Chiptadagi kichik yozuv: "30 kun" */
  stubNote?: string | null;
  action?: string | null;
  size?: 'sm' | 'md';
  /** Teshikcha rangi = karta turgan fon */
  cutout?: string;
  className?: string;
}

/**
 * Kupon kartasi: chapda chipta (qisqa yozuv), oʻngda gradient asos, katta raqam va tugma.
 * Faqat CSS — rasm yuklanmaydi, admin va saytda bir xil chiziladi.
 */
export function CouponCard({ design, kind, value, unit, note, tag, stubNote, action, size = 'md', cutout = 'var(--panel, #fff)', className }: CouponCardProps) {
  const t = COUPON_THEMES[design.theme] ?? COUPON_THEMES.red;
  const sm = size === 'sm';
  const badge = design.badge || (unit === '%' ? '%' : '★');
  // Kichik kartada uzun summa qisqartiriladi: 100 000 → 100K
  const shown = sm && unit !== '%' ? compact(value) : value;
  return (
    <div className={cn('relative flex w-full select-none overflow-hidden', sm ? 'h-[52px] rounded-lg' : 'h-[104px] rounded-2xl shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]', className)}
      style={{ ['--notch' as string]: sm ? '5px' : '9px' }} aria-label={`${kind}: ${value} ${unit}`}>
      {/* chipta */}
      <div className={cn('relative flex shrink-0 flex-col items-center justify-center', sm ? 'w-[30%]' : 'w-[27%]')}
        style={{ background: `linear-gradient(160deg, ${t.stub[0]}, ${t.stub[1]})`, color: t.stubInk }}>
        <span className={cn('max-w-full truncate px-0.5 font-black italic leading-none tracking-tighter', sm ? (badge.length > 4 ? 'text-[10px]' : 'text-[14px]') : badge.length > 4 ? 'text-[20px]' : badge.length > 3 ? 'text-[26px]' : 'text-[34px]')}>{badge}</span>
        {stubNote && !sm && <span className="mt-1 text-[11px] font-semibold opacity-80">{stubNote}</span>}
      </div>
      {/* teshikchalar */}
      <span className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: cutout, left: sm ? '30%' : '27%', width: 'calc(var(--notch) * 2)', height: 'calc(var(--notch) * 2)' }} />
      <span className="pointer-events-none absolute bottom-0 z-10 -translate-x-1/2 translate-y-1/2 rounded-full" style={{ background: cutout, left: sm ? '30%' : '27%', width: 'calc(var(--notch) * 2)', height: 'calc(var(--notch) * 2)' }} />
      {/* asos */}
      <div className={cn('relative flex min-w-0 flex-1 flex-col justify-between', sm ? 'px-2 py-1' : 'px-4 py-3')}
        style={{ background: `repeating-linear-gradient(115deg, transparent 0 22px, rgb(255 255 255 / 0.05) 22px 26px), linear-gradient(135deg, ${t.main[0]}, ${t.main[1]})`, color: t.ink }}>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('font-semibold', sm ? 'text-[9px]' : 'text-sm')}>{kind}</span>
          {tag && <span className={cn('truncate rounded-full font-bold', sm ? 'px-1 text-[7px]' : 'px-2 py-0.5 text-[11px]')} style={{ background: t.pill, color: t.buttonInk }}>{tag}</span>}
        </div>
        <div className="flex items-end gap-1 leading-none">
          <span className={cn('whitespace-nowrap font-mono font-black tracking-tight', sm ? 'text-[17px]' : shown.length > 6 ? 'text-[27px]' : 'text-[34px]')}>{shown}</span>
          <span className={cn('font-bold', sm ? 'text-[9px]' : 'mb-1 text-base')}>{unit}</span>
        </div>
        {!sm && (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs opacity-90">{note}</span>
            {action && <span className="shrink-0 rounded-full px-3.5 py-1 text-[13px] font-bold" style={{ background: t.button, color: t.buttonInk }}>{action}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function compact(v: string): string {
  const n = Number(v.replace(/\s/g, ''));
  if (!Number.isFinite(n)) return v;
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(0)}K`;
  return v;
}
