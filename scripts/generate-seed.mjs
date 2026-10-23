// Demo rasmlar (public/demo) va supabase/seed.sql ni generatsiya qiladi.
// Ishga tushirish: npm run seed:generate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, products, clothingVariants, icons } from './demo-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = path.join(root, 'node_modules/lucide-react/dist/esm/icons');

async function iconSvg(name) {
  const { __iconData } = await import(path.join(iconDir, `${name}.mjs`));
  return __iconData.node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
}

const iconCache = Object.fromEntries(await Promise.all(icons.map(async (i) => [i, await iconSvg(i)])));
const write = (rel, content) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

function productSvg(icon, [c1, c2], seed) {
  const angle = (seed * 37) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${c1}" stop-opacity=".16"/><stop offset="1" stop-color="${c2}" stop-opacity=".30"/></linearGradient>
<linearGradient id="i" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="800" height="800" fill="#f8fafc"/><rect width="800" height="800" fill="url(#g)"/>
<circle cx="${560 + (seed % 5) * 20}" cy="${200 + (seed % 3) * 30}" r="180" fill="#fff" opacity=".45"/>
<circle cx="${180 + (seed % 4) * 15}" cy="640" r="120" fill="#fff" opacity=".35"/>
<g transform="translate(220 220) scale(15)" fill="none" stroke="url(#i)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${iconCache[icon]}</g>
</svg>`;
}

function bannerSvg([c1, c2], icon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600" width="1600" height="600" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="1600" height="600" fill="url(#g)"/>
<circle cx="1300" cy="120" r="260" fill="#fff" opacity=".10"/><circle cx="1450" cy="520" r="180" fill="#fff" opacity=".08"/>
<circle cx="980" cy="560" r="140" fill="#fff" opacity=".06"/>
<g transform="translate(1040 120) scale(15)" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${iconCache[icon]}</g>
</svg>`;
}

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`);
const sql = [];
sql.push(`-- AVTOMATIK GENERATSIYA QILINGAN: scripts/generate-seed.mjs
-- Demo ma'lumotlar. Takroriy ishga tushirish xavfsiz (on conflict do nothing).
-- Buyurtmalar seed qilinmaydi: dashboard faqat haqiqiy buyurtmalarni ko'rsatadi.
begin;
`);

// ---------- Kategoriyalar ----------
const catColors = {};
categories.forEach((c, i) => {
  catColors[c.slug] = c.colors;
  write(`public/demo/categories/${c.slug}.svg`, productSvg(c.icon, c.colors, i + 3));
  sql.push(`insert into public.categories (name, slug, icon, image_url, sort_order, show_on_home) values (${q(c.name)}, ${q(c.slug)}, ${q(c.icon)}, '/demo/categories/${c.slug}.svg', ${i}, true) on conflict (slug) do nothing;`);
  c.children.forEach((s, j) => {
    catColors[s.slug] = c.colors;
    write(`public/demo/categories/${s.slug}.svg`, productSvg(s.icon, c.colors, j + 7));
    sql.push(`insert into public.categories (parent_id, name, slug, icon, image_url, sort_order, show_on_home) values ((select id from public.categories where slug = ${q(c.slug)}), ${q(s.name)}, ${q(s.slug)}, ${q(s.icon)}, '/demo/categories/${s.slug}.svg', ${j}, false) on conflict (slug) do nothing;`);
  });
});

// ---------- Mahsulotlar (ixcham: bitta VALUES ro'yxati, matnlar SQL'da quriladi) ----------
const rows = products.map((p, i) => {
  const [slug, name, cat, price, compare, cost, stock, flags, icon, brand, variantKind] = p;
  write(`public/demo/products/${slug}.svg`, productSvg(icon, catColors[cat], i));
  const country = i % 3 === 0 ? 'Xitoy' : i % 3 === 1 ? "O'zbekiston" : 'Turkiya';
  return `(${q(slug)}, ${q(name)}, ${q(cat)}, ${price}, ${compare ?? 'null'}, ${cost}, ${variantKind ? 0 : stock}, ${q(flags)}, ${q(brand)}, ${q(variantKind ?? null)}, ${q(country)}, ${i})`;
});
sql.push(`create temporary table if not exists _demo (slug text, name text, cat text, price bigint, compare bigint, cost bigint, stock int, flags text, brand text, vkind text, country text, n int);
insert into _demo
select * from (values
${rows.join(',\n')}
) v where not exists (select 1 from _demo);

insert into public.products (name, slug, short_description, description, category_id, brand, sku, barcode, price, compare_at_price, cost_price, stock, has_variants, is_featured, is_bestseller, is_new, attributes, seo_title, seo_description)
select d.name, d.slug, d.brand || ' — sifatli va hamyonbop tanlov',
  d.name || ' — ' || d.brand || E' brendining sifatli mahsuloti. Rasmiy kafolat, tez yetkazib berish va qulay to''lov.\n\n## Afzalliklari\n- Yuqori sifatli materiallar\n- Rasmiy kafolat\n- O''zbekiston bo''ylab yetkazib berish\n\n## Qo''shimcha ma''lumot\nMahsulot haqida savollaringiz bo''lsa, operatorlarimiz bilan bog''laning.',
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
`);

const variantRows = [];
for (const [kind, v] of Object.entries(clothingVariants)) {
  v.colors.forEach(([color, hex], ci) => {
    v.sizes.forEach((size, si) => {
      const n = ci * v.sizes.length + si + 1;
      variantRows.push(`(${q(kind)}, ${q(color)}, ${q(hex)}, ${q(size)}, ${n})`);
    });
  });
}
sql.push(`insert into public.product_variants (product_id, name, sku, color, color_hex, size, stock, sort_order)
select p.id, v.color || ' / ' || v.size, p.sku || '-' || v.n, v.color, v.hex, v.size, (v.n * 3) % 9, v.n
from (values
${variantRows.join(',\n')}
) as v (kind, color, hex, size, n)
join _demo d on d.vkind = v.kind
join public.products p on p.slug = d.slug
on conflict (sku) do nothing;
`);

// ---------- Bannerlar ----------
const banners = [
  ['home_hero', 'Kuzgi mega chegirmalar', 'Elektronika va maishiy texnikaga 40% gacha chegirma', 'Xarid qilish', '/sale', ['#0f766e', '#0ea5e9'], 'smartphone'],
  ['home_hero', 'Yangi kolleksiya', 'Kiyim va poyabzallarning eng so‘nggi modellari', "Ko'rish", '/category/kiyim', ['#be123c', '#f97316'], 'shirt'],
  ['home_hero', 'Bepul yetkazib berish', "500 000 so'mdan ortiq buyurtmalarga — butun O'zbekiston bo'ylab", 'Batafsil', '/delivery', ['#4338ca', '#a855f7'], 'truck'],
  ['home_middle', "Uy uchun hammasi", 'Oshxona texnikasi va uy jihozlari', 'Katalog', '/category/maishiy-texnika', ['#b45309', '#ef4444'], 'coffee'],
  ['home_promo', 'Promo-kod: XUSH10', "Birinchi buyurtmangizga 10% chegirma", 'Foydalanish', '/catalog', ['#15803d', '#0d9488'], 'gift'],
  ['sale_page', 'Aksiyalar haftaligi', 'Har kuni yangi chegirmalar', null, null, ['#9f1239', '#7c3aed'], 'percent'],
];
banners.forEach(([placement, title, subtitle, btn, link, colors, icon], i) => {
  write(`public/demo/banners/banner-${i + 1}.svg`, bannerSvg(colors, icon));
  sql.push(`insert into public.banners (title, subtitle, image_url, button_text, link_url, placement, sort_order, text_color)
select ${q(title)}, ${q(subtitle)}, '/demo/banners/banner-${i + 1}.svg', ${q(btn)}, ${q(link)}, ${q(placement)}, ${i}, '#ffffff'
where not exists (select 1 from public.banners where image_url = '/demo/banners/banner-${i + 1}.svg');`);
});

fs.mkdirSync(path.join(root, 'supabase'), { recursive: true });
const staticSql = fs.readFileSync(path.join(root, 'scripts/seed-static.sql'), 'utf8');
sql.push(staticSql);
sql.push('commit;\n');
write('supabase/seed.sql', sql.join('\n'));
console.log(`seed.sql: ${categories.length} kategoriya, ${products.length} mahsulot, ${banners.length} banner`);
