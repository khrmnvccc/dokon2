// Doʻkon boti xaridorga yuboradigan xabarlar: rasm + matn + tugma (Laylak botidagidek).
// Ega har birini Telegram → Xabarlar va Push → “Mijozga” boʻlimida oʻzgartiradi: matn, tugma nomi va rasm
// (standart rasm, oʻz rasmi yoki rasmsiz). Server ham, admin oldindan koʻrishi ham shu fayldan oʻqiydi.

import type { TemplateVar } from './templates';

export type CustomerMsgKey =
  | 'orderNew' | 'awaitPayment' | 'paid' | 'receiptRejected' | 'confirmed' | 'processing' | 'shipped' | 'arrived' | 'deliveryApproved' | 'pickupReady' | 'delivered' | 'cancelled' | 'returned' | 'coupon' | 'referralInvite'
  | 'awaitOnline' | 'cartReminder' | 'cartCoupon' | 'backInStock' | 'cargoUpdate';

/** Standart rasm (kartochka) uchun yozuvlar va ranglar. */
export interface CardArt { title: string; subtitle: string; from: string; to: string; icon: CardIcon }
export type CardIcon = 'cart' | 'check' | 'box' | 'truck' | 'gift' | 'x' | 'undo' | 'ticket' | 'card' | 'pin' | 'users';

export interface CustomerMsgDef {
  key: CustomerMsgKey; title: string; hint: string; vars: TemplateVar[]; text: string; button: string; art: CardArt;
}

const RAQAM: TemplateVar = { name: 'raqam', label: 'Buyurtma №', sample: '100245' };
const MIJOZ: TemplateVar = { name: 'mijoz', label: 'Mijoz ismi', sample: 'Aziz' };
const SUMMA: TemplateVar = { name: 'summa', label: 'Summa', sample: '1 250 000 soʻm' };
const DOKON: TemplateVar = { name: 'dokon', label: 'Doʻkon nomi', sample: 'Bozorcha' };
const SONI: TemplateVar = { name: 'soni', label: 'Mahsulotlar soni', sample: '3 dona' };

export const CUSTOMER_MESSAGES: CustomerMsgDef[] = [
  {
    key: 'orderNew', title: 'Buyurtma qabul qilindi', hint: 'Xaridor buyurtma berishi bilan',
    vars: [RAQAM, MIJOZ, SUMMA, SONI, DOKON],
    text: '🙌 *Buyurtmangiz qabul qilindi!*\n\n🧾 Buyurtma: №{{raqam}}\n📦 Mahsulotlar: {{soni}}\n💰 Summa: *{{summa}}*\n\nTez orada operator bogʻlanadi. Holati shu yerga keladi.',
    button: 'Koʻrish',
    art: { title: 'BUYURTMA\nQABUL QILINDI', subtitle: 'Rahmat! Tez orada bogʻlanamiz', from: '#2a7de1', to: '#163f7a', icon: 'cart' },
  },
  {
    key: 'awaitPayment', title: 'Toʻlov kutilmoqda (karta)', hint: 'Kartaga toʻlov bilan buyurtma berilganda — “Buyurtma qabul qilindi” oʻrniga',
    vars: [RAQAM, MIJOZ, SUMMA, SONI, { name: 'karta', label: 'Karta raqami', sample: '8600 1234 5678 9012' }, { name: 'egasi', label: 'Karta egasi', sample: 'ALIYEV ALI' }, DOKON],
    text: '💳 *Buyurtma №{{raqam}} — toʻlovni kutyapmiz*\n\n💰 Summa: *{{summa}}*\n💳 Karta: `{{karta}}`\n👤 {{egasi}}\n\nKartaga oʻtkazing va chek rasmini yuklang. Toʻlov tasdiqlangach, buyurtmangiz qabul qilinadi.',
    button: 'Toʻlash',
    art: { title: 'TOʻLOVNI\nKUTYAPMIZ', subtitle: 'Kartaga oʻtkazib, chekni yuklang', from: '#f59e0b', to: '#b45309', icon: 'card' },
  },
  {
    key: 'paid', title: 'Toʻlov tasdiqlandi', hint: 'Siz chekni tasdiqlaganingizda (buyurtma ham tasdiqlanadi)',
    vars: [RAQAM, MIJOZ, SUMMA, DOKON],
    text: '✅ *Toʻlovingiz tasdiqlandi!*\n\n🧾 Buyurtma: №{{raqam}}\n💰 Summa: {{summa}}\n\nBuyurtmangiz qabul qilindi, tez orada joʻnatamiz.',
    button: 'Koʻrish',
    art: { title: 'TOʻLOV\nTASDIQLANDI', subtitle: 'Buyurtmangiz qabul qilindi', from: '#1fa45a', to: '#0f6a3a', icon: 'check' },
  },
  {
    key: 'receiptRejected', title: 'Chek qabul qilinmadi', hint: 'Siz chekni rad etganingizda (sabab bilan)',
    vars: [RAQAM, MIJOZ, SUMMA, { name: 'sabab', label: 'Sabab', sample: 'Summa toʻliq emas' }, DOKON],
    text: '⚠️ *Chek qabul qilinmadi*\n\n🧾 Buyurtma: №{{raqam}}\n❗️ Sabab: {{sabab}}\n\nToʻgʻri chekni qayta yuklang.',
    button: 'Chekni yuklash',
    art: { title: 'CHEK\nQABUL QILINMADI', subtitle: 'Toʻgʻri chekni qayta yuklang', from: '#e0192d', to: '#a30c1b', icon: 'x' },
  },
  {
    key: 'confirmed', title: 'Tasdiqlandi', hint: 'Operator buyurtmani tasdiqlaganda',
    vars: [RAQAM, MIJOZ, SUMMA, DOKON],
    text: '✅ *Buyurtmangiz tasdiqlandi!*\n\n🧾 Buyurtma: №{{raqam}}\n💰 Summa: {{summa}}\n\nTez orada tayyorlaymiz.',
    button: 'Koʻrish',
    art: { title: 'BUYURTMA\nTASDIQLANDI', subtitle: 'Tayyorlashni boshlaymiz', from: '#1fa45a', to: '#0f6a3a', icon: 'check' },
  },
  {
    key: 'processing', title: 'Yigʻilmoqda', hint: 'Buyurtma yigʻila boshlaganda',
    vars: [RAQAM, MIJOZ, SONI, DOKON],
    text: '📦 *Buyurtmangiz yigʻilmoqda*\n\n🧾 Buyurtma: №{{raqam}}\n📦 Mahsulotlar: {{soni}}',
    button: 'Koʻrish',
    art: { title: 'BUYURTMA\nYIGʻILMOQDA', subtitle: 'Ehtiyotkorlik bilan qadoqlayapmiz', from: '#f59e0b', to: '#b45309', icon: 'box' },
  },
  {
    key: 'shipped', title: 'Yoʻlga chiqdi', hint: 'Buyurtma “Yoʻlda” boʻlganda',
    vars: [RAQAM, MIJOZ, { name: 'trek', label: 'Trek raqami', sample: 'UZ123456789' }, DOKON],
    text: '🚚 *Buyurtmangiz yoʻlga chiqdi!*\n\n🧾 Buyurtma: №{{raqam}}\n🔎 Trek raqami: {{trek}}\n\nKuryer yetib kelganda qoʻngʻiroq qiladi.',
    button: 'Kuzatish',
    art: { title: 'BUYURTMA\nYOʻLDA', subtitle: 'Tez orada yetib boradi', from: '#4f46e5', to: '#312e81', icon: 'truck' },
  },
  {
    key: 'arrived', title: 'Oʻzbekistonga yetib keldi', hint: 'Buyurtma “Oʻzbekistonda” boʻlganda — mijoz yetkazishga ariza qoldiradi yoki oʻzi olib ketadi',
    vars: [RAQAM, MIJOZ, SONI, DOKON],
    text: '🇺🇿 *Buyurtmangiz Oʻzbekistonga yetib keldi!*\n\n🧾 Buyurtma: №{{raqam}}\n📦 Mahsulotlar: {{soni}}\n\n🚚 Yetkazib berishga ariza qoldirishingiz yoki 🏬 oʻzingiz olib ketishingiz mumkin.',
    button: 'Ariza qoldirish',
    art: { title: 'OʻZBEKISTONGA\nYETIB KELDI', subtitle: 'Yetkazishga ariza qoldiring', from: '#0ea5e9', to: '#075985', icon: 'pin' },
  },
  {
    key: 'deliveryApproved', title: 'Yetkazish arizasi tasdiqlandi', hint: 'Siz mijozning yetkazish arizasini tasdiqlaganingizda',
    vars: [RAQAM, MIJOZ, { name: 'usul', label: 'Yetkazish usuli', sample: 'Toshkent boʻylab' }, { name: 'manzil', label: 'Manzil', sample: 'Toshkent, Chilonzor 10-38' }, { name: 'narx', label: 'Yetkazish narxi', sample: '25 000 soʻm' }, DOKON],
    text: '✅ *Arizangiz tasdiqlandi!*\n\n🧾 Buyurtma: №{{raqam}}\n🚚 {{usul}}\n📍 {{manzil}}\n💵 Yetkazish: {{narx}}\n\nKuryer yetib kelganda qoʻngʻiroq qiladi.',
    button: 'Koʻrish',
    art: { title: 'ARIZA\nTASDIQLANDI', subtitle: 'Kuryer yoʻlga chiqadi', from: '#4f46e5', to: '#312e81', icon: 'truck' },
  },
  {
    key: 'pickupReady', title: 'Olib ketishga tayyor', hint: 'Mijoz oʻzi olib ketishni tanlaganda, siz tasdiqlaganingizda',
    vars: [RAQAM, MIJOZ, { name: 'punkt', label: 'Olib ketish joyi', sample: 'Chilonzor filiali' }, { name: 'manzil', label: 'Manzil', sample: 'Toshkent, Chilonzor 10-38' }, { name: 'vaqt', label: 'Ish vaqti', sample: '09:00–20:00' }, DOKON],
    text: '🏬 *Buyurtmangiz olib ketishga tayyor!*\n\n🧾 Buyurtma: №{{raqam}}\n📍 {{punkt}}: {{manzil}}\n🕘 {{vaqt}}\n\nKelganingizda buyurtma raqamini ayting.',
    button: 'Manzilni koʻrish',
    art: { title: 'OLIB KETISHGA\nTAYYOR', subtitle: 'Sizni kutyapmiz', from: '#1fa45a', to: '#0f6a3a', icon: 'pin' },
  },
  {
    key: 'delivered', title: 'Yetkazildi', hint: 'Buyurtma yetkazilganda',
    vars: [RAQAM, MIJOZ, DOKON],
    text: '🎉 *Buyurtmangiz yetkazildi!*\n\n🧾 Buyurtma: №{{raqam}}\n\nXaridingiz uchun rahmat! Mahsulotga baho qoldirsangiz, xursand boʻlamiz ⭐️',
    button: 'Baho berish',
    art: { title: 'YETKAZIB\nBERILDI', subtitle: 'Xaridingiz uchun rahmat!', from: '#0ea5a4', to: '#0f5f66', icon: 'gift' },
  },
  {
    key: 'cancelled', title: 'Bekor qilindi', hint: 'Buyurtma bekor qilinganda',
    vars: [RAQAM, MIJOZ, SUMMA, DOKON],
    text: '❌ *Buyurtma №{{raqam}} bekor qilindi*\n\nSavol boʻlsa, shu botga yozing — yordam beramiz.',
    button: 'Koʻrish',
    art: { title: 'BUYURTMA\nBEKOR QILINDI', subtitle: 'Savol boʻlsa, bizga yozing', from: '#64748b', to: '#334155', icon: 'x' },
  },
  {
    key: 'returned', title: 'Qaytarildi', hint: 'Buyurtma qaytarilganda',
    vars: [RAQAM, MIJOZ, SUMMA, DOKON],
    text: '↩️ *Buyurtma №{{raqam}} qaytarildi*\n\nPul qaytarilishi haqida operator xabar beradi.',
    button: 'Koʻrish',
    art: { title: 'BUYURTMA\nQAYTARILDI', subtitle: 'Operator siz bilan bogʻlanadi', from: '#8a3ffc', to: '#4b1d96', icon: 'undo' },
  },
  {
    key: 'coupon', title: 'Sizga kupon berildi', hint: 'Kuponni botga yuborganingizda (Marketing → Promo-kodlar)',
    vars: [
      MIJOZ,
      { name: 'kupon', label: 'Kupon nomi', sample: '11.11 bilan' },
      { name: 'qiymat', label: 'Chegirma', sample: '30 000 soʻm' },
      { name: 'kod', label: 'Kod', sample: 'SALE1111' },
      { name: 'muddat', label: 'Amal qilish muddati', sample: '15.12.2026' },
      { name: 'min', label: 'Minimal buyurtma', sample: '200 000 soʻm' },
      DOKON,
    ],
    text: '🎟 *Sizga kupon berildi:* {{kupon}} — {{qiymat}}\nKod: *{{kod}}*\nMinimal buyurtma: {{min}}\nAmal qiladi {{muddat}} gacha.',
    button: 'Kupon markazi',
    art: { title: 'KUPON', subtitle: '', from: '#e0192d', to: '#a30c1b', icon: 'ticket' },
  },
  {
    key: 'referralInvite', title: 'Doʻstni taklif qilish (ulashiladigan xabar)', hint: 'Mijoz “Ulashish”ni bosib doʻstiga yuboradigan xabar. Tugma doʻstni uning havolasi orqali roʻyxatdan oʻtkazadi',
    vars: [
      MIJOZ,
      { name: 'bonus', label: 'Doʻstga sovgʻa kupon', sample: '20 000 soʻm' },
      { name: 'jami', label: 'Taklif qilganga jami kuponlar', sample: '220 000 soʻm' },
      DOKON,
    ],
    text: '🎁 *{{dokon}}*\nMen {{dokon}} hamkorlik dasturida qatnashyapman 🤝 Doʻstlarni taklif qilib, *{{jami}}lik kuponlarni* qoʻlga kiritish mumkin.\n\n💰 *Siz ham boshqalarni taklif qilib pul ishlashingiz mumkin!*\n\nShu tugma orqali roʻyxatdan oʻting va {{bonus}}lik sovgʻa kupon oling 👇',
    button: 'Roʻyxatdan oʻtib bonus olish',
    art: { title: 'DOʻSTINGIZDAN\nSOVGʻA', subtitle: 'Roʻyxatdan oʻting va kupon oling', from: '#e0192d', to: '#7a0c18', icon: 'users' },
  },
  {
    key: 'awaitOnline', title: 'Toʻlov kutilmoqda (Click / Payme)', hint: 'Onlayn toʻlov bilan buyurtma berilganda — tugma toʻlov sahifasini ochadi',
    vars: [RAQAM, MIJOZ, SUMMA, SONI, { name: 'tolov', label: 'Toʻlov usuli', sample: 'Payme' }, DOKON],
    text: '💳 *Buyurtma №{{raqam}} — toʻlovni kutyapmiz*\n\n💰 Summa: *{{summa}}*\n📲 {{tolov}} orqali toʻlang. Toʻlov tushishi bilan buyurtmangiz avtomatik tasdiqlanadi.',
    button: 'Toʻlash',
    art: { title: 'TOʻLOVNI\nKUTYAPMIZ', subtitle: 'Bir bosishda onlayn toʻlang', from: '#00a3ff', to: '#0b4f8a', icon: 'card' },
  },
  {
    key: 'cartReminder', title: 'Savatda mahsulot qoldi', hint: 'Mijoz savatga qoʻshib, buyurtma bermasa (Marketing → Savat eslatmasi)',
    vars: [MIJOZ, SONI, SUMMA, { name: 'mahsulotlar', label: 'Mahsulotlar', sample: '• Simsiz quloqchin\n• Telefon gʻilofi' }, DOKON],
    text: '🛒 *{{mijoz}}, savatingizda mahsulotlar qoldi!*\n\n{{mahsulotlar}}\n\n💰 Jami: *{{summa}}*\nTugab qolmasidan buyurtma bering 👇',
    button: 'Savatni ochish',
    art: { title: 'SAVATINGIZ\nKUTYAPTI', subtitle: 'Buyurtmani yakunlang', from: '#2a7de1', to: '#163f7a', icon: 'cart' },
  },
  {
    key: 'cartCoupon', title: 'Savat eslatmasi + kupon', hint: 'Savat eslatmasida shaxsiy kupon berilganda',
    vars: [MIJOZ, SONI, SUMMA, { name: 'mahsulotlar', label: 'Mahsulotlar', sample: '• Simsiz quloqchin' }, { name: 'qiymat', label: 'Chegirma', sample: '5%' }, { name: 'kod', label: 'Kupon kodi', sample: 'DKA1B2C3D4' }, { name: 'muddat', label: 'Amal qilish muddati', sample: '20.11.2026' }, DOKON],
    text: '🎁 *{{mijoz}}, savatingiz uchun sovgʻa!*\n\n{{mahsulotlar}}\n\n🎟 Sizga *{{qiymat}}* chegirma: `{{kod}}`\n⏳ {{muddat}} gacha amal qiladi.',
    button: 'Chegirma bilan olish',
    art: { title: 'SAVATINGIZGA\nCHEGIRMA', subtitle: 'Faqat siz uchun kupon', from: '#e0192d', to: '#a30c1b', icon: 'ticket' },
  },
  {
    key: 'backInStock', title: 'Mahsulot qayta keldi', hint: '“Kelganda xabar ber” bosgan (yoki sevimlilarga qoʻshgan) mijozga, mahsulot omborga qaytganda',
    vars: [MIJOZ, { name: 'mahsulot', label: 'Mahsulot', sample: 'Simsiz quloqchin' }, { name: 'narx', label: 'Narx', sample: '249 000 soʻm' }, { name: 'qoldiq', label: 'Qoldiq', sample: '12 dona' }, DOKON],
    text: '🔔 *Siz kutgan mahsulot keldi!*\n\n📦 {{mahsulot}}\n💰 {{narx}}\n\nTez tugab qolishi mumkin — ulguring 👇',
    button: 'Koʻrish',
    art: { title: 'MAHSULOT\nQAYTA KELDI', subtitle: 'Siz kutgan mahsulot sotuvda', from: '#1fa45a', to: '#0f6a3a', icon: 'box' },
  },
  {
    key: 'cargoUpdate', title: 'Yuk qayerda (kargo bosqichi)', hint: 'Xodim buyurtmaning kargo bosqichini yangilaganda (Savdo → Kargo)',
    vars: [RAQAM, MIJOZ, { name: 'bosqich', label: 'Bosqich', sample: 'Chegarada' }, { name: 'trek', label: 'Trek raqami', sample: 'YT123456789' }, { name: 'izoh', label: 'Izoh', sample: '' }, DOKON],
    text: '📍 *Buyurtma №{{raqam}}: {{bosqich}}*\n\n🔎 Trek: {{trek}}\n{{izoh}}',
    button: 'Kuzatish',
    art: { title: 'YUKINGIZ\nYOʻLDA', subtitle: 'Qayerdaligini kuzating', from: '#4f46e5', to: '#312e81', icon: 'truck' },
  },
];

export const CUSTOMER_MSG_BY_KEY = Object.fromEntries(CUSTOMER_MESSAGES.map((m) => [m.key, m])) as Record<CustomerMsgKey, CustomerMsgDef>;
export const isCustomerMsgKey = (k: unknown): k is CustomerMsgKey => typeof k === 'string' && k in CUSTOMER_MSG_BY_KEY;

/**
 * Ega oʻzgartirgan narsalar. image: yoʻq — standart kartochka, 'none' — rasmsiz, https://… — oʻz rasmi.
 */
export interface CustomerMsgSetting { text?: string; button?: string; image?: string; off?: boolean }
export type CustomerMsgSettings = Partial<Record<CustomerMsgKey, CustomerMsgSetting>>;

export const CUSTOMER_TEXT_MAX = 900;
export const CUSTOMER_BUTTON_MAX = 30;
/** Rasm ostidagi yozuv (caption) Telegramda 1024 belgigacha. */
export const CAPTION_MAX = 1024;

export const customerSample = (key: CustomerMsgKey) => Object.fromEntries(CUSTOMER_MSG_BY_KEY[key].vars.map((v) => [v.name, v.sample]));

/** Rasm manzili: standart kartochka (saytdan yaratiladi), oʻz rasmi yoki null (rasmsiz). */
export function customerImage(siteUrl: string, key: CustomerMsgKey, setting: CustomerMsgSetting | undefined, extra = ''): string | null {
  const img = setting?.image;
  if (img === 'none') return null;
  if (img && /^https:\/\//i.test(img)) return img;
  return `${siteUrl}/api/tg-card/${key}${extra}`;
}

/** Oʻz rasmi uchun manzilni tekshiradi: faqat https, uzun emas. */
export const validImageUrl = (url: string) => /^https:\/\/[^\s"'<>]{4,490}$/i.test(url);
