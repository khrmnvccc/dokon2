// Doʻkon boti xaridorga yuboradigan xabarlar: rasm + matn + tugma (Laylak botidagidek).
// Ega har birini Telegram → Xabarlar va Push → “Mijozga” boʻlimida oʻzgartiradi: matn, tugma nomi va rasm
// (standart rasm, oʻz rasmi yoki rasmsiz). Server ham, admin oldindan koʻrishi ham shu fayldan oʻqiydi.

import type { TemplateVar } from './templates';

export type CustomerMsgKey =
  | 'orderNew' | 'awaitPayment' | 'paid' | 'receiptRejected' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'coupon';

/** Standart rasm (kartochka) uchun yozuvlar va ranglar. */
export interface CardArt { title: string; subtitle: string; from: string; to: string; icon: CardIcon }
export type CardIcon = 'cart' | 'check' | 'box' | 'truck' | 'gift' | 'x' | 'undo' | 'ticket' | 'card';

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
    vars: [RAQAM, MIJOZ, SUMMA, SONI, DOKON],
    text: '💳 *Buyurtma №{{raqam}} — toʻlovni kutyapmiz*\n\n💰 Summa: *{{summa}}*\n\nKartaga oʻtkazing va chek rasmini yuklang. Toʻlov tasdiqlangach, buyurtmangiz qabul qilinadi.',
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
