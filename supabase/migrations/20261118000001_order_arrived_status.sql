-- Kargo yoʻli: “Yoʻlda” dan keyin “Oʻzbekistonda” (arrived) holati.
-- Enum qiymati alohida migratsiyada qoʻshiladi (keyingi funksiyalar uni ishlata olishi uchun).
alter type public.order_status add value if not exists 'arrived' after 'shipped';
