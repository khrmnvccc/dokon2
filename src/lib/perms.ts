// Ruxsatlar ro'yxati (kassa 3.2): server ham, brauzer ham shu bitta faylni o'qiydi.
// Har biri xodim formasida nomi va bir qatorli izohi bilan chiqadi.

export interface PermDef { key: string; label: string; hint: string; ownerOnly?: boolean }
export interface PermGroup { title: string; perms: PermDef[] }

export const PERM_GROUPS: PermGroup[] = [
  {
    title: 'Buyurtmalar',
    perms: [
      { key: 'orders.read', label: 'Koʻrish', hint: 'Buyurtmalar roʻyxati va tafsilotlari' },
      { key: 'orders.write', label: 'Holat oʻzgartirish', hint: 'Tasdiqlash, izoh, trek raqami, toʻlov holati' },
      { key: 'orders.fulfill', label: 'Yigʻish va joʻnatish', hint: 'Yigʻilmoqda → Yoʻlda → Yetkazildi' },
      { key: 'orders.cancel', label: 'Bekor qilish', hint: 'Buyurtmani sababi bilan bekor qilish yoki qaytarish' },
    ],
  },
  {
    title: 'Mahsulotlar',
    perms: [
      { key: 'products.read', label: 'Koʻrish', hint: 'Mahsulotlar roʻyxati' },
      { key: 'products.write', label: 'Tahrirlash va narx', hint: 'Qoʻshish, tahrirlash, narx va chegirma, import' },
      { key: 'products.delete', label: 'Oʻchirish', hint: 'Mahsulotni butunlay oʻchirish' },
      { key: 'inventory.write', label: 'Qoldiqni tuzatish', hint: 'Ombor kirim-chiqimi' },
      { key: 'categories.write', label: 'Kategoriyalar', hint: 'Kategoriya qoʻshish va tartibi' },
      { key: 'media.write', label: 'Rasm yuklash', hint: 'Mahsulot va banner rasmlari' },
    ],
  },
  {
    title: 'Toʻlovlar',
    perms: [
      { key: 'payments.write', label: 'Yetkazish va toʻlov usullari', hint: 'Narxlar, usullarni yoqish/oʻchirish' },
      { key: 'coupons.write', label: 'Promo-kodlar', hint: 'Foiz yoki summa, muddat va limit' },
      { key: 'promotions.write', label: 'Aksiyalar', hint: 'Chegirma aksiyalari' },
    ],
  },
  {
    title: 'Hisobotlar',
    perms: [
      { key: 'dashboard.view', label: 'Dashboard', hint: 'Bugungi savdo va jonli lenta' },
      { key: 'reports.view', label: 'Hisobotlar', hint: 'Kunlik, haftalik, oylik va tannarx' },
    ],
  },
  {
    title: 'Mijozlar',
    perms: [
      { key: 'customers.read', label: 'Koʻrish', hint: 'Mijozlar va ularning buyurtmalari' },
      { key: 'customers.block', label: 'Bloklash', hint: 'Mijozni bloklash yoki blokdan chiqarish' },
      { key: 'reviews.moderate', label: 'Sharhlar', hint: 'Sharhlarni koʻrsatish yoki yashirish' },
    ],
  },
  {
    title: 'Sayt',
    perms: [
      { key: 'banners.write', label: 'Bannerlar', hint: 'Bosh sahifa bannerlari' },
      { key: 'pages.write', label: 'Sahifalar', hint: 'Biz haqimizda, FAQ va boshqa matnlar' },
      { key: 'settings.write', label: 'Sozlamalar', hint: 'Aloqa, bosh sahifa, SEO, oynalar' },
    ],
  },
  {
    title: 'Xodimlar',
    perms: [
      { key: 'staff.manage', label: 'Boshqarish', hint: 'Xodim qoʻshish, ruxsat va filial berish' },
      { key: 'audit.view', label: 'Faoliyat jurnali', hint: 'Kim nimani oʻzgartirgani' },
    ],
  },
  {
    title: 'Xabarlar',
    perms: [
      { key: 'messages.manage', label: 'Xabarlarni boshqarish', hint: 'Telegram shablonlari va ommaviy xabar (faqat Ega beradi)', ownerOnly: true },
    ],
  },
];

export const ALL_PERMS = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key));
export const PERM_LABEL: Record<string, string> = Object.fromEntries(
  PERM_GROUPS.flatMap((g) => g.perms.map((p) => [p.key, `${g.title}: ${p.label}`])),
);

/** Tayyor to'plamlar: bitta bosishda belgilanadi, keyin qo'lda o'zgartirsa bo'ladi. */
export const PRESETS: Array<{ key: string; label: string; perms: string[] }> = [
  { key: 'operator', label: 'Operator', perms: ['dashboard.view', 'orders.read', 'orders.write', 'orders.fulfill', 'orders.cancel', 'customers.read', 'products.read', 'reviews.moderate'] },
  { key: 'cashier', label: 'Kassir', perms: ['dashboard.view', 'orders.read', 'orders.write', 'customers.read', 'products.read', 'reports.view'] },
  { key: 'warehouse', label: 'Omborchi', perms: ['dashboard.view', 'products.read', 'inventory.write', 'orders.read', 'orders.fulfill'] },
];

/** Admin'ning standart ruxsatlari: hammasi, faqat "Xabarlarni boshqarish"siz. */
export const ADMIN_DEFAULT = ALL_PERMS.filter((p) => p !== 'messages.manage' && p !== 'branches.manage');

/** Rol nomi ruxsatga qarab: Ega / Admin / Kassir / Operator / Omborchi / Ishchi. */
export function roleLabel(roles: string[], perms: string[] | null): string {
  if (roles.includes('super_admin')) return 'Ega';
  if (roles.includes('manager')) return 'Admin';
  const set = new Set(perms ?? []);
  if (perms) {
    if (set.has('inventory.write') && !set.has('orders.write')) return 'Omborchi';
    if (set.has('reports.view') && set.has('orders.write')) return 'Kassir';
    if (set.has('orders.write')) return 'Operator';
    return 'Ishchi';
  }
  if (roles.includes('warehouse')) return 'Omborchi';
  if (roles.includes('operator')) return 'Operator';
  return 'Ishchi';
}
