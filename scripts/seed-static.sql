-- ---------- Yetkazib berish usullari ----------
insert into public.shipping_methods (name, description, kind, price, free_from, eta, requires_address, sort_order)
select * from (values
  ('Toshkent bo''ylab kuryer', 'Toshkent shahri ichida eshikkacha yetkazib berish', 'courier', 25000::bigint, null::bigint, '1 kun', true, 0),
  ('Viloyatlarga yetkazib berish', 'O''zbekistonning barcha viloyatlariga', 'post', 45000::bigint, null::bigint, '2–4 kun', true, 1),
  ('Do''kondan olib ketish', 'Toshkent, Chilonzor tumani, Bunyodkor ko''chasi 1', 'pickup', 0::bigint, null::bigint, 'Bugun', false, 2)
) v (name, description, kind, price, free_from, eta, requires_address, sort_order)
where not exists (select 1 from public.shipping_methods);

-- ---------- To'lov usullari ----------
insert into public.payment_methods (code, name, description, kind, provider, is_active, sort_order) values
  ('cash', 'Naqd pul', 'Buyurtmani qabul qilganda naqd to''lash', 'cash', null, true, 0),
  ('card_on_delivery', 'Karta orqali (yetkazib berishda)', 'Kuryerga Uzcard/Humo terminal orqali to''lash', 'card_on_delivery', null, true, 1),
  ('click', 'Click', 'Click orqali onlayn to''lov (ulanmagan — kalitlar kerak)', 'online', 'click', false, 2),
  ('payme', 'Payme', 'Payme orqali onlayn to''lov (ulanmagan — kalitlar kerak)', 'online', 'payme', false, 3)
on conflict (code) do nothing;

-- ---------- Kupon va aksiya ----------
insert into public.coupons (code, description, discount_type, value, max_discount, min_order_amount, per_user_limit, is_active)
values ('XUSH10', 'Birinchi buyurtmaga 10% (maks. 100 000 so''m)', 'percent', 10, 100000, 200000, 1, true)
on conflict (code) do nothing;
insert into public.coupons (code, description, discount_type, value, min_order_amount, scope, category_ids, is_active)
values ('TEXNO50', 'Elektronikaga 50 000 so''m chegirma', 'fixed', 50000, 1000000, 'category',
  array[(select id from public.categories where slug = 'elektronika')], true)
on conflict (code) do nothing;

insert into public.promotions (title, slug, description, image_url, discount_type, value, scope, category_ids, is_active, sort_order)
values ('Go''zallik haftaligi', 'gozallik-haftaligi', 'Go''zallik mahsulotlariga qo''shimcha 15% chegirma', '/demo/banners/banner-6.svg',
  'percent', 15, 'category', array[(select id from public.categories where slug = 'gozallik')], true, 0)
on conflict (slug) do nothing;

-- ---------- Sayt sozlamalari ----------
insert into public.site_settings (key, value) values
('store', '{"name": "Bozorcha", "tagline": "Hamma narsa — bir joyda", "logo_url": null, "favicon_url": null, "primary_color": "#0e7c66", "accent_color": "#f97316"}'),
('contact', '{"phone": "+998 71 200 00 00", "phone2": "+998 90 000 00 00", "email": "info@bozorcha.uz", "address": "Toshkent sh., Chilonzor tumani, Bunyodkor ko''chasi 1", "working_hours": "Har kuni 09:00 – 21:00", "map_url": null}'),
('social', '{"telegram": "https://t.me/", "instagram": "https://instagram.com/", "facebook": null, "youtube": null, "tiktok": null}'),
('home_sections', '[
  {"key": "hero", "title": "Bannerlar", "enabled": true},
  {"key": "categories", "title": "Ommabop kategoriyalar", "enabled": true},
  {"key": "bestsellers", "title": "Eng ko''p sotilayotganlar", "enabled": true},
  {"key": "promo", "title": "Maxsus taklif", "enabled": true},
  {"key": "new", "title": "Yangi kelganlar", "enabled": true},
  {"key": "sale", "title": "Chegirmadagi mahsulotlar", "enabled": true},
  {"key": "middle_banner", "title": "Reklama banneri", "enabled": true},
  {"key": "featured", "title": "Siz uchun tavsiya", "enabled": true},
  {"key": "advantages", "title": "Nega bizni tanlashadi", "enabled": true}
]'),
('header_menu', '[
  {"label": "Chegirmalar", "href": "/sale"},
  {"label": "Yangi kelganlar", "href": "/catalog?new=1"},
  {"label": "Elektronika", "href": "/category/elektronika"},
  {"label": "Kiyim", "href": "/category/kiyim"},
  {"label": "Yetkazib berish", "href": "/delivery"}
]'),
('footer', '{"about_text": "Bozorcha — O''zbekiston bo''ylab tez yetkazib beriladigan zamonaviy internet-do''kon.", "copyright": "© Bozorcha. Barcha huquqlar himoyalangan.", "columns": [
  {"title": "Xaridorlarga", "links": [{"label": "Yetkazib berish va to''lov", "href": "/delivery"}, {"label": "Buyurtma holati", "href": "/track"}, {"label": "FAQ", "href": "/faq"}]},
  {"title": "Kompaniya", "links": [{"label": "Biz haqimizda", "href": "/about"}, {"label": "Aloqa", "href": "/contact"}, {"label": "Aksiyalar", "href": "/sale"}]},
  {"title": "Huquqiy", "links": [{"label": "Maxfiylik siyosati", "href": "/privacy"}, {"label": "Foydalanish shartlari", "href": "/terms"}]}
]}'),
('checkout', '{"min_order_amount": 50000, "free_shipping_threshold": 500000, "allow_guest_checkout": true, "order_note": "Operatorimiz buyurtmani tasdiqlash uchun siz bilan bog''lanadi."}'),
('localization', '{"default_language": "uz", "languages": ["uz", "ru"], "currency": "UZS", "currency_symbol": "so''m"}'),
('seo', '{"title": "Bozorcha — onlayn do''kon", "title_template": "%s | Bozorcha", "description": "Elektronika, kiyim, maishiy texnika va boshqa mahsulotlar qulay narxlarda. O''zbekiston bo''ylab tez yetkazib berish.", "keywords": "onlayn do''kon, internet magazin, Toshkent, yetkazib berish", "og_image_url": null}'),
('maintenance', '{"enabled": false, "message": "Saytda texnik ishlar olib borilmoqda. Tez orada qaytamiz!"}'),
('advantages', '[
  {"icon": "truck", "title": "Tez yetkazib berish", "text": "Toshkent bo''ylab 1 kunda"},
  {"icon": "shield-check", "title": "Kafolatlangan sifat", "text": "Faqat original mahsulotlar"},
  {"icon": "rotate-ccw", "title": "Oson qaytarish", "text": "14 kun ichida qaytarish"},
  {"icon": "headphones", "title": "Qo''llab-quvvatlash", "text": "Har kuni 09:00 dan 21:00 gacha"}
]'),
('announcement', '{"enabled": true, "text": "500 000 so''mdan ortiq buyurtmalarga yetkazib berish bepul!", "link": "/delivery"}')
on conflict (key) do nothing;

-- ---------- Sahifalar ----------
insert into public.pages (slug, title, content, seo_description) values
('about', 'Biz haqimizda', '## Bozorcha haqida

Bozorcha — O''zbekiston xaridorlari uchun yaratilgan zamonaviy internet-do''kon. Biz minglab mahsulotlarni qulay narxlarda taklif qilamiz va ularni tez yetkazib beramiz.

## Bizning qadriyatlarimiz
- **Ishonch** — faqat original va sifatli mahsulotlar
- **Tezlik** — buyurtmalarni imkon qadar tez yetkazish
- **Qulaylik** — oson xarid va qulay to''lov usullari', 'Bozorcha internet-do''koni haqida'),
('delivery', 'Yetkazib berish va to''lov', '## Yetkazib berish

- **Toshkent bo''ylab** — 1 kun ichida, 25 000 so''m
- **Viloyatlarga** — 2–4 kun ichida, 45 000 so''m
- **Do''kondan olib ketish** — bepul

500 000 so''mdan ortiq buyurtmalar uchun yetkazib berish bepul.

## To''lov usullari

- Naqd pul bilan, buyurtmani qabul qilganda
- Uzcard/Humo kartasi orqali, kuryer terminalida

## Qaytarish

Mahsulotni 14 kun ichida, tovar ko''rinishi saqlangan holda qaytarishingiz mumkin.', 'Yetkazib berish narxlari, muddatlari va to''lov usullari'),
('contact', 'Aloqa', 'Savollaringiz bo''lsa, biz bilan bog''laning. Operatorlarimiz har kuni 09:00 dan 21:00 gacha ishlaydi.', 'Bozorcha bilan bog''lanish'),
('faq', 'Ko''p beriladigan savollar', '### Buyurtmani qanday beraman?
Mahsulotni savatchaga qo''shing, so''ng "Rasmiylashtirish" tugmasini bosing va ma''lumotlaringizni kiriting.

### Ro''yxatdan o''tish shartmi?
Yo''q, mehmon sifatida ham buyurtma berishingiz mumkin. Ammo ro''yxatdan o''tsangiz, buyurtmalar tarixini kuzatish oson bo''ladi.

### Buyurtma qachon yetkaziladi?
Toshkent bo''ylab 1 kun, viloyatlarga 2–4 kun ichida.

### Buyurtma holatini qanday bilaman?
Profilingizdagi "Buyurtmalarim" bo''limida yoki "Buyurtma holati" sahifasida buyurtma raqami va telefon orqali.

### Mahsulotni qaytarish mumkinmi?
Ha, 14 kun ichida tovar ko''rinishi saqlangan bo''lsa.', 'Ko''p beriladigan savollarga javoblar'),
('privacy', 'Maxfiylik siyosati', '## Qanday ma''lumot to''playmiz
Buyurtmani bajarish uchun ismingiz, telefon raqamingiz va manzilingizni saqlaymiz.

## Ma''lumotlardan foydalanish
Ma''lumotlaringiz faqat buyurtmalarni bajarish va siz bilan bog''lanish uchun ishlatiladi. Uchinchi shaxslarga sotilmaydi.

## Xavfsizlik
Parollar shifrlangan holda saqlanadi va hech kimga ko''rsatilmaydi.', 'Shaxsiy ma''lumotlarni himoya qilish siyosati'),
('terms', 'Foydalanish shartlari', '## Umumiy qoidalar
Saytdan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz.

## Narxlar
Narxlar so''mda ko''rsatilgan. Buyurtma rasmiylashtirilgan paytdagi narx amal qiladi.

## Javobgarlik
Do''kon mahsulot tavsifidagi ma''lumotlarning to''g''riligi uchun javob beradi.', 'Saytdan foydalanish shartlari')
on conflict (slug) do nothing;
