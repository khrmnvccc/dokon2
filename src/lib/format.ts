const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** 1290000 -> "1 290 000 so'm" */
export function formatPrice(value: number | null | undefined, symbol = "so'm"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${numberFormatter.format(Math.round(value)).replace(/ /g, ' ')} ${symbol}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return numberFormatter.format(value).replace(/ /g, ' ');
}

export function discountPercent(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price || compareAt <= 0) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Toshkent vaqti bo'yicha "23.10.2026 14:05" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatDateTime(iso).slice(0, 10);
}

export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '',
    ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
  };
  return input
    .toLowerCase()
    .replace(/[ʻʼ'‘’`]/g, '')
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
