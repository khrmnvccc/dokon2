-- AVTOMATIK GENERATSIYA QILINGAN: scripts/generate-seed.mjs
-- Demo ma'lumotlar. Takroriy ishga tushirish xavfsiz (on conflict do nothing).
-- Buyurtmalar seed qilinmaydi: dashboard faqat haqiqiy buyurtmalarni ko'rsatadi.
begin;

insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Elektronika', 'elektronika', 'smartphone', '/demo/categories/elektronika.svg', 0, true) on conflict (slug) do nothing;
insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = 'elektronika'), 'Smartfonlar', 'smartfonlar', 'smartphone', '/demo/categories/smartfonlar.svg', 0, false) on conflict (slug) do nothing;
insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = 'elektronika'), 'Noutbuklar', 'noutbuklar', 'laptop', '/demo/categories/noutbuklar.svg', 1, false) on conflict (slug) do nothing;
insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = 'elektronika'), 'Quloqchinlar', 'quloqchinlar', 'headphones', '/demo/categories/quloqchinlar.svg', 2, false) on conflict (slug) do nothing;
insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = 'elektronika'), 'Aqlli soatlar', 'aqlli-soatlar', 'watch', '/demo/categories/aqlli-soatlar.svg', 3, false) on conflict (slug) do nothing;
insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Kiyim-kechak', 'kiyim', 'shirt', '/demo/categories/kiyim.svg', 1, true) on conflict (slug) do nothing;
insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = 'kiyim'), 'Erkaklar kiyimi', 'erkaklar-kiyimi', 'shirt', '/demo/categories/erkaklar-kiyimi.svg', 0, false) on conflict (slug) do nothing;
insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = 'kiyim'), 'Ayollar kiyimi', 'ayollar-kiyimi', 'shopping-bag', '/demo/categories/ayollar-kiyimi.svg', 1, false) on conflict (slug) do nothing;
insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Poyabzal', 'poyabzal', 'footprints', '/demo/categories/poyabzal.svg', 2, true) on conflict (slug) do nothing;
insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Maishiy texnika', 'maishiy-texnika', 'refrigerator', '/demo/categories/maishiy-texnika.svg', 3, true) on conflict (slug) do nothing;
insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = 'maishiy-texnika'), 'Oshxona texnikasi', 'oshxona-texnikasi', 'coffee', '/demo/categories/oshxona-texnikasi.svg', 0, false) on conflict (slug) do nothing;
insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = 'maishiy-texnika'), 'Televizorlar', 'televizorlar', 'tv', '/demo/categories/televizorlar.svg', 1, false) on conflict (slug) do nothing;
insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Uy va bog''', 'uy-va-bog', 'sofa', '/demo/categories/uy-va-bog.svg', 4, true) on conflict (slug) do nothing;
insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Go''zallik', 'gozallik', 'sparkles', '/demo/categories/gozallik.svg', 5, true) on conflict (slug) do nothing;
insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Bolalar uchun', 'bolalar', 'baby', '/demo/categories/bolalar.svg', 6, true) on conflict (slug) do nothing;
insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Sport va dam olish', 'sport', 'dumbbell', '/demo/categories/sport.svg', 7, true) on conflict (slug) do nothing;
insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values ('Kitoblar', 'kitoblar', 'book-open', '/demo/categories/kitoblar.svg', 8, true) on conflict (slug) do nothing;
create temporary table if not exists _demo (slug text, name text, cat text, price bigint, compare bigint, cost bigint, stock int, flags text, brand text, vkind text, country text, n int);
insert into _demo
select * from (values
('smartfon-nova-x12', 'Smartfon Nova X12 8/256 GB', 'smartfonlar', 4290000, 4990000, 3500000, 25, 'fbn', 'Nova', null, 'Xitoy', 0),
('smartfon-lumo-a5', 'Smartfon Lumo A5 4/128 GB', 'smartfonlar', 1890000, null, 1450000, 40, 'b', 'Lumo', null, 'O''zbekiston', 1),
('smartfon-orbit-pro', 'Smartfon Orbit Pro 12/512 GB', 'smartfonlar', 9790000, 10990000, 8200000, 8, 'fn', 'Orbit', null, 'Turkiya', 2),
('noutbuk-zenbook-14', 'Noutbuk Aero 14 Intel Core i5, 16 GB', 'noutbuklar', 8450000, 9200000, 7100000, 12, 'fb', 'Aero', null, 'Xitoy', 3),
('noutbuk-office-15', 'Noutbuk Office 15 Ryzen 5, 8 GB', 'noutbuklar', 5990000, null, 5000000, 3, 'n', 'Office', null, 'O''zbekiston', 4),
('quloqchin-pulse-buds', 'Simsiz quloqchin Pulse Buds ANC', 'quloqchinlar', 549000, 790000, 320000, 60, 'fb', 'Pulse', null, 'Turkiya', 5),
('quloqchin-studio-max', 'Quloqchin Studio Max (to‘liq o‘lchamli)', 'quloqchinlar', 1290000, null, 900000, 15, 'n', 'Studio', null, 'Xitoy', 6),
('aqlli-soat-fit-3', 'Aqlli soat Fit 3 AMOLED', 'aqlli-soatlar', 690000, 850000, 450000, 30, 'b', 'Fit', null, 'O''zbekiston', 7),
('aqlli-soat-active-gps', 'Aqlli soat Active GPS', 'aqlli-soatlar', 1150000, null, 820000, 0, '', 'Active', null, 'Turkiya', 8),
('erkaklar-futbolka-basic', 'Erkaklar paxta futbolkasi Basic', 'erkaklar-kiyimi', 119000, 159000, 60000, 0, 'bn', 'Bozor Style', 'clothing', 'Xitoy', 9),
('erkaklar-kurtka-winter', 'Erkaklar qishki kurtkasi', 'erkaklar-kiyimi', 890000, 1190000, 520000, 0, 'fn', 'North', 'clothing', 'O''zbekiston', 10),
('ayollar-koylak-yozgi', 'Ayollar yozgi ko‘ylagi', 'ayollar-kiyimi', 249000, null, 120000, 0, 'n', 'Lola', 'clothing', 'Turkiya', 11),
('ayollar-sumka-classic', 'Ayollar sumkasi Classic', 'ayollar-kiyimi', 359000, 450000, 190000, 18, 'f', 'Lola', null, 'Xitoy', 12),
('krossovka-run-air', 'Krossovka Run Air', 'poyabzal', 459000, 599000, 260000, 0, 'fbn', 'Stride', 'shoes', 'O''zbekiston', 13),
('tufli-oxford-classic', 'Erkaklar tuflisi Oxford', 'poyabzal', 529000, null, 300000, 0, '', 'Stride', 'shoes', 'Turkiya', 14),
('choynak-elektr-17', 'Elektr choynak 1.7 L', 'oshxona-texnikasi', 189000, 249000, 110000, 50, 'b', 'Hilol', null, 'Xitoy', 15),
('blender-power-1000', 'Blender Power 1000 W', 'oshxona-texnikasi', 429000, null, 280000, 14, 'n', 'Hilol', null, 'O''zbekiston', 16),
('kofemashina-barista', 'Kofemashina Barista Home', 'oshxona-texnikasi', 2390000, 2790000, 1800000, 4, 'f', 'Barista', null, 'Turkiya', 17),
('televizor-smart-55', 'Smart TV 55" 4K UHD', 'televizorlar', 5490000, 6290000, 4500000, 7, 'fb', 'Vista', null, 'Xitoy', 18),
('televizor-smart-43', 'Smart TV 43" Full HD', 'televizorlar', 3190000, null, 2600000, 11, '', 'Vista', null, 'O''zbekiston', 19),
('muzlatgich-nofrost-300', 'Muzlatgich No Frost 300 L', 'maishiy-texnika', 6890000, 7490000, 5700000, 5, 'f', 'Arctic', null, 'Turkiya', 20),
('divan-yostiq-set', 'Dekorativ yostiqlar to‘plami (4 dona)', 'uy-va-bog', 199000, 260000, 90000, 35, 'n', 'Uyim', null, 'Xitoy', 21),
('stol-chiroq-led', 'LED stol chirog‘i, sensorli', 'uy-va-bog', 149000, null, 70000, 45, 'b', 'Uyim', null, 'O''zbekiston', 22),
('parfyum-oud-50', 'Parfyum Oud Night 50 ml', 'gozallik', 390000, 520000, 210000, 22, 'fb', 'Atir', null, 'Turkiya', 23),
('krem-namlantiruvchi', 'Namlantiruvchi yuz kremi 50 ml', 'gozallik', 89000, null, 40000, 70, 'n', 'Nafis', null, 'Xitoy', 24),
('bolalar-konstruktor-500', 'Bolalar konstruktori 500 detal', 'bolalar', 279000, 350000, 150000, 20, 'fb', 'Kubik', null, 'O''zbekiston', 25),
('bolalar-ryukzak', 'Bolalar maktab ryukzagi', 'bolalar', 219000, null, 110000, 2, 'n', 'Kubik', null, 'Turkiya', 26),
('gantel-set-20', 'Gantellar to‘plami 2×10 kg', 'sport', 459000, 520000, 300000, 9, '', 'Kuch', null, 'Xitoy', 27),
('yoga-gilam-pro', 'Yoga gilami Pro 6 mm', 'sport', 129000, null, 60000, 40, 'n', 'Kuch', null, 'O''zbekiston', 28),
('kitob-otkan-kunlar', 'Abdulla Qodiriy — O‘tkan kunlar', 'kitoblar', 69000, null, 35000, 100, 'b', 'Sharq', null, 'Turkiya', 29),
('kitob-biznes-asoslari', 'Biznes asoslari: amaliy qo‘llanma', 'kitoblar', 99000, 129000, 50000, 30, '', 'Sharq', null, 'Xitoy', 30),
('kamera-action-4k', 'Action kamera 4K, suv o‘tkazmaydigan', 'elektronika', 899000, 1090000, 640000, 13, 'fn', 'Vista', null, 'O''zbekiston', 31)
) v where not exists (select 1 from _demo);

insert into public.products (name, slug, short_description, description, category_id, brand, sku, barcode, price, compare_at_price, cost_price, stock, has_variants, is_featured, is_bestseller, is_new, attributes, seo_title, seo_description)
select d.name, d.slug, d.brand || ' — sifatli va hamyonbop tanlov',
  d.name || ' — ' || d.brand || E' brendining sifatli mahsuloti. Rasmiy kafolat, tez yetkazib berish va qulay to''lov.

## Afzalliklari
- Yuqori sifatli materiallar
- Rasmiy kafolat
- O''zbekiston bo''ylab yetkazib berish

## Qo''shimcha ma''lumot
Mahsulot haqida savollaringiz bo''lsa, operatorlarimiz bilan bog''laning.',
  (select id from public.categories c where c.slug = d.cat), d.brand, 'DK-' || (1001 + d.n), (4780000000000 + d.n * 7)::text,
  d.price, d.compare, d.cost, d.stock, d.vkind is not null, d.flags like '%f%', d.flags like '%b%', d.flags like '%n%',
  jsonb_build_array(jsonb_build_object('name', 'Brend', 'value', d.brand),
    jsonb_build_object('name', 'Kafolat', 'value', case when d.vkind is not null then '14 kun qaytarish' else '12 oy' end),
    jsonb_build_object('name', 'Ishlab chiqaruvchi mamlakat', 'value', d.country)),
  d.name || ' — xarid qiling', d.name || 'ni qulay narxda xarid qiling. Tez yetkazib berish.'
from _demo d
on conflict (slug) do nothing;

insert into public.product_images (product_id, url, alt, sort_order, is_primary)
select p.id, '/demo/products/' || p.slug || '.svg', p.name, 0, true
from public.products p join _demo d on d.slug = p.slug
where not exists (select 1 from public.product_images pi where pi.product_id = p.id);

insert into public.product_variants (product_id, name, sku, color, color_hex, size, stock, sort_order)
select p.id, v.color || ' / ' || v.size, p.sku || '-' || v.n, v.color, v.hex, v.size, (v.n * 3) % 9, v.n
from (values
('clothing', 'Qora', '#111827', 'S', 1),
('clothing', 'Qora', '#111827', 'M', 2),
('clothing', 'Qora', '#111827', 'L', 3),
('clothing', 'Qora', '#111827', 'XL', 4),
('clothing', 'Oq', '#f9fafb', 'S', 5),
('clothing', 'Oq', '#f9fafb', 'M', 6),
('clothing', 'Oq', '#f9fafb', 'L', 7),
('clothing', 'Oq', '#f9fafb', 'XL', 8),
('clothing', 'Ko‘k', '#2563eb', 'S', 9),
('clothing', 'Ko‘k', '#2563eb', 'M', 10),
('clothing', 'Ko‘k', '#2563eb', 'L', 11),
('clothing', 'Ko‘k', '#2563eb', 'XL', 12),
('shoes', 'Qora', '#111827', '40', 1),
('shoes', 'Qora', '#111827', '41', 2),
('shoes', 'Qora', '#111827', '42', 3),
('shoes', 'Qora', '#111827', '43', 4),
('shoes', 'Qora', '#111827', '44', 5),
('shoes', 'Oq', '#f9fafb', '40', 6),
('shoes', 'Oq', '#f9fafb', '41', 7),
('shoes', 'Oq', '#f9fafb', '42', 8),
('shoes', 'Oq', '#f9fafb', '43', 9),
('shoes', 'Oq', '#f9fafb', '44', 10)
) as v (kind, color, hex, size, n)
join _demo d on d.vkind = v.kind
join public.products p on p.slug = d.slug
on conflict (sku) do nothing;

insert into public.banners (title, subtitle, image_url, button_text, link_url, placement, sort_order, text_color)
select 'Kuzgi mega chegirmalar', 'Elektronika va maishiy texnikaga 40% gacha chegirma', '/demo/banners/banner-1.svg', 'Xarid qilish', '/sale', 'home_hero', 0, '#ffffff'
where not exists (select 1 from public.banners where image_url = '/demo/banners/banner-1.svg');
insert into public.banners (title, subtitle, image_url, button_text, link_url, placement, sort_order, text_color)
select 'Yangi kolleksiya', 'Kiyim va poyabzallarning eng so‘nggi modellari', '/demo/banners/banner-2.svg', 'Ko''rish', '/category/kiyim', 'home_hero', 1, '#ffffff'
where not exists (select 1 from public.banners where image_url = '/demo/banners/banner-2.svg');
insert into public.banners (title, subtitle, image_url, button_text, link_url, placement, sort_order, text_color)
select 'Bepul yetkazib berish', '500 000 so''mdan ortiq buyurtmalarga — butun O''zbekiston bo''ylab', '/demo/banners/banner-3.svg', 'Batafsil', '/delivery', 'home_hero', 2, '#ffffff'
where not exists (select 1 from public.banners where image_url = '/demo/banners/banner-3.svg');
insert into public.banners (title, subtitle, image_url, button_text, link_url, placement, sort_order, text_color)
select 'Uy uchun hammasi', 'Oshxona texnikasi va uy jihozlari', '/demo/banners/banner-4.svg', 'Katalog', '/category/maishiy-texnika', 'home_middle', 3, '#ffffff'
where not exists (select 1 from public.banners where image_url = '/demo/banners/banner-4.svg');
insert into public.banners (title, subtitle, image_url, button_text, link_url, placement, sort_order, text_color)
select 'Promo-kod: XUSH10', 'Birinchi buyurtmangizga 10% chegirma', '/demo/banners/banner-5.svg', 'Foydalanish', '/catalog', 'home_promo', 4, '#ffffff'
where not exists (select 1 from public.banners where image_url = '/demo/banners/banner-5.svg');
insert into public.banners (title, subtitle, image_url, button_text, link_url, placement, sort_order, text_color)
select 'Aksiyalar haftaligi', 'Har kuni yangi chegirmalar', '/demo/banners/banner-6.svg', null, null, 'sale_page', 5, '#ffffff'
where not exists (select 1 from public.banners where image_url = '/demo/banners/banner-6.svg');
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

commit;
