// Buyurtma asosida olib kelish (Xitoydan): umumiy turlar va hisob-kitob. Brauzer va server uchun.

export type ImportStatus = 'new' | 'quoted' | 'accepted' | 'rejected' | 'cancelled';
export const IMPORT_STATUSES: ImportStatus[] = ['new', 'quoted', 'accepted', 'rejected', 'cancelled'];
export const importStatusLabel: Record<ImportStatus, string> = {
  new: 'Koʻrib chiqilmoqda', quoted: 'Narx berildi', accepted: 'Buyurtma qilindi', rejected: 'Rad etildi', cancelled: 'Bekor qilindi',
};
export const importStatusTone: Record<ImportStatus, 'neutral' | 'card' | 'success' | 'danger' | 'warn'> = {
  new: 'warn', quoted: 'card', accepted: 'success', rejected: 'danger', cancelled: 'neutral',
};

export interface ImportQuote {
  name?: string;
  /** Bitta dona narxi (soʻm) */
  item_price: number;
  service_fee: number;
  cargo_fee: number;
  total: number;
  days?: string;
  note?: string;
  valid_until?: string | null;
}

export interface ImportRequestRow {
  id: string; number: number; user_id: string; customer_name: string; customer_phone: string;
  title: string | null; links: string[]; images: string[]; description: string | null; quantity: number;
  status: ImportStatus; quote: ImportQuote | null; quoted_at: string | null; staff_note: string | null;
  reject_reason: string | null; order_id: string | null; created_at: string; updated_at: string;
}

export const IMPORT_MAX_LINKS = 10;
export const IMPORT_MAX_IMAGES = 6;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Matndan havolalarni ajratib oladi (har qatorda yoki boʻsh joy bilan). Faqat http(s). */
export function parseLinks(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const u = raw.replace(/[),.;]+$/, '').slice(0, 1000);
    try { new URL(u); } catch { continue; }
    if (!out.includes(u)) out.push(u);
  }
  return out.slice(0, IMPORT_MAX_LINKS);
}

export const quoteTotal = (q: Pick<ImportQuote, 'item_price' | 'service_fee' | 'cargo_fee'>, quantity: number) =>
  Math.max(0, Math.round(q.item_price) * quantity + Math.round(q.service_fee) + Math.round(q.cargo_fee));

export const quoteExpired = (q: ImportQuote | null) => Boolean(q?.valid_until && new Date(q.valid_until).getTime() < Date.now());

/** Havola qaysi saytdan: 1688, Taobao… (roʻyxatda chiroyli koʻrsatish uchun) */
export function linkHost(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (/1688\.com$/.test(h)) return '1688';
    if (/taobao\.com$|tb\.cn$/.test(h)) return 'Taobao';
    if (/tmall\.com$/.test(h)) return 'Tmall';
    if (/pinduoduo|yangkeduo/.test(h)) return 'Pinduoduo';
    if (/aliexpress/.test(h)) return 'AliExpress';
    if (/poizon|dewu/.test(h)) return 'Poizon';
    return h;
  } catch { return url.slice(0, 30); }
}
