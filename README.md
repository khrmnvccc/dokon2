# Do'kon — onlayn do'kon va admin panel

O'zbekiston bozori uchun to'liq onlayn do'kon: mijozlar sayti va kuchli admin panel.
Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Supabase, Zod, React Hook Form, Lucide.

## Imkoniyatlar

**Mijoz sayti:** bosh sahifa (bloklar admin paneldan boshqariladi), katalog va filtrlar, kategoriya, mahsulot (variantlar, sharhlar),
qidiruv, savatcha, checkout, buyurtma holatini kuzatish, kirish/ro'yxatdan o'tish/parolni tiklash, profil, buyurtmalar tarixi,
manzillar, sevimlilar, chegirmalar, "Biz haqimizda", yetkazib berish, aloqa, FAQ, maxfiylik siyosati va shartlar, 404.

**Admin panel (`/admin`):** dashboard (haqiqiy ko'rsatkichlar), mahsulotlar (CRUD, rasmlar, tannarx, SKU/shtrix-kod, variantlar, SEO,
ommaviy tahrirlash, CSV/Excel import va eksport), kategoriyalar, buyurtmalar (holatlar, trek raqami, izohlar, chop etish, filtrlar, eksport),
mijozlar (bloklash), sharhlar moderatsiyasi, ombor harakatlari, bannerlar, aksiyalar, kuponlar, sahifalar (CMS), yetkazib berish va to'lov usullari,
hisobotlar (foyda bilan, eksport), xodimlar va rollar, audit jurnali, sayt sozlamalari (saytda darhol qo'llanadi).

**Xavfsizlik:**
- Barcha jadvallarda RLS. Ruxsatlar `role_permissions` jadvalida, ham bazada (`has_perm()`), ham serverda tekshiriladi.
- Ro'yxatdan o'tgan har qanday foydalanuvchi oddiy mijoz bo'ladi. Admin huquqini faqat super admin beradi.
- Tannarx (`cost_price`) va ichki izohlar mijozlarga hech qachon ko'rinmaydi (ustun darajasidagi huquqlar + xavfsiz funksiyalar).
- Checkout: narx, chegirma, kupon va qoldiq serverda qayta hisoblanadi; buyurtma qatorlari surat (snapshot) sifatida saqlanadi;
  ikki marta yuborish idempotency kaliti bilan to'xtatiladi; telefon raqami +998 formatida tekshiriladi.
- Kirish, ro'yxatdan o'tish, checkout, kupon va kuzatish uchun rate limit.
- Service role kaliti faqat serverda ishlatiladi (`server-only`), brauzerga chiqmaydi.

## O'rnatish

### 1. Talablar
Node.js 20+ va Supabase loyihasi.

### 2. Muhit o'zgaruvchilari
```bash
cp .env.example .env.local
```
`.env.local` ga Supabase → **Project Settings → API** dagi qiymatlarni yozing:

| O'zgaruvchi | Qayerda ishlatiladi | Maxfiymi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | brauzer + server | yo'q |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | brauzer + server | yo'q (RLS himoyalaydi) |
| `SUPABASE_SERVICE_ROLE_KEY` | faqat server: checkout, rate limit | **HA** |
| `NEXT_PUBLIC_SITE_URL` | sitemap, OpenGraph, email havolalari | yo'q |

> `SUPABASE_SERVICE_ROLE_KEY` ni hech kimga yubormang, chatga yozmang va gitga qo'shmang (`.env*` fayllari `.gitignore` da).
> Bu kalit bo'lmasa sayt ishlaydi, lekin checkout "vaqtincha ishlamayapti" xabarini qaytaradi.

### 3. Bazani tayyorlash
`supabase/migrations/` dagi fayllarni tartib bilan Supabase **SQL Editor** da ishga tushiring (yoki `supabase db push`):

1. `20261023000001_schema.sql` — jadvallar
2. `20261023000002_functions.sql` — funksiyalar, triggerlar, `place_order`
3. `20261023000003_rls.sql` — RLS siyosatlari
4. `20261023000004_storage.sql` — `media` bucket
5. `20261023000005_customer_views.sql` — mijozlar uchun xavfsiz funksiyalar
6. `20261023000006_privileges.sql` — huquqlarni cheklash (tannarxni yashirish va h.k.)

Demo ma'lumotlar (ixtiyoriy): `supabase/seed.sql`. Uni qayta generatsiya qilish: `npm run seed:generate`.

> Migratsiyalar faqat `create ... if not exists` / `create or replace` ishlatadi. Mavjud jadvallarni o'chirmaydi.

### 4. Birinchi super adminni yaratish (xavfsiz usul)
1. Saytda oddiy foydalanuvchi sifatida ro'yxatdan o'ting (`/register`) va emailni tasdiqlang.
2. Supabase Dashboard → **SQL Editor** da ishga tushiring:
   ```sql
   select public.bootstrap_super_admin('sizning@email.uz');
   ```
3. Qayta kiring va `/admin` ga o'ting.

Bu funksiyani faqat baza egasi (SQL Editor) chaqira oladi: sayt orqali, anon yoki service role kaliti bilan chaqirib bo'lmaydi.
Keyingi xodimlarni admin panel → **Xodimlar** bo'limidan qo'shasiz (ular avval ro'yxatdan o'tgan bo'lishi kerak).

Rollar: `super_admin` (hamma narsa), `manager` (menejer), `operator` (buyurtmalar bilan ishlash), `warehouse` (ombor xodimi).
Har bir rolning aniq ruxsatlarini admin panel → **Xodimlar** sahifasidagi jadvalda ko'rasiz.

### 5. Ishga tushirish
```bash
npm install
npm run dev        # http://localhost:3000
```

## Vercel'ga joylash
1. Loyihani GitHub'ga yuklang va Vercel'da **Import Project** qiling.
2. **Settings → Environment Variables** ga yuqoridagi 4 ta o'zgaruvchini qo'shing.
   `SUPABASE_SERVICE_ROLE_KEY` ni o'zingiz qo'shing va uni faqat Production/Preview uchun belgilang.
3. `NEXT_PUBLIC_SITE_URL` ni haqiqiy domenga o'zgartiring (masalan `https://dokon.uz`).
4. Supabase → **Authentication → URL Configuration**: Site URL ni domeningizga qo'ying va Redirect URLs ga
   `https://domeningiz/auth/callback` ni qo'shing.

## To'lovlar
Hozir ishlaydigan usullar: **naqd pul** va **qabul qilganda to'lash** (karta/terminal).
Click, Payme va Uzum admin panelda "Ulanmagan" deb ko'rsatiladi va checkout'da chiqmaydi: tizim ulanmagan
to'lovni ulangan deb ko'rsatmaydi va soxta "to'lov muvaffaqiyatli" javobini qaytarmaydi.

Online to'lovni ulash uchun:
1. Click/Payme bilan merchant shartnoma tuzing va kalitlarni oling (`.env.example` dagi izohli o'zgaruvchilar).
2. `src/lib/payments/index.ts` dagi interfeys bo'yicha provayder modulini yozing (to'lov havolasi + imzoni tekshiradigan webhook).
3. Webhook to'lovni tasdiqlagandan keyingina buyurtmaning `payment_status` qiymatini `paid` ga o'zgartiring.

## Testlar
```bash
npm run typecheck
npm run lint
npm test            # unit testlar: narx hisoblash, kuponlar, validatsiya (vitest)
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/dk_test npm run test:db
```
`test:db` bo'sh test bazasida migratsiyalar, seed va RLS/huquq testlarini (`supabase/tests/db_test.sql`) ishga tushiradi.
**Diqqat:** u ko'rsatilgan bazani tozalaydi, shuning uchun production bazani bermang.

## Loyiha tuzilishi
```
src/app/(shop)/        mijoz sahifalari
src/app/admin/         admin panel
src/app/api/           savatcha, checkout, kuzatish API
src/lib/               narx hisoblash, ma'lumotlar, server actionlar, sxemalar
src/components/        UI komponentlar (shop, admin, ui)
supabase/migrations/   SQL migratsiyalar
supabase/tests/        baza testlari
tests/unit/            unit testlar
```
