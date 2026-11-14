export interface AdminNavItem { href: string; label: string; icon: string; perm: string; paused?: boolean }
/** Yuqori paneldagi boʻlim (modul): ikonka bilan, ichida chap menyudagi sahifalar. */
export interface AdminNavGroup { title: string; icon: string; items: AdminNavItem[] }

// Boʻlimlar yuqori toʻq panelda ikonka boʻlib turadi; tanlangan boʻlim sahifalari chap menyuda.
// Har sahifa faqat ruxsati bor xodimga koʻrinadi; sahifa va server action'larda ruxsat qayta tekshiriladi.
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Boshqaruv paneli',
    icon: 'LayoutDashboard',
    items: [
      { href: '/admin', label: 'Boshqaruv paneli', icon: 'LayoutDashboard', perm: 'dashboard.view' },
      { href: '/admin/reports', label: 'Hisobotlar', icon: 'BarChart3', perm: 'reports.view' },
      { href: '/admin/audit', label: 'Faoliyat jurnali', icon: 'History', perm: 'audit.view' },
    ],
  },
  {
    title: 'Savdo',
    icon: 'ShoppingBag',
    items: [
      { href: '/admin/orders', label: 'Buyurtmalar', icon: 'ShoppingBag', perm: 'orders.read' },
      { href: '/admin/customers', label: 'Mijozlar', icon: 'Users', perm: 'customers.read' },
      { href: '/admin/reviews', label: 'Sharhlar', icon: 'MessageSquare', perm: 'reviews.moderate' },
    ],
  },
  {
    title: 'Katalog',
    icon: 'Package',
    items: [
      { href: '/admin/products', label: 'Mahsulotlar', icon: 'Package', perm: 'products.read' },
      { href: '/admin/categories', label: 'Kategoriyalar', icon: 'FolderTree', perm: 'categories.write' },
      { href: '/admin/inventory', label: 'Ombor', icon: 'Warehouse', perm: 'inventory.write' },
    ],
  },
  {
    title: 'Marketing',
    icon: 'Megaphone',
    items: [
      { href: '/admin/promotions', label: 'Aksiyalar', icon: 'Gift', perm: 'promotions.write' },
      { href: '/admin/coupons', label: 'Promo-kodlar', icon: 'TicketPercent', perm: 'coupons.write' },
      { href: '/admin/partners', label: 'Hamkorlar', icon: 'Handshake', perm: 'partners.manage' },
      { href: '/admin/referral-stats', label: 'Foydalanish', icon: 'ChartPie', perm: 'partners.manage' },
      { href: '/admin/banners', label: 'Bannerlar', icon: 'Image', perm: 'banners.write' },
    ],
  },
  {
    // Ikkala bot (doʻkon boti — xaridorlar, admin boti — xodimlar) bitta joyda boshqariladi.
    title: 'Telegram',
    icon: 'Send',
    items: [
      { href: '/admin/bots', label: 'Botlar', icon: 'Bot', perm: 'messages.manage' },
      { href: '/admin/messages', label: 'Xabarlar va Push', icon: 'BellRing', perm: 'messages.manage' },
      { href: '/admin/telegram', label: 'Mening Telegramim', icon: 'Send', perm: 'dashboard.view' },
    ],
  },
  {
    title: 'Sozlamalar',
    icon: 'Settings',
    items: [
      { href: '/admin/settings', label: 'Sozlamalar', icon: 'Settings', perm: 'settings.write' },
      { href: '/admin/staff', label: 'Xodimlar', icon: 'ShieldCheck', perm: 'staff.manage' },
      { href: '/admin/methods', label: 'Yetkazish va toʻlov', icon: 'Truck', perm: 'payments.write' },
      { href: '/admin/pages', label: 'Sahifalar', icon: 'FileText', perm: 'pages.write' },
      { href: '/admin/translations', label: 'Tarjimalar (ruscha)', icon: 'Languages', perm: 'settings.write' },
      { href: '/admin/tours', label: 'Yoʻl-yoʻriq', icon: 'Lightbulb', perm: 'settings.write' },
    ],
  },
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Ega',
  manager: 'Admin',
  operator: 'Operator',
  warehouse: 'Omborchi',
};

/** Admin menyusining ruscha nomlari (til RU tanlanganda). Brend sozlamasida oʻzgartirilgan nomlar ustun turadi. */
export const NAV_RU: Record<string, string> = {
  'Boshqaruv paneli': 'Панель управления', 'Hisobotlar': 'Отчёты', 'Faoliyat jurnali': 'Журнал действий',
  'Savdo': 'Продажи', 'Buyurtmalar': 'Заказы', 'Mijozlar': 'Клиенты', 'Sharhlar': 'Отзывы',
  'Katalog': 'Каталог', 'Mahsulotlar': 'Товары', 'Kategoriyalar': 'Категории', 'Ombor': 'Склад',
  'Marketing': 'Маркетинг', 'Aksiyalar': 'Акции', 'Promo-kodlar': 'Промокоды', 'Bannerlar': 'Баннеры', 'Hamkorlar': 'Партнёры', 'Foydalanish': 'Использование',
  'Telegram': 'Telegram', 'Botlar': 'Боты', 'Xabarlar va Push': 'Сообщения и Push', 'Mening Telegramim': 'Мой Telegram',
  'Sozlamalar': 'Настройки', 'Xodimlar': 'Сотрудники', 'Yetkazish va toʻlov': 'Доставка и оплата', 'Sahifalar': 'Страницы', 'Yoʻl-yoʻriq': 'Подсказки', 'Tarjimalar (ruscha)': 'Переводы',
  // Qobiq matnlari
  'Admin panel': 'Админ-панель', 'Menyu': 'Меню', 'Asosiy': 'Главная', 'Saytni ochish': 'Открыть сайт', 'Chiqish': 'Выйти',
  'Yoʻriqnoma': 'Подсказки', 'Bildirishnomalar': 'Уведомления', 'Hammasi oʻqildi': 'Прочитать все', 'Yangi bildirishnoma yoʻq': 'Новых уведомлений нет',
  'Buyurtma №, telefon…': '№ заказа, телефон…', 'Barcha filiallar': 'Все филиалы', 'Menyuni ochish': 'Развернуть меню', 'Menyuni yigʻish': 'Свернуть меню',
  'Yorugʻ rejim': 'Светлая тема', 'Qorongʻi rejim': 'Тёмная тема', 'Yopish': 'Закрыть', 'Vaqtincha': 'Пауза', 'Yangi mahsulot': 'Новый товар',
};
