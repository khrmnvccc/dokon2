'use client';

import { useState } from 'react';
import { formatNumber } from '@/lib/format';

/**
 * Bitta qatorli ustunli diagramma (masalan, kunlik savdo). Bitta seriya — legenda kerak emas, sarlavha nomlaydi.
 * Hover/focus'da tooltip; skrin-riderlar uchun jadval ko'rinishi ham bor.
 */
export function BarChart({ data, valueLabel, formatValue = formatNumber, height = 220 }: {
  data: { label: string; value: number; sub?: string }[];
  valueLabel: string;
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const ticks = [0, nice / 2, nice];
  const W = 640;
  const padL = 56;
  const padB = 24;
  const H = height;
  const innerW = W - padL - 8;
  const innerH = H - padB - 8;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(28, slot - 2));
  const labelEvery = Math.ceil(data.length / 8);

  if (showTable) {
    return (
      <div>
        <button className="mb-2 text-xs font-medium text-brand" onClick={() => setShowTable(false)}>Diagrammani ko‘rsatish</button>
        <div className="max-h-64 overflow-auto text-sm">
          <table className="w-full">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">Sana</th><th className="py-1 text-right">{valueLabel}</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.label} className="border-t border-line"><td className="py-1">{d.label}</td><td className="py-1 text-right tabular-nums">{formatValue(d.value)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    );
  }

  const a = active !== null ? data[active] : null;
  return (
    <div className="relative">
      <button className="absolute -top-1 right-0 z-10 text-xs font-medium text-brand" onClick={() => setShowTable(true)}>Jadval</button>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${valueLabel} diagrammasi`} onMouseLeave={() => setActive(null)}>
        {ticks.map((t) => {
          const y = 8 + innerH - (t / nice) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{compact(t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / nice) * innerH;
          const x = padL + i * slot + (slot - barW) / 2;
          const y = 8 + innerH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.label}>
              {h > 0 && (
                <path
                  d={`M${x},${8 + innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${8 + innerH} Z`}
                  fill="var(--brand)"
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              {/* Kattaroq hover maydoni */}
              <rect x={padL + i * slot} y={8} width={slot} height={innerH} fill="transparent" tabIndex={0}
                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                aria-label={`${d.label}: ${formatValue(d.value)}`} />
              {i % labelEvery === 0 && (
                <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {a && active !== null && (
        <div className="pointer-events-none absolute top-2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-pop"
          style={{ left: `clamp(0px, calc(${((padL + active * slot + slot / 2) / W) * 100}% - 70px), calc(100% - 140px))` }}>
          <p className="text-slate-300">{a.label}</p>
          <p className="font-semibold tabular-nums">{formatValue(a.value)}</p>
          {a.sub && <p className="text-slate-300">{a.sub}</p>}
        </div>
      )}
    </div>
  );
}

/** Gorizontal ulushlar (holatlar bo'yicha taqsimot) — bitta rang, matnli yorliqlar */
export function HBarList({ items, formatValue = formatNumber }: { items: { label: string; value: number; extra?: string }[]; formatValue?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span>{i.label}</span>
            <span className="tabular-nums text-muted">{formatValue(i.value)}{i.extra ? ` · ${i.extra}` : ''}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function niceMax(v: number) {
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function compact(v: number) {
  if (v >= 1e9) return `${+(v / 1e9).toFixed(1)} mlrd`;
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)} mln`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(0)} ming`;
  return String(v);
}
