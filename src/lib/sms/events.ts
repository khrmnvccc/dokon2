// SMS hodisalari va standart matnlar (Eskiz’da shablon sifatida tasdiqlatiladi). Brauzer va server uchun.

export type SmsEvent = 'orderNew' | 'paid' | 'confirmed' | 'shipped' | 'arrived' | 'delivered' | 'cancelled' | 'importQuoted';

export interface SmsEventDef { key: SmsEvent; title: string; vars: string[]; text: string }

export const SMS_EVENTS: SmsEventDef[] = [
  { key: 'orderNew', title: 'Buyurtma qabul qilindi', vars: ['dokon', 'raqam', 'summa'], text: '{{dokon}}: buyurtmangiz №{{raqam}} qabul qilindi. Summa: {{summa}}. Holatini saytda kuzating.' },
  { key: 'paid', title: 'Toʻlov qabul qilindi', vars: ['dokon', 'raqam', 'summa'], text: '{{dokon}}: buyurtma №{{raqam}} uchun {{summa}} toʻlov qabul qilindi. Rahmat!' },
  { key: 'confirmed', title: 'Tasdiqlandi', vars: ['dokon', 'raqam'], text: '{{dokon}}: buyurtma №{{raqam}} tasdiqlandi.' },
  { key: 'shipped', title: 'Yoʻlda', vars: ['dokon', 'raqam', 'trek'], text: '{{dokon}}: buyurtma №{{raqam}} yoʻlga chiqdi. Trek: {{trek}}' },
  { key: 'arrived', title: 'Oʻzbekistonga keldi', vars: ['dokon', 'raqam'], text: '{{dokon}}: buyurtma №{{raqam}} Oʻzbekistonga yetib keldi. Yetkazish yoki olib ketishni saytda tanlang.' },
  { key: 'delivered', title: 'Yetkazildi', vars: ['dokon', 'raqam'], text: '{{dokon}}: buyurtma №{{raqam}} yetkazildi. Xaridingiz uchun rahmat!' },
  { key: 'cancelled', title: 'Bekor qilindi', vars: ['dokon', 'raqam'], text: '{{dokon}}: buyurtma №{{raqam}} bekor qilindi.' },
  { key: 'importQuoted', title: 'Xitoydan buyurtma: narx tayyor', vars: ['dokon', 'sorov', 'summa'], text: '{{dokon}}: soʻrovingiz №{{sorov}} narxi tayyor: {{summa}}. Saytda tasdiqlang.' },
];

export const SMS_BY_KEY = Object.fromEntries(SMS_EVENTS.map((e) => [e.key, e])) as Record<SmsEvent, SmsEventDef>;
export const isSmsEvent = (k: unknown): k is SmsEvent => typeof k === 'string' && k in SMS_BY_KEY;

/** {{x}} oʻrniga qiymat; SMS oddiy matn — HTML yoʻq. */
export function renderSms(text: string, values: Record<string, string | number | null | undefined>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, n: string) => String(values[n] ?? '')).replace(/[ \t]+/g, ' ').trim().slice(0, 900);
}
