import { z } from 'zod';

// Yoʻl-yoʻriq (tushuntirish oynalari). Ega admin panelda oʻzi yozadi: qaysi sahifada, qaysi joyni yoritib,
// oʻzbek va rus tilida nima deyilsin. Saqlanmagan boʻlsa — quyidagi standart matnlar.

export type TourScope = 'shop' | 'admin';

/** Yoritish mumkin boʻlgan joylar (sahifadagi [data-tour="…"] elementlar). '' — ekran oʻrtasida. */
export const TOUR_PLACES: Record<TourScope, Array<{ value: string; label: string }>> = {
  shop: [
    { value: '', label: 'Ekran oʻrtasida (hech narsa yoritilmaydi)' },
    { value: 'search', label: 'Qidiruv' },
    { value: 'catalog', label: 'Katalog tugmasi' },
    { value: 'banner', label: 'Bosh sahifa banneri' },
    { value: 'cart', label: 'Savat tugmasi' },
    { value: 'orders', label: 'Buyurtmalarim (telefon menyusi)' },
    { value: 'profile', label: 'Profil (tepada, oʻngda)' },
    { value: 'referral', label: 'Doʻstlar (telefon menyusi)' },
    { value: 'add-to-cart', label: 'Mahsulot: “Savatga” tugmasi' },
    { value: 'coupon', label: 'Savat: promo-kod maydoni' },
    { value: 'checkout', label: 'Savat: “Rasmiylashtirish” tugmasi' },
    { value: 'place-order', label: 'Rasmiylashtirish: “Buyurtma berish” tugmasi' },
  ],
  admin: [
    { value: '', label: 'Ekran oʻrtasida (hech narsa yoritilmaydi)' },
    { value: 'modules', label: 'Yuqoridagi boʻlimlar' },
    { value: 'side', label: 'Chap menyu' },
    { value: 'menu', label: 'Menyu tugmasi (telefon)' },
    { value: 'tabs', label: 'Ochiq oynalar (tablar)' },
    { value: 'mobile-nav', label: 'Pastki tugmalar (telefon)' },
    { value: 'admin-search', label: 'Qidiruv' },
    { value: 'bell', label: 'Bildirishnomalar' },
  ],
};

/** Sahifa tanlash uchun tayyor roʻyxat (oʻz manzilingizni ham yozish mumkin; * — shu bilan boshlanadigan hamma sahifa). */
export const TOUR_PAGES: Record<TourScope, Array<{ value: string; label: string }>> = {
  shop: [
    { value: '/', label: 'Bosh sahifa' },
    { value: '/catalog', label: 'Katalog' },
    { value: '/product/*', label: 'Mahsulot sahifasi' },
    { value: '/cart', label: 'Savat' },
    { value: '/checkout', label: 'Rasmiylashtirish' },
    { value: '/sale', label: 'Aksiyalar' },
    { value: '/account', label: 'Kabinet' },
  ],
  admin: [
    { value: '/admin', label: 'Boshqaruv paneli' },
    { value: '/admin/orders', label: 'Buyurtmalar' },
    { value: '/admin/products', label: 'Mahsulotlar' },
    { value: '/admin/customers', label: 'Mijozlar' },
    { value: '/admin/bots', label: 'Telegram botlar' },
  ],
};

const text = (max: number) => z.string().trim().max(max).catch('');
export const tourStepSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/).catch(() => Math.random().toString(36).slice(2, 10)),
  page: z.string().trim().regex(/^\/[A-Za-z0-9/_*-]{0,120}$/).catch('/'),
  target: z.string().regex(/^[a-z-]{0,30}$/).catch(''),
  title: text(80),
  text: text(400),
  title_ru: text(80),
  text_ru: text(400),
});
export type TourStep = z.infer<typeof tourStepSchema>;

export const toursSchema = z.object({
  version: z.number().int().min(1).max(1_000_000).catch(1),
  enabled: z.object({ shop: z.boolean().catch(true), admin: z.boolean().catch(true) }).catch({ shop: true, admin: true }),
  shop: z.array(tourStepSchema).max(40).catch([]),
  admin: z.array(tourStepSchema).max(40).catch([]),
});
export type Tours = z.infer<typeof toursSchema>;

const s = (id: string, page: string, target: string, title: string, txt: string, title_ru: string, text_ru: string): TourStep =>
  ({ id, page, target, title, text: txt, title_ru, text_ru });

export const DEFAULT_TOURS: Tours = {
  version: 1,
  enabled: { shop: true, admin: true },
  shop: [
    s('welcome', '/', '', 'Xush kelibsiz! 👋', 'Qanday xarid qilishni bir daqiqada koʻrsatamiz. Roʻyxatdan oʻtish shart emas — Telegram orqali kirsangiz, bir bosishda akkaunt ochiladi.', 'Добро пожаловать! 👋', 'За минуту покажем, как сделать покупку. Регистрация не нужна — через Telegram аккаунт создаётся в одно касание.'),
    s('banner', '/', 'banner', 'Aksiyalar', 'Eng yangi chegirmalar shu yerda. Bannerni bossangiz, aksiya mahsulotlari ochiladi.', 'Акции', 'Свежие скидки здесь. Нажмите на баннер — откроются товары акции.'),
    s('search', '/', 'search', 'Qidiruv', 'Mahsulot nomi, brendi yoki kodini yozing — mos variantlar yozayotganingizda chiqadi.', 'Поиск', 'Введите название, бренд или код товара — подсказки появятся сразу.'),
    s('catalog', '/', 'catalog', 'Katalog', 'Hamma boʻlimlar shu yerda. Ichida narx, brend va mavjudlik boʻyicha saralash mumkin.', 'Каталог', 'Здесь все разделы. Внутри можно фильтровать по цене, бренду и наличию.'),
    s('cart', '/', 'cart', 'Savat', 'Tanlagan mahsulotlaringiz shu yerda turadi. Raqam — savatdagi mahsulotlar soni.', 'Корзина', 'Здесь ваши выбранные товары. Цифра — количество товаров в корзине.'),
    s('orders', '/', 'orders', 'Buyurtmalarim', 'Buyurtma holatini shu yerda kuzatasiz: qabul qilindi → tayyorlanmoqda → yoʻlda → yetkazildi. Telegramga ham xabar keladi.', 'Мои заказы', 'Следите за статусом: принят → собирается → в пути → доставлен. Уведомления приходят и в Telegram.'),
    s('profile', '/', 'profile', 'Profil', 'Mijoz ID raqamingiz, telefon va manzillaringiz shu yerda. Operatorga ID ni aytsangiz, sizni darhol topadi.', 'Профиль', 'Здесь ваш ID клиента, телефон и адреса. Назовите ID оператору — он сразу найдёт вас.'),
    s('referral', '/', 'referral', 'Doʻstlar', 'Doʻstingizga havolangizni yuboring: u xarid qilgach sizga kupon beriladi. Hamma bosqichdan oʻtsangiz — hamkor boʻlasiz.', 'Друзья', 'Отправьте другу свою ссылку: после его покупки вы получите купон. Пройдёте все этапы — станете партнёром.'),
    s('add', '/product/*', 'add-to-cart', 'Savatga qoʻshish', 'Rang yoki oʻlchamni tanlang va “Savatga” ni bosing. “Hozir sotib olish” — darhol rasmiylashtirishga oʻtadi.', 'Добавить в корзину', 'Выберите цвет или размер и нажмите «В корзину». «Купить сейчас» — сразу к оформлению.'),
    s('coupon', '/cart', 'coupon', 'Promo-kod', 'Kuponingiz boʻlsa, shu yerga yozing va “Qoʻllash” ni bosing — chegirma darhol hisoblanadi. Kuponlar “Aksiyalar” sahifasida.', 'Промокод', 'Есть купон? Введите его и нажмите «Применить» — скидка посчитается сразу. Купоны — на странице «Акции».'),
    s('checkout', '/cart', 'checkout', 'Rasmiylashtirish', 'Hammasi tayyor boʻlsa shu tugmani bosing. Keyingi sahifada faqat ism, telefon va manzil soʻraladi.', 'Оформление', 'Когда всё готово — нажмите сюда. Дальше нужны только имя, телефон и адрес.'),
    s('place', '/checkout', 'place-order', 'Buyurtma berish', 'Maʼlumotlarni tekshiring va bosing. Operator qoʻngʻiroq qilib tasdiqlaydi, toʻlov — yetkazilganda yoki karta orqali.', 'Оформить заказ', 'Проверьте данные и нажмите. Оператор позвонит для подтверждения, оплата — при получении или картой.'),
  ],
  admin: [
    s('a-welcome', '/admin', '', 'Admin panelga xush kelibsiz 👋', 'Asosiy joylarni koʻrsatamiz. Keyin ham yuqoridagi “?” tugmasi bilan qayta ochasiz. Bu matnlarni Sozlamalar → Yoʻl-yoʻriq boʻlimida oʻzingiz oʻzgartirasiz.', 'Добро пожаловать в админку 👋', 'Покажем основные места. Открыть снова — кнопка «?» сверху. Тексты меняются в Настройки → Подсказки.'),
    s('a-modules', '/admin', 'modules', 'Boʻlimlar', 'Savdo, Katalog, Marketing, Telegram va Sozlamalar. Boʻlimni tanlang — chapda uning sahifalari chiqadi.', 'Разделы', 'Продажи, Каталог, Маркетинг, Telegram и Настройки. Выберите раздел — слева появятся его страницы.'),
    s('a-side', '/admin', 'side', 'Boʻlim sahifalari', 'Masalan, Savdo → Buyurtmalar. Menyuni yigʻib, joyni kengaytirish mumkin.', 'Страницы раздела', 'Например, Продажи → Заказы. Меню можно свернуть.'),
    s('a-menu', '/admin', 'menu', 'Menyu', 'Telefonda barcha boʻlimlar shu tugmada.', 'Меню', 'На телефоне все разделы — в этой кнопке.'),
    s('a-tabs', '/admin', 'tabs', 'Ochiq oynalar', 'Ochgan sahifalaringiz tab boʻlib turadi — ular orasida bir bosishda oʻtasiz.', 'Открытые вкладки', 'Открытые страницы остаются вкладками — переключайтесь в одно касание.'),
    s('a-search', '/admin', 'admin-search', 'Tezkor qidiruv', 'Buyurtma raqami, telefon yoki mijoz ID sini yozing.', 'Быстрый поиск', 'Введите номер заказа, телефон или ID клиента.'),
    s('a-nav', '/admin', 'mobile-nav', 'Tezkor tugmalar', 'Bosh sahifa, buyurtmalar, mahsulotlar va oʻrtada “+” — yangi mahsulot yoki buyurtma.', 'Быстрые кнопки', 'Главная, заказы, товары и «+» в центре — новый товар или заказ.'),
    s('a-bell', '/admin', 'bell', 'Bildirishnomalar', 'Yangi buyurtma, sharh va kam qolgan mahsulotlar shu yerda. Telegramga ham keladi.', 'Уведомления', 'Новые заказы, отзывы и заканчивающиеся товары. Дублируются в Telegram.'),
    s('a-bots', '/admin', '', 'Telegram botlar', 'Yuqoridagi Telegram boʻlimi → Botlar. Doʻkon boti (xaridorlar) va admin boti (siz) shu yerda ulanadi.', 'Telegram-боты', 'Раздел Telegram → Боты. Здесь подключаются бот магазина (покупатели) и админ-бот (вы).'),
  ],
};

/** Qadam shu sahifaga tegishlimi: aniq manzil yoki “/product/*” koʻrinishidagi boshlanish. */
export function pageMatches(pattern: string, path: string) {
  if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

export const cleanTours = (raw: unknown): Tours => {
  const parsed = toursSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_TOURS;
};
