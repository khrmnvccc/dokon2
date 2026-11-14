-- =====================================================================
-- Ruscha kontent: har bir jadvalga i18n ustuni ({"ru": {"name": "...", ...}}).
-- Ega Sozlamalar → Tarjimalar boʻlimida kiritadi; sayt rus tilida shu matnlarni koʻrsatadi,
-- ruschasi yoʻq joyda oʻzbekchasi qoladi. Katalog qidiruvi ruscha nom boʻyicha ham topadi.
-- Idempotent: faqat ustun qoʻshadi va funksiyani yangilaydi, mavjud maʼlumot oʻchirilmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261115000004"')
on conflict (key) do update set value = excluded.value, updated_at = now();

do $$
declare t text;
begin
  foreach t in array array['products', 'categories', 'banners', 'pages', 'promotions', 'shipping_methods', 'payment_methods'] loop
    execute format('alter table public.%I add column if not exists i18n jsonb not null default %L::jsonb', t, '{}');
    begin
      execute format('alter table public.%I add constraint %I check (jsonb_typeof(i18n) = %L and pg_column_size(i18n) < 200000)', t, t || '_i18n_obj', 'object');
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- products ustunlari ustun darajasida ochilgan (tannarx yashirin) — yangi ustun ham koʻrinsin.
grant select (i18n) on public.products to anon, authenticated;

create or replace function public.catalog_products(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_q text := nullif(trim(p ->> 'q'), '');
  v_like text;
  v_category uuid;
  v_limit integer := least(greatest(coalesce((p ->> 'limit')::integer, 24), 1), 100);
  v_offset integer := greatest(coalesce((p ->> 'offset')::integer, 0), 0);
  v_sort text := coalesce(p ->> 'sort', 'popular');
  v_colors text[];
  v_sizes text[];
  v_ids uuid[];
  v_result jsonb;
begin
  if v_q is not null then
    v_like := '%' || replace(replace(replace(left(v_q, 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  if nullif(p ->> 'category', '') is not null then
    select id into v_category from public.categories where slug = p ->> 'category';
    if v_category is null then
      return jsonb_build_object('items', '[]'::jsonb, 'total', 0);
    end if;
  end if;
  if jsonb_typeof(p -> 'colors') = 'array' then
    select array_agg(lower(x)) into v_colors from jsonb_array_elements_text(p -> 'colors') x;
  end if;
  if jsonb_typeof(p -> 'sizes') = 'array' then
    select array_agg(lower(x)) into v_sizes from jsonb_array_elements_text(p -> 'sizes') x;
  end if;
  if jsonb_typeof(p -> 'ids') = 'array' then
    select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(p -> 'ids') x;
  end if;

  with filtered as (
    select pr.id, pr.name, pr.slug, pr.price, pr.compare_at_price, pr.image_url, pr.rating_avg, pr.rating_count,
      pr.stock, pr.track_stock, pr.has_variants, pr.category_id, pr.is_new, pr.is_bestseller, pr.sold_count,
      pr.brand, pr.created_at
    from public.products pr
    where pr.is_active
      and (v_category is null or pr.category_id in (select public.category_descendants(v_category)))
      and (v_like is null
        or pr.name ilike v_like
        or (pr.i18n -> 'ru' ->> 'name') ilike v_like
        or pr.sku ilike v_like
        or pr.brand ilike v_like
        or pr.barcode = v_q
        or pr.category_id in (select c.id from public.categories c where c.name ilike v_like or (c.i18n -> 'ru' ->> 'name') ilike v_like))
      and (p ->> 'min_price' is null or pr.price >= (p ->> 'min_price')::bigint)
      and (p ->> 'max_price' is null or pr.price <= (p ->> 'max_price')::bigint)
      and (coalesce((p ->> 'discount')::boolean, false) = false or (pr.compare_at_price is not null and pr.compare_at_price > pr.price))
      and (coalesce((p ->> 'in_stock')::boolean, false) = false or pr.stock > 0 or not pr.track_stock)
      and (p ->> 'min_rating' is null or pr.rating_avg >= (p ->> 'min_rating')::numeric)
      and (coalesce((p ->> 'featured')::boolean, false) = false or pr.is_featured)
      and (coalesce((p ->> 'bestseller')::boolean, false) = false or pr.is_bestseller)
      and (coalesce((p ->> 'new')::boolean, false) = false or pr.is_new)
      and (v_ids is null or pr.id = any (v_ids))
      and (v_colors is null or exists (
        select 1 from public.product_variants v where v.product_id = pr.id and v.is_active and lower(v.color) = any (v_colors)))
      and (v_sizes is null or exists (
        select 1 from public.product_variants v where v.product_id = pr.id and v.is_active and lower(v.size) = any (v_sizes)))
  ),
  page as (
    select f.* from filtered f
    order by
      case when v_sort = 'price_asc' then f.price end asc nulls last,
      case when v_sort = 'price_desc' then f.price end desc nulls last,
      case when v_sort = 'new' then f.created_at end desc nulls last,
      case when v_sort = 'rating' then f.rating_avg end desc nulls last,
      case when v_sort = 'discount' then coalesce(f.compare_at_price, f.price) - f.price end desc nulls last,
      case when v_sort = 'popular' then f.sold_count end desc nulls last,
      (f.stock > 0 or not f.track_stock) desc,
      f.created_at desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', pg.id, 'name', pg.name, 'slug', pg.slug, 'price', pg.price, 'compare_at_price', pg.compare_at_price,
      'image_url', pg.image_url, 'rating_avg', pg.rating_avg, 'rating_count', pg.rating_count,
      'stock', pg.stock, 'track_stock', pg.track_stock, 'has_variants', pg.has_variants,
      'category_id', pg.category_id, 'is_new', pg.is_new, 'is_bestseller', pg.is_bestseller,
      'sold_count', pg.sold_count, 'brand', pg.brand
    )) from page pg), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

