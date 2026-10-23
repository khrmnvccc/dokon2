-- =====================================================================
-- Do'kon: Row Level Security siyosatlari va huquqlar (grants)
-- (select public.has_perm(...)) ko'rinishi Postgres'ga natijani bir marta hisoblashga imkon beradi.
-- =====================================================================

-- ---------- Jadval huquqlari ----------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

-- ---------- RLS yoqish ----------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_roles', 'role_permissions', 'categories', 'products', 'product_images',
    'product_variants', 'inventory_movements', 'carts', 'cart_items', 'addresses', 'wishlists', 'shipping_methods',
    'payment_methods', 'coupons', 'promotions', 'orders', 'order_items', 'order_status_history', 'coupon_redemptions',
    'banners', 'pages', 'site_settings', 'reviews', 'notifications', 'audit_logs', 'rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- profiles ----------
create policy dk_profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.has_perm('customers.read')));
create policy dk_profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy dk_profiles_update_staff on public.profiles for update to authenticated
  using ((select public.has_perm('customers.block'))) with check ((select public.has_perm('customers.block')));

-- ---------- user_roles / role_permissions ----------
create policy dk_user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('staff.manage')));
-- Yozish faqat admin_set_role() orqali (security definer): yozish siyosati yo'q.

create policy dk_role_permissions_select on public.role_permissions for select to authenticated
  using (true);

-- ---------- Katalog: ommaviy o'qish, xodimlar yozishi ----------
create policy dk_categories_select on public.categories for select to anon, authenticated
  using (is_active or (select public.has_perm('products.read')));
create policy dk_categories_write on public.categories for all to authenticated
  using ((select public.has_perm('categories.write'))) with check ((select public.has_perm('categories.write')));

create policy dk_products_select on public.products for select to anon, authenticated
  using (is_active or (select public.has_perm('products.read')));
create policy dk_products_insert on public.products for insert to authenticated
  with check ((select public.has_perm('products.write')));
create policy dk_products_update on public.products for update to authenticated
  using ((select public.has_perm('products.write'))) with check ((select public.has_perm('products.write')));
create policy dk_products_delete on public.products for delete to authenticated
  using ((select public.has_perm('products.delete')));

create policy dk_product_images_select on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy dk_product_images_write on public.product_images for all to authenticated
  using ((select public.has_perm('products.write'))) with check ((select public.has_perm('products.write')));

create policy dk_product_variants_select on public.product_variants for select to anon, authenticated
  using ((is_active and exists (select 1 from public.products p where p.id = product_id)) or (select public.has_perm('products.read')));
create policy dk_product_variants_write on public.product_variants for all to authenticated
  using ((select public.has_perm('products.write'))) with check ((select public.has_perm('products.write')));

create policy dk_inventory_select on public.inventory_movements for select to authenticated
  using ((select public.has_perm('products.read')));

-- ---------- Savatcha, manzil, sevimlilar: faqat egasi ----------
create policy dk_carts_own on public.carts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dk_cart_items_own on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

create policy dk_addresses_own on public.addresses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy dk_wishlists_own on public.wishlists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- Yetkazib berish va to'lov ----------
create policy dk_shipping_select on public.shipping_methods for select to anon, authenticated
  using (is_active or (select public.has_perm('payments.write')));
create policy dk_shipping_write on public.shipping_methods for all to authenticated
  using ((select public.has_perm('payments.write'))) with check ((select public.has_perm('payments.write')));

create policy dk_payment_select on public.payment_methods for select to anon, authenticated
  using (is_active or (select public.has_perm('payments.write')));
create policy dk_payment_write on public.payment_methods for all to authenticated
  using ((select public.has_perm('payments.write'))) with check ((select public.has_perm('payments.write')));

-- ---------- Kupon va aksiyalar ----------
-- Kuponlar ro'yxati mijozlarga ko'rinmaydi (kodlarni terib topishning oldini olish). Tekshiruv serverda.
create policy dk_coupons_staff on public.coupons for all to authenticated
  using ((select public.has_perm('coupons.write'))) with check ((select public.has_perm('coupons.write')));

create policy dk_promotions_select on public.promotions for select to anon, authenticated
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or (select public.has_perm('promotions.write')));
create policy dk_promotions_write on public.promotions for all to authenticated
  using ((select public.has_perm('promotions.write'))) with check ((select public.has_perm('promotions.write')));

-- ---------- Buyurtmalar: mijoz faqat o'zinikini ko'radi ----------
create policy dk_orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('orders.read')));

create policy dk_order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and (o.user_id = (select auth.uid()) or (select public.has_perm('orders.read')))));

create policy dk_order_history_select on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and (o.user_id = (select auth.uid()) or (select public.has_perm('orders.read')))));

-- ---------- Kontent ----------
create policy dk_banners_select on public.banners for select to anon, authenticated
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or (select public.has_perm('banners.write')));
create policy dk_banners_write on public.banners for all to authenticated
  using ((select public.has_perm('banners.write'))) with check ((select public.has_perm('banners.write')));

create policy dk_pages_select on public.pages for select to anon, authenticated
  using (is_published or (select public.has_perm('pages.write')));
create policy dk_pages_write on public.pages for all to authenticated
  using ((select public.has_perm('pages.write'))) with check ((select public.has_perm('pages.write')));

-- Sozlamalarda maxfiy qiymat saqlanmaydi (API kalitlari faqat env'da)
create policy dk_settings_select on public.site_settings for select to anon, authenticated using (true);
create policy dk_settings_write on public.site_settings for all to authenticated
  using ((select public.has_perm('settings.write'))) with check ((select public.has_perm('settings.write')));

-- ---------- Sharhlar ----------
create policy dk_reviews_select on public.reviews for select to anon, authenticated
  using (is_approved or user_id = (select auth.uid()) or (select public.has_perm('reviews.moderate')));
create policy dk_reviews_insert on public.reviews for insert to authenticated
  with check (user_id = (select auth.uid()) and is_approved = true);
create policy dk_reviews_moderate on public.reviews for all to authenticated
  using ((select public.has_perm('reviews.moderate'))) with check ((select public.has_perm('reviews.moderate')));
create policy dk_reviews_delete_own on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- Bildirishnomalar ----------
create policy dk_notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select public.has_perm('orders.read'))));
create policy dk_notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select public.has_perm('orders.read'))))
  with check (user_id = (select auth.uid()) or (user_id is null and (select public.has_perm('orders.read'))));

-- ---------- Audit ----------
create policy dk_audit_select on public.audit_logs for select to authenticated
  using ((select public.has_perm('audit.view')));

-- rate_limits va coupon_redemptions uchun siyosat yo'q: RLS yoqilgan, demak faqat service role.

