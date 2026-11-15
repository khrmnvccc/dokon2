-- Ishga tayyorlash: tashqi kalitlar uchun indekslar va admin funksiyalarni mehmonlardan yopish (DROP yoʻq)

create index if not exists profiles_referred_by_idx on public.profiles (referred_by);
create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
create index if not exists inventory_movements_created_by_idx on public.inventory_movements (created_by);
create index if not exists inventory_movements_variant_id_idx on public.inventory_movements (variant_id);
create index if not exists cart_items_product_id_idx on public.cart_items (product_id);
create index if not exists cart_items_variant_id_idx on public.cart_items (variant_id);
create index if not exists wishlists_product_id_idx on public.wishlists (product_id);
create index if not exists coupons_issued_by_idx on public.coupons (issued_by);
create index if not exists orders_coupon_id_idx on public.orders (coupon_id);
create index if not exists orders_payment_method_id_idx on public.orders (payment_method_id);
create index if not exists orders_shipping_method_id_idx on public.orders (shipping_method_id);
create index if not exists order_items_variant_id_idx on public.order_items (variant_id);
create index if not exists order_status_history_changed_by_idx on public.order_status_history (changed_by);
create index if not exists coupon_redemptions_order_id_idx on public.coupon_redemptions (order_id);
create index if not exists coupon_redemptions_user_id_idx on public.coupon_redemptions (user_id);
create index if not exists site_settings_updated_by_idx on public.site_settings (updated_by);
create index if not exists reviews_user_id_idx on public.reviews (user_id);
create index if not exists staff_members_updated_by_idx on public.staff_members (updated_by);
create index if not exists broadcasts_created_by_idx on public.broadcasts (created_by);
create index if not exists referrals_first_order_id_idx on public.referrals (first_order_id);
create index if not exists referrals_qualified_order_id_idx on public.referrals (qualified_order_id);
create index if not exists referral_rewards_coupon_id_idx on public.referral_rewards (coupon_id);
create index if not exists partners_decided_by_idx on public.partners (decided_by);
create index if not exists partner_earnings_friend_id_idx on public.partner_earnings (friend_id);
create index if not exists partner_payouts_decided_by_idx on public.partner_payouts (decided_by);
create index if not exists payment_receipts_decided_by_idx on public.payment_receipts (decided_by);
create index if not exists payment_receipts_uploaded_by_idx on public.payment_receipts (uploaded_by);
create index if not exists support_messages_sent_by_idx on public.support_messages (sent_by);
create index if not exists support_messages_user_id_idx on public.support_messages (user_id);

-- Admin RPC lar ichida ruxsat tekshiriladi, lekin mehmon (anon) umuman chaqira olmasin
revoke execute on function public.admin_dashboard_live(integer) from public, anon;
revoke execute on function public.admin_set_staff_access(uuid, text[], integer[]) from public, anon;
revoke execute on function public.admin_staff() from public, anon;
grant execute on function public.admin_dashboard_live(integer) to authenticated, service_role;
grant execute on function public.admin_set_staff_access(uuid, text[], integer[]) to authenticated, service_role;
grant execute on function public.admin_staff() to authenticated, service_role;
