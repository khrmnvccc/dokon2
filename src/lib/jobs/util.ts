import 'server-only';

/** Toshkent vaqti (UTC+5, yozgi vaqt yoʻq). */
export function tashkentNow(now = new Date()) {
  const local = new Date(now.getTime() + 5 * 3600_000);
  return { local, hour: local.getUTCHours(), date: local.toISOString().slice(0, 10), dow: local.getUTCDay(), day: local.getUTCDate() };
}

/** Soat oraligʻi ichidami (masalan 22 → 9: tun). */
export function inQuietHours(hour: number, from: number, to: number) {
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

export const ddmmyyyy = (d: Date) => {
  const l = new Date(d.getTime() + 5 * 3600_000);
  return `${String(l.getUTCDate()).padStart(2, '0')}.${String(l.getUTCMonth() + 1).padStart(2, '0')}.${l.getUTCFullYear()}`;
};
