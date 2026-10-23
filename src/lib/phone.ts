// O'zbekiston mobil va shahar raqamlari uchun operator kodlari
const UZ_CODES = ['20', '33', '50', '55', '61', '62', '65', '66', '67', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '88', '90', '91', '93', '94', '95', '97', '98', '99'];

/** Har qanday kiritilgan ko'rinishni "+998XXXXXXXXX" ga keltiradi yoki null qaytaradi. */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let local: string;
  if (digits.length === 12 && digits.startsWith('998')) local = digits.slice(3);
  else if (digits.length === 9) local = digits;
  else if (digits.length === 10 && digits.startsWith('8')) local = digits.slice(1);
  else return null;
  if (!UZ_CODES.includes(local.slice(0, 2))) return null;
  return `+998${local}`;
}

export function isValidUzPhone(input: string): boolean {
  return normalizeUzPhone(input) !== null;
}

/** "+998901234567" -> "+998 90 123 45 67" */
export function formatUzPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const n = normalizeUzPhone(phone);
  if (!n) return phone;
  return `+998 ${n.slice(4, 6)} ${n.slice(6, 9)} ${n.slice(9, 11)} ${n.slice(11, 13)}`;
}
