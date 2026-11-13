import type { BrandSettings } from './config';
import { textOn } from './config';

// Kassa src/lib/brand.tsx dagi brandCss — server ham, brauzer ham ishlatadi.
const CORNERS: Record<BrandSettings['corners'], [string, string, string, string]> = {
  soft: ['0.625rem', '0.875rem', '1.25rem', '1.625rem'],
  sharp: ['0.25rem', '0.375rem', '0.5rem', '0.625rem'],
  round: ['0.875rem', '1.125rem', '1.625rem', '2rem'],
};

/** Juda to'q rang qorong'i rejimda ko'rinmay qoladi: u yerda oqqa qarab ochiladi. */
export function forDark(color: string) {
  const n = parseInt(color.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const light = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  if (light >= 0.35) return color;
  const mix = 0.55 - light;
  return `#${rgb.map((c) => Math.round(c + (255 - c) * mix).toString(16).padStart(2, '0')).join('')}`;
}

/** Sahifa ko'rinishi: asosiy rang (va qorong'i egizagi), ustidagi matn rangi va burchaklar. */
export function brandCss(b: BrandSettings) {
  const dark = forDark(b.color);
  const [md, lg, xl, xxl] = CORNERS[b.corners];
  // html:root / html.dark stylesheet'dagi :root / .dark dan kuchliroq, qaysi biri keyin yuklansa ham.
  return `html:root{--primary:${b.color};--primary-fg:${textOn(b.color)};--r-md:${md};--r-lg:${lg};--r-xl:${xl};--r-2xl:${xxl}}`
    + `html.dark{--primary:${dark};--primary-fg:${textOn(dark)}}`;
}
