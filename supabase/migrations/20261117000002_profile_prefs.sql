-- Profil: mijoz oʻzi yoqib/oʻchiradigan xabarlar.
--  notify_orders — buyurtma holati Telegramga kelsinmi (saytdagi qoʻngʻiroqcha baribir koʻrsatadi)
--  notify_promo  — aksiya va kupon tarqatmalari (broadcast) kelsinmi
alter table public.profiles add column if not exists notify_orders boolean not null default true;
alter table public.profiles add column if not exists notify_promo boolean not null default true;
