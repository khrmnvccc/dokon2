// Import/eksport ustunlari (bir xil fayl qayta import qilinishi mumkin)
export const PRODUCT_SHEET_COLUMNS = [
  { key: 'sku', header: 'sku', width: 16 },
  { key: 'name', header: 'name', width: 40 },
  { key: 'slug', header: 'slug', width: 30 },
  { key: 'category', header: 'category', width: 20 },
  { key: 'brand', header: 'brand', width: 14 },
  { key: 'price', header: 'price', width: 12 },
  { key: 'compare_at_price', header: 'compare_at_price', width: 14 },
  { key: 'cost_price', header: 'cost_price', width: 12 },
  { key: 'stock', header: 'stock', width: 8 },
  { key: 'barcode', header: 'barcode', width: 16 },
  { key: 'is_active', header: 'is_active', width: 9 },
  { key: 'is_featured', header: 'is_featured', width: 10 },
  { key: 'is_bestseller', header: 'is_bestseller', width: 11 },
  { key: 'is_new', header: 'is_new', width: 8 },
  { key: 'short_description', header: 'short_description', width: 40 },
  { key: 'description', header: 'description', width: 60 },
  { key: 'image_url', header: 'image_url', width: 40 },
  { key: 'seo_title', header: 'seo_title', width: 30 },
  { key: 'seo_description', header: 'seo_description', width: 40 },
] as const;

/** Import'da o'zbekcha sarlavhalarni ham qabul qilish */
export const PRODUCT_HEADER_ALIASES: Record<string, string> = {
  artikul: 'sku', nomi: 'name', kategoriya: 'category', brend: 'brand', narx: 'price', 'eski narx': 'compare_at_price',
  tannarx: 'cost_price', qoldiq: 'stock', 'shtrix-kod': 'barcode', faol: 'is_active', rasm: 'image_url', tavsif: 'description',
};
