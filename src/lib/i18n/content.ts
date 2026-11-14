// Kontent tarjimasi: bazadagi har bir yozuvda i18n ustuni bor — {"ru": {"name": "…", "description": "…"}}.
// Rus tilida ruscha matn boʻlsa oʻsha, boʻlmasa oʻzbekchasi koʻrsatiladi. Sozlamalar matnlari esa
// site_settings 'translations' kalitida: {"ru": {"announcement.text": "…", "footer.columns.0.title": "…"}}.

import type { Lang } from './dict';

export type Translations = Record<string, unknown>;

/** Qaysi jadvalda qaysi maydonlar tarjima qilinadi (admin “Tarjimalar” sahifasi ham shundan oʻqiydi). */
export const I18N_FIELDS = {
  products: ['name', 'short_description', 'description', 'seo_title', 'seo_description'],
  categories: ['name', 'description', 'seo_title', 'seo_description'],
  banners: ['title', 'subtitle', 'button_text'],
  pages: ['title', 'content', 'seo_title', 'seo_description'],
  promotions: ['title', 'description'],
  shipping_methods: ['name', 'description', 'eta'],
  payment_methods: ['name', 'description', 'instructions'],
} as const;
export type I18nTable = keyof typeof I18N_FIELDS;

function ruOf(row: unknown): Record<string, unknown> | null {
  const i18n = (row as { i18n?: unknown } | null)?.i18n;
  if (!i18n || typeof i18n !== 'object') return null;
  const ru = (i18n as Record<string, unknown>).ru;
  return ru && typeof ru === 'object' ? (ru as Record<string, unknown>) : null;
}

/** Bitta yozuv: rus tilida mavjud ruscha maydonlar oʻzbekchasining ustiga yoziladi. */
export function loc<T>(row: T, lang: Lang): T {
  if (lang === 'uz' || !row) return row;
  const ru = ruOf(row);
  if (!ru) return row;
  const out = { ...(row as Record<string, unknown>) };
  for (const [k, v] of Object.entries(ru)) {
    if (typeof v === 'string' && v.trim() && k in out) out[k] = v;
    // Xususiyatlar (attributes): {"Kafolat": "1 yil"} → ruscha juftliklar butunlay almashtiriladi.
    else if (k === 'attributes' && Array.isArray(v) && v.length) out[k] = v;
  }
  return out as T;
}

export const locAll = <T>(rows: T[], lang: Lang): T[] => (lang === 'uz' ? rows : rows.map((r) => loc(r, lang)));

/** Sozlamalar: “announcement.text”, “footer.columns.0.links.1.label” kabi yoʻllar boʻyicha almashtiradi. */
export function locSettings<T extends object>(settings: T, map: Record<string, unknown> | undefined): T {
  if (!map || !Object.keys(map).length) return settings;
  const out = structuredClone(settings) as Record<string, unknown>;
  for (const [path, value] of Object.entries(map)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const parts = path.split('.');
    let cur: unknown = out;
    for (let i = 0; i < parts.length - 1 && cur && typeof cur === 'object'; i++) cur = (cur as Record<string, unknown>)[parts[i]];
    const last = parts[parts.length - 1];
    if (cur && typeof cur === 'object' && typeof (cur as Record<string, unknown>)[last] === 'string') (cur as Record<string, unknown>)[last] = value;
  }
  return out as T;
}
