// Telegram xabar matnlari (kassa tgTemplates.ts uslubida). Server (yuborish uchun) va brauzer
// (qanday koʻrinishini oldindan koʻrsatish uchun) shu bitta fayldan oʻqiydi — natija bir xil boʻladi.

export type TemplateKey = 'newOrder' | 'paymentReceipt' | 'customerMessage' | 'paymentReceived' | 'orderStatus' | 'orderCancel' | 'paymentVoid' | 'lowStock' | 'dailyReport';

/** Roʻyxatdagi oʻrni: A — buyurtma va pul, B — bekor qilish, C — hisobot. */
export type TemplateGroup = 'kirim' | 'bekor' | 'hisobot';
export const TEMPLATE_GROUPS: { key: TemplateGroup; letter: string; title: string }[] = [
  { key: 'kirim', letter: 'A', title: 'BUYURTMA VA TOʻLOV' },
  { key: 'bekor', letter: 'B', title: 'BEKOR QILISH' },
  { key: 'hisobot', letter: 'C', title: 'HISOBOT' },
];

export interface TemplateVar { name: string; label: string; sample: string }
export interface TemplateDef {
  key: TemplateKey; group: TemplateGroup; title: string; hint: string; vars: TemplateVar[]; text: string;
  /** Guruhga ham ketishi mumkin */
  groupChat?: boolean;
  /** Xodimlarga ham berish mumkin (kechki hisobot faqat Egaga) */
  staff?: boolean;
  /** Xabar ostidagi tugma (admin ilovasini kerakli sahifada ochadi). Ega matnini oʻzgartiradi yoki oʻchiradi. */
  button?: string;
}

const RAQAM: TemplateVar = { name: 'raqam', label: 'Buyurtma №', sample: '100245' };
const MIJOZ: TemplateVar = { name: 'mijoz', label: 'Mijoz', sample: 'Aziz Karimov' };
const TELEFON: TemplateVar = { name: 'telefon', label: 'Telefon', sample: '+998 90 123 45 67' };
const SUMMA: TemplateVar = { name: 'summa', label: 'Summa', sample: '1 250 000 soʻm' };
const TOLOV: TemplateVar = { name: 'tolov', label: 'Toʻlov usuli', sample: 'Click' };
const KIM: TemplateVar = { name: 'kim', label: 'Kim', sample: 'Dilnoza' };
const HAVOLA: TemplateVar = { name: 'havola', label: 'Admin havolasi', sample: 'https://dokon.uz/admin/orders/…' };

export const TEMPLATES: TemplateDef[] = [
  {
    key: 'newOrder', group: 'kirim', groupChat: true, staff: true, title: 'Yangi buyurtma', hint: 'Mijoz buyurtma berishi bilan',
    vars: [
      RAQAM, MIJOZ, TELEFON, SUMMA, TOLOV,
      { name: 'yetkazish', label: 'Yetkazish', sample: 'Kuryer · Toshkent' },
      { name: 'mahsulotlar', label: 'Mahsulotlar', sample: '• Simsiz quloqchin × 1\n• Telefon gʻilofi × 2' },
      { name: 'manzil', label: 'Manzil', sample: 'Chilonzor, 9-kvartal, 12-uy' },
      { name: 'izoh', label: 'Izoh', sample: '' },
      HAVOLA,
    ],
    text: '🛒 *Yangi buyurtma №{{raqam}}*\n{{mijoz}} · {{telefon}}\n💰 *{{summa}}* · {{tolov}}\n🚚 {{yetkazish}}\n{{mahsulotlar}}\n📍 {{manzil}}\n📝 {{izoh}}',
    button: '📦 Buyurtmani ochish',
  },
  {
    key: 'paymentReceipt', group: 'kirim', groupChat: true, staff: true, title: 'Chek yuklandi', hint: 'Mijoz kartaga oʻtkazma chekini yuklaganda (rasm bilan)',
    vars: [RAQAM, MIJOZ, TELEFON, SUMMA, TOLOV, HAVOLA],
    text: '🧾 *Chek yuklandi · №{{raqam}}*\n{{mijoz}} · {{telefon}}\n💰 *{{summa}}* · {{tolov}}\nChekni tekshirib, tasdiqlang 👇',
    button: '🧾 Chekni tekshirish',
  },
  {
    key: 'customerMessage', group: 'kirim', groupChat: true, staff: true, title: 'Mijoz botga yozdi', hint: 'Mijoz doʻkon botiga savol yoki xabar yozganda',
    vars: [
      MIJOZ, TELEFON,
      { name: 'id', label: 'Mijoz ID', sample: '1024' },
      { name: 'matn', label: 'Xabar', sample: 'Buyurtmam qachon keladi?' },
    ],
    text: '💬 *{{mijoz}}* (ID {{id}}) · {{telefon}}\n{{matn}}',
    button: '💬 Javob yozish',
  },
  {
    key: 'paymentReceived', group: 'kirim', groupChat: true, staff: true, title: 'Toʻlov qabul qilindi', hint: 'Buyurtma “Toʻlangan” deb belgilanganda',
    vars: [RAQAM, MIJOZ, SUMMA, TOLOV, KIM],
    text: '💳 *Toʻlov · {{summa}}*\n№{{raqam}} · {{mijoz}}\n{{tolov}}\n👤 {{kim}}',
    button: 'Buyurtmani ochish',
  },
  {
    key: 'orderStatus', group: 'kirim', groupChat: true, staff: true, title: 'Holat oʻzgardi', hint: 'Tasdiqlandi, Yigʻilmoqda, Yoʻlda, Yetkazildi',
    vars: [
      RAQAM, MIJOZ,
      { name: 'holat', label: 'Yangi holat', sample: 'Yoʻlda' },
      { name: 'trek', label: 'Trek raqami', sample: '' },
      KIM,
    ],
    text: '📦 №{{raqam}} · *{{holat}}*\n{{mijoz}}\n🔎 Trek: {{trek}}\n👤 {{kim}}',
    button: 'Buyurtmani ochish',
  },
  {
    key: 'orderCancel', group: 'bekor', groupChat: true, staff: true, title: 'Buyurtma bekor qilindi', hint: 'Bekor qilinganda yoki qaytarilganda darhol',
    vars: [RAQAM, MIJOZ, SUMMA, KIM, { name: 'sabab', label: 'Sabab', sample: 'mijoz fikridan qaytdi' }],
    text: '⚠️ *Buyurtma №{{raqam}} bekor qilindi*\n{{mijoz}} · {{summa}}\nKim: {{kim}}\nSabab: {{sabab}}',
    button: 'Buyurtmani ochish',
  },
  {
    key: 'paymentVoid', group: 'bekor', groupChat: true, staff: true, title: 'Toʻlov qaytarildi', hint: 'Toʻlov “Qaytarilgan” yoki “Xato” boʻlganda',
    vars: [RAQAM, MIJOZ, SUMMA, TOLOV, KIM],
    text: '↩️ *Toʻlov qaytarildi*\n№{{raqam}} · {{mijoz}} · {{summa}} · {{tolov}}\nKim: {{kim}}',
    button: 'Buyurtmani ochish',
  },
  {
    key: 'lowStock', group: 'hisobot', groupChat: true, staff: true, title: 'Mahsulot tugayapti', hint: 'Buyurtmadan keyin qoldiq chegaradan tushsa',
    vars: [{ name: 'royxat', label: 'Roʻyxat', sample: '• Simsiz quloqchin — 2 dona\n• Telefon gʻilofi (qora) — 0 dona' }],
    text: '📉 *Tugayotgan mahsulotlar*\n{{royxat}}',
    button: 'Ombor',
  },
  {
    key: 'dailyReport', group: 'hisobot', title: 'Kechki hisobot', hint: 'Har kuni 21:00 da, faqat sizga',
    vars: [
      { name: 'dokon', label: 'Doʻkon', sample: 'Mening doʻkonim' },
      { name: 'sana', label: 'Sana', sample: '13-noyabr, 2026' },
      { name: 'jami', label: 'Jami savdo', sample: '14 380 000 soʻm' },
      { name: 'soni', label: 'Buyurtmalar soni', sample: '37' },
      { name: 'turlar', label: 'Toʻlov turlari', sample: '   Naqd: 6 650 000 soʻm\n   Click: 7 730 000 soʻm' },
      { name: 'bekor', label: 'Bekor qilingan', sample: '2 ta' },
      { name: 'yetkazilmagan', label: 'Yetkazilmagan', sample: '11 ta' },
    ],
    text: '📊 *{{dokon}} · {{sana}}*\n\n💰 Jami: *{{jami}}* ({{soni}} ta buyurtma)\n{{turlar}}\n⚠️ Bekor qilingan: {{bekor}}\n🚚 Yetkazilmagan: {{yetkazilmagan}}',
  },
];

/** Bitta xabar qaysi chatlarga ketadi. Yoʻq qiymat: Ega chati — ha, guruh — ha, xodimlar — yoʻq. */
export interface TemplateChats { personal?: boolean; group?: boolean; staff?: string[] }

/** Ega oʻzgartirgan narsalar: oʻz matnlari, oʻchirilgan xabarlar va har birining chatlari. */
export interface TemplateSettings {
  texts: Partial<Record<TemplateKey, string>>; off: TemplateKey[]; chats: Partial<Record<TemplateKey, TemplateChats>>;
  /** Tugma matni (boʻsh satr — tugmasiz). Yoʻq boʻlsa — standart. */
  buttons?: Partial<Record<TemplateKey, string>>;
}
export const MAX_BUTTON_LENGTH = 30;
/** Ega tanlagan tugma matni: null — tugma yoʻq. */
export const templateButton = (s: TemplateSettings, key: TemplateKey): string | null => {
  const def = TEMPLATE_BY_KEY[key].button;
  if (!def) return null;
  const own = s.buttons?.[key];
  return own === undefined ? def : own.trim() || null;
};

export const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map((t) => [t.key, t])) as Record<TemplateKey, TemplateDef>;
export const isTemplateKey = (k: unknown): k is TemplateKey => typeof k === 'string' && k in TEMPLATE_BY_KEY;

export const MAX_TEMPLATE_LENGTH = 900;

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Shablon + qiymatlar → Telegram HTML. Matn oddiy: *yulduzcha orasida* — qalin, {{nom}} — qiymat.
 * Barcha qiymatlari boʻsh qator tashlab ketiladi (“📝 ” ortidan hech narsasiz chiqmaydi).
 */
export function renderTemplate(text: string, values: Record<string, string | number | undefined | null>): string {
  const lines: string[] = [];
  for (const line of text.split('\n')) {
    const names = [...line.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
    if (names.length && names.every((n) => !String(values[n] ?? '').trim())) continue;
    const html = escapeHtml(line)
      .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, n: string) => escapeHtml(String(values[n] ?? '')));
    lines.push(html);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Oldindan koʻrish uchun namuna qiymatlar. */
export const sampleValues = (key: TemplateKey) => Object.fromEntries(TEMPLATE_BY_KEY[key].vars.map((v) => [v.name, v.sample]));

// ---------- Ommaviy xabarlar ----------
export interface BroadcastButton { text: string; url: string }
export const BROADCAST_MAX_TEXT = 3500;
export const BROADCAST_MAX_BUTTONS = 2;
export type BroadcastAudience = { kind: 'staff' | 'customers' | 'all'; users?: string[] };
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export interface Broadcast {
  id: number; title: string; text: string; image?: string | null; buttons: BroadcastButton[]; audience: BroadcastAudience;
  silent: boolean; send_at: string | null; status: BroadcastStatus; delivered: number; failed: number;
  created_at: string; sent_at: string | null;
}
export const BROADCAST_STATUS: Record<BroadcastStatus, { label: string; tone: 'neutral' | 'card' | 'warn' | 'success' | 'danger' }> = {
  draft: { label: 'Qoralama', tone: 'neutral' },
  scheduled: { label: 'Rejalashtirilgan', tone: 'card' },
  sending: { label: 'Yuborilmoqda', tone: 'warn' },
  sent: { label: 'Yuborildi', tone: 'success' },
  failed: { label: 'Yuborilmadi', tone: 'danger' },
};

/** Telegram xatolarini tushunarli oʻzbekchaga oʻgiradi. */
export function translateTelegramError(description: string): string {
  const d = description.toLowerCase();
  if (d.includes('unauthorized')) return 'Bot tokeni notoʻgʻri yoki bekor qilingan. @BotFather dan yangisini oling';
  if (d.includes('bot was blocked by the user')) return 'Foydalanuvchi botni bloklagan';
  if (d.includes('user is deactivated')) return 'Telegram hisobi oʻchirilgan';
  if (d.includes('bot was kicked')) return 'Bot guruhdan chiqarib yuborilgan. Qayta qoʻshing';
  if (d.includes('chat not found')) return 'Chat topilmadi: botga “Start” bosilmagan yoki bot guruhda yoʻq';
  if (d.includes('not enough rights') || d.includes('have no rights')) return 'Botda guruhga yozish huquqi yoʻq. Guruh sozlamalarida ruxsat bering';
  if (d.includes('need administrator rights')) return 'Botni guruhda admin qiling';
  if (d.includes('message is too long')) return 'Xabar juda uzun';
  if (d.includes("can't parse entities")) return 'Matndagi formatlashda xato (yulduzchalar juftligini tekshiring)';
  if (d.includes('too many requests')) return 'Telegram juda tez yuborishni toʻxtatdi. Birozdan keyin qayta urinib koʻring';
  if (d.includes('message thread not found')) return 'Guruhdagi mavzu (topic) topilmadi';
  if (d.includes('upgraded to a supergroup')) return 'Guruh superguruhga aylandi. Qayta ulang';
  if (d.includes('wrong http url') || d.includes('button_url_invalid')) return 'Tugma havolasi notoʻgʻri';
  return `Telegram rad etdi: ${description}`;
}
