export interface AdminNavItem { href: string; label: string; icon: string; perm: string }
export interface AdminNavGroup { title: string; items: AdminNavItem[] }

// Har bir bo'lim faqat tegishli ruxsati bor xodimga ko'rinadi. Sahifa va server action'larda ruxsat qayta tekshiriladi.
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Asosiy',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'LayoutDashboard', perm: 'dashboard.view' },
      { href: '/admin/orders', label: 'Buyurtmalar', icon: 'ShoppingBag', perm: 'orders.read' },
      { href: '/admin/customers', label: 'Mijozlar', icon: 'Users', perm: 'customers.read' },
      { href: '/admin/reports', label: 'Hisobotlar', icon: 'BarChart3', perm: 'reports.view' },
    ],
  },
  {
    title: 'Katalog',
    items: [
      { href: '/admin/products', label: 'Mahsulotlar', icon: 'Package', perm: 'products.read' },
      { href: '/admin/categories', label: 'Kategoriyalar', icon: 'FolderTree', perm: 'categories.write' },
      { href: '/admin/inventory', label: 'Ombor', icon: 'Warehouse', perm: 'inventory.write' },
      { href: '/admin/reviews', label: 'Sharhlar', icon: 'MessageSquare', perm: 'reviews.moderate' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { href: '/admin/banners', label: 'Bannerlar', icon: 'Image', perm: 'banners.write' },
      { href: '/admin/promotions', label: 'Aksiyalar', icon: 'Percent', perm: 'promotions.write' },
      { href: '/admin/coupons', label: 'Promo-kodlar', icon: 'TicketPercent', perm: 'coupons.write' },
    ],
  },
  {
    title: 'Sayt',
    items: [
      { href: '/admin/pages', label: 'Sahifalar', icon: 'FileText', perm: 'pages.write' },
      { href: '/admin/methods', label: 'Yetkazish va to‘lov', icon: 'Truck', perm: 'payments.write' },
      { href: '/admin/settings', label: 'Sozlamalar', icon: 'Settings', perm: 'settings.write' },
    ],
  },
  {
    title: 'Tizim',
    items: [
      { href: '/admin/staff', label: 'Xodimlar va rollar', icon: 'ShieldCheck', perm: 'staff.manage' },
      { href: '/admin/audit', label: 'Audit jurnali', icon: 'History', perm: 'audit.view' },
    ],
  },
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  manager: 'Menejer',
  operator: 'Operator',
  warehouse: 'Ombor xodimi',
};
