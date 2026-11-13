export interface AdminNavItem { href: string; label: string; icon: string; perm: string; paused?: boolean }
export interface AdminNavGroup { title: string; items: AdminNavItem[] }

// Kassa tuzilishi: Asosiy / Hisobotlar / Boshqaruv. Har bo'lim faqat ruxsati bor xodimga ko'rinadi;
// sahifa va server action'larda ruxsat qayta tekshiriladi.
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Asosiy',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'LayoutDashboard', perm: 'dashboard.view' },
      { href: '/admin/orders', label: 'Buyurtmalar', icon: 'ShoppingBag', perm: 'orders.read' },
      { href: '/admin/products', label: 'Mahsulotlar', icon: 'Package', perm: 'products.read' },
      { href: '/admin/categories', label: 'Kategoriyalar', icon: 'FolderTree', perm: 'categories.write' },
      { href: '/admin/inventory', label: 'Ombor', icon: 'Warehouse', perm: 'inventory.write' },
    ],
  },
  {
    title: 'Hisobotlar',
    items: [
      { href: '/admin/reports', label: 'Savdo hisobotlari', icon: 'BarChart3', perm: 'reports.view' },
    ],
  },
  {
    title: 'Boshqaruv',
    items: [
      { href: '/admin/customers', label: 'Mijozlar', icon: 'Users', perm: 'customers.read' },
      { href: '/admin/reviews', label: 'Sharhlar', icon: 'MessageSquare', perm: 'reviews.moderate' },
      { href: '/admin/banners', label: 'Bannerlar', icon: 'Image', perm: 'banners.write' },
      { href: '/admin/promotions', label: 'Aksiyalar', icon: 'Percent', perm: 'promotions.write' },
      { href: '/admin/coupons', label: 'Promo-kodlar', icon: 'TicketPercent', perm: 'coupons.write' },
      { href: '/admin/pages', label: 'Sahifalar', icon: 'FileText', perm: 'pages.write' },
      { href: '/admin/methods', label: 'Yetkazish va toʻlov', icon: 'Truck', perm: 'payments.write' },
      { href: '/admin/messages', label: 'Xabarlar', icon: 'Send', perm: 'messages.manage' },
      { href: '/admin/staff', label: 'Xodimlar', icon: 'ShieldCheck', perm: 'staff.manage' },
      { href: '/admin/audit', label: 'Faoliyat jurnali', icon: 'History', perm: 'audit.view' },
      { href: '/admin/settings', label: 'Sozlamalar', icon: 'Settings', perm: 'settings.write' },
      { href: '/admin/telegram', label: 'Mening Telegramim', icon: 'Bot', perm: 'dashboard.view' },
    ],
  },
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Ega',
  manager: 'Admin',
  operator: 'Operator',
  warehouse: 'Omborchi',
};
