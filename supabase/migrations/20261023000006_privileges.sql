-- =====================================================================
-- Do'kon: huquqlarni toraytirish (revoke) va rollarni boshqarish funksiyasi
-- RLS bilan birga ikki qavatli himoya: mijozlar ichki jadvallarga yoza olmaydi,
-- buyurtma yaratish (place_order) va rate limit faqat service role orqali chaqiriladi.
-- =====================================================================

create or replace function public.admin_set_role(p_email text, p_role public.app_role, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.has_perm('staff.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (v_user, p_role, auth.uid())
    on conflict do nothing;
  else
    if p_role = 'super_admin'
       and (select count(*) from public.user_roles where role = 'super_admin') <= 1
       and exists (select 1 from public.user_roles where user_id = v_user and role = 'super_admin') then
      raise exception 'LAST_SUPER_ADMIN' using errcode = 'P0001';
    end if;
    delete from public.user_roles where user_id = v_user and role = p_role;
  end if;
end;
$$;

-- ---------- Jadval huquqlari ----------
revoke all on public.rate_limits from anon, authenticated;
revoke all on public.coupon_redemptions from anon, authenticated;
revoke select on public.coupons from anon;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.inventory_movements from authenticated;
revoke insert, update, delete on public.order_items from authenticated;
revoke insert, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_status_history from authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;
revoke update on public.orders from authenticated;
revoke insert, update, delete on public.user_roles from authenticated;
revoke insert, delete on public.notifications from authenticated;

-- Tannarx (cost_price) mijozlarga ko'rinmasin: ustun darajasidagi huquq.
-- Xodimlar tannarxni admin_product_costs() orqali o'qiydi; yozish huquqi (update) saqlanadi.
revoke select on public.products from anon, authenticated;
grant select (id, name, slug, short_description, description, category_id, brand, sku, barcode, price,
  compare_at_price, stock, low_stock_threshold, track_stock, has_variants, is_active, is_featured, is_bestseller,
  is_new, image_url, rating_avg, rating_count, sold_count, weight_grams, attributes, seo_title, seo_description,
  created_at, updated_at) on public.products to anon, authenticated;

-- ---------- Funksiya huquqlari ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.has_perm(text) to anon, authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.my_roles() to authenticated;
grant execute on function public.category_descendants(uuid) to anon, authenticated;
grant execute on function public.catalog_products(jsonb) to anon, authenticated;
grant execute on function public.catalog_facets(text) to anon, authenticated;
grant execute on function public.cancel_my_order(uuid) to authenticated;
grant execute on function public.admin_update_order(uuid, public.order_status, text, text, text, public.payment_status) to authenticated;
grant execute on function public.adjust_stock(uuid, uuid, integer, text) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.report_sales(date, date, text) to authenticated;
grant execute on function public.report_products(date, date) to authenticated;
grant execute on function public.report_status_breakdown(date, date) to authenticated;
grant execute on function public.admin_customers(text, integer, integer) to authenticated;
grant execute on function public.admin_staff() to authenticated;
grant execute on function public.admin_set_role(text, public.app_role, boolean) to authenticated;
grant execute on function public.order_transition_allowed(public.order_status, public.order_status) to anon, authenticated;
grant execute on function public.my_orders(text, integer, integer) to authenticated;
grant execute on function public.my_order(uuid) to authenticated;
grant execute on function public.order_by_token(uuid) to anon, authenticated;
grant execute on function public.track_order(bigint, text) to anon, authenticated;
grant execute on function public.admin_product_costs(uuid[]) to authenticated;
-- Faqat server (service role): buyurtma yaratish, rate limit, super admin yaratish
grant execute on all functions in schema public to service_role;
revoke execute on function public.bootstrap_super_admin(text) from service_role;
