// Demo ma'lumotlar: seed.sql va public/demo rasmlari shu fayldan generatsiya qilinadi.
// Ishga tushirish: npm run seed:generate

export const categories = [
  { slug: 'elektronika', name: 'Elektronika', icon: 'smartphone', colors: ['#0ea5e9', '#6366f1'], children: [
    { slug: 'smartfonlar', name: 'Smartfonlar', icon: 'smartphone' },
    { slug: 'noutbuklar', name: 'Noutbuklar', icon: 'laptop' },
    { slug: 'quloqchinlar', name: 'Quloqchinlar', icon: 'headphones' },
    { slug: 'aqlli-soatlar', name: 'Aqlli soatlar', icon: 'watch' },
  ] },
  { slug: 'kiyim', name: 'Kiyim-kechak', icon: 'shirt', colors: ['#f43f5e', '#f97316'], children: [
    { slug: 'erkaklar-kiyimi', name: 'Erkaklar kiyimi', icon: 'shirt' },
    { slug: 'ayollar-kiyimi', name: 'Ayollar kiyimi', icon: 'shopping-bag' },
  ] },
  { slug: 'poyabzal', name: 'Poyabzal', icon: 'footprints', colors: ['#a855f7', '#ec4899'], children: [] },
  { slug: 'maishiy-texnika', name: 'Maishiy texnika', icon: 'refrigerator', colors: ['#14b8a6', '#22c55e'], children: [
    { slug: 'oshxona-texnikasi', name: 'Oshxona texnikasi', icon: 'coffee' },
    { slug: 'televizorlar', name: 'Televizorlar', icon: 'tv' },
  ] },
  { slug: 'uy-va-bog', name: "Uy va bog'", icon: 'sofa', colors: ['#f59e0b', '#ef4444'], children: [] },
  { slug: 'gozallik', name: "Go'zallik", icon: 'sparkles', colors: ['#ec4899', '#8b5cf6'], children: [] },
  { slug: 'bolalar', name: 'Bolalar uchun', icon: 'baby', colors: ['#22c55e', '#06b6d4'], children: [] },
  { slug: 'sport', name: 'Sport va dam olish', icon: 'dumbbell', colors: ['#3b82f6', '#14b8a6'], children: [] },
  { slug: 'kitoblar', name: 'Kitoblar', icon: 'book-open', colors: ['#64748b', '#0ea5e9'], children: [] },
];

// [slug, nomi, kategoriya, narx, eski narx|null, tannarx, qoldiq, belgilar, ikonka, brend]
export const products = [
  ['smartfon-nova-x12', 'Smartfon Nova X12 8/256 GB', 'smartfonlar', 4290000, 4990000, 3500000, 25, 'fbn', 'smartphone', 'Nova'],
  ['smartfon-lumo-a5', 'Smartfon Lumo A5 4/128 GB', 'smartfonlar', 1890000, null, 1450000, 40, 'b', 'smartphone', 'Lumo'],
  ['smartfon-orbit-pro', 'Smartfon Orbit Pro 12/512 GB', 'smartfonlar', 9790000, 10990000, 8200000, 8, 'fn', 'smartphone', 'Orbit'],
  ['noutbuk-zenbook-14', 'Noutbuk Aero 14 Intel Core i5, 16 GB', 'noutbuklar', 8450000, 9200000, 7100000, 12, 'fb', 'laptop', 'Aero'],
  ['noutbuk-office-15', 'Noutbuk Office 15 Ryzen 5, 8 GB', 'noutbuklar', 5990000, null, 5000000, 3, 'n', 'laptop', 'Office'],
  ['quloqchin-pulse-buds', 'Simsiz quloqchin Pulse Buds ANC', 'quloqchinlar', 549000, 790000, 320000, 60, 'fb', 'headphones', 'Pulse'],
  ['quloqchin-studio-max', 'Quloqchin Studio Max (to‘liq o‘lchamli)', 'quloqchinlar', 1290000, null, 900000, 15, 'n', 'headphones', 'Studio'],
  ['aqlli-soat-fit-3', 'Aqlli soat Fit 3 AMOLED', 'aqlli-soatlar', 690000, 850000, 450000, 30, 'b', 'watch', 'Fit'],
  ['aqlli-soat-active-gps', 'Aqlli soat Active GPS', 'aqlli-soatlar', 1150000, null, 820000, 0, '', 'watch', 'Active'],
  ['erkaklar-futbolka-basic', 'Erkaklar paxta futbolkasi Basic', 'erkaklar-kiyimi', 119000, 159000, 60000, 0, 'bn', 'shirt', 'Bozor Style', 'clothing'],
  ['erkaklar-kurtka-winter', 'Erkaklar qishki kurtkasi', 'erkaklar-kiyimi', 890000, 1190000, 520000, 0, 'fn', 'shirt', 'North', 'clothing'],
  ['ayollar-koylak-yozgi', 'Ayollar yozgi ko‘ylagi', 'ayollar-kiyimi', 249000, null, 120000, 0, 'n', 'shopping-bag', 'Lola', 'clothing'],
  ['ayollar-sumka-classic', 'Ayollar sumkasi Classic', 'ayollar-kiyimi', 359000, 450000, 190000, 18, 'f', 'shopping-bag', 'Lola'],
  ['krossovka-run-air', 'Krossovka Run Air', 'poyabzal', 459000, 599000, 260000, 0, 'fbn', 'footprints', 'Stride', 'shoes'],
  ['tufli-oxford-classic', 'Erkaklar tuflisi Oxford', 'poyabzal', 529000, null, 300000, 0, '', 'footprints', 'Stride', 'shoes'],
  ['choynak-elektr-17', 'Elektr choynak 1.7 L', 'oshxona-texnikasi', 189000, 249000, 110000, 50, 'b', 'coffee', 'Hilol'],
  ['blender-power-1000', 'Blender Power 1000 W', 'oshxona-texnikasi', 429000, null, 280000, 14, 'n', 'coffee', 'Hilol'],
  ['kofemashina-barista', 'Kofemashina Barista Home', 'oshxona-texnikasi', 2390000, 2790000, 1800000, 4, 'f', 'coffee', 'Barista'],
  ['televizor-smart-55', 'Smart TV 55" 4K UHD', 'televizorlar', 5490000, 6290000, 4500000, 7, 'fb', 'tv', 'Vista'],
  ['televizor-smart-43', 'Smart TV 43" Full HD', 'televizorlar', 3190000, null, 2600000, 11, '', 'tv', 'Vista'],
  ['muzlatgich-nofrost-300', 'Muzlatgich No Frost 300 L', 'maishiy-texnika', 6890000, 7490000, 5700000, 5, 'f', 'refrigerator', 'Arctic'],
  ['divan-yostiq-set', 'Dekorativ yostiqlar to‘plami (4 dona)', 'uy-va-bog', 199000, 260000, 90000, 35, 'n', 'sofa', 'Uyim'],
  ['stol-chiroq-led', 'LED stol chirog‘i, sensorli', 'uy-va-bog', 149000, null, 70000, 45, 'b', 'lamp', 'Uyim'],
  ['parfyum-oud-50', 'Parfyum Oud Night 50 ml', 'gozallik', 390000, 520000, 210000, 22, 'fb', 'sparkles', 'Atir'],
  ['krem-namlantiruvchi', 'Namlantiruvchi yuz kremi 50 ml', 'gozallik', 89000, null, 40000, 70, 'n', 'sparkles', 'Nafis'],
  ['bolalar-konstruktor-500', 'Bolalar konstruktori 500 detal', 'bolalar', 279000, 350000, 150000, 20, 'fb', 'gamepad-2', 'Kubik'],
  ['bolalar-ryukzak', 'Bolalar maktab ryukzagi', 'bolalar', 219000, null, 110000, 2, 'n', 'backpack', 'Kubik'],
  ['gantel-set-20', 'Gantellar to‘plami 2×10 kg', 'sport', 459000, 520000, 300000, 9, '', 'dumbbell', 'Kuch'],
  ['yoga-gilam-pro', 'Yoga gilami Pro 6 mm', 'sport', 129000, null, 60000, 40, 'n', 'dumbbell', 'Kuch'],
  ['kitob-otkan-kunlar', 'Abdulla Qodiriy — O‘tkan kunlar', 'kitoblar', 69000, null, 35000, 100, 'b', 'book-open', 'Sharq'],
  ['kitob-biznes-asoslari', 'Biznes asoslari: amaliy qo‘llanma', 'kitoblar', 99000, 129000, 50000, 30, '', 'book-open', 'Sharq'],
  ['kamera-action-4k', 'Action kamera 4K, suv o‘tkazmaydigan', 'elektronika', 899000, 1090000, 640000, 13, 'fn', 'camera', 'Vista'],
];

export const clothingVariants = {
  clothing: { colors: [['Qora', '#111827'], ['Oq', '#f9fafb'], ['Ko‘k', '#2563eb']], sizes: ['S', 'M', 'L', 'XL'] },
  shoes: { colors: [['Qora', '#111827'], ['Oq', '#f9fafb']], sizes: ['40', '41', '42', '43', '44'] },
};

export const icons = [...new Set([...categories.flatMap((c) => [c.icon, ...c.children.map((s) => s.icon)]), ...products.map((p) => p[8]), 'gift', 'truck', 'percent'])];
