import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebAppUser { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string }

/**
 * Telegram mini-ilova initData imzosini tekshiradi (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Imzo bot tokeni bilan qoʻyiladi — tokenni bilmagan odam soxta foydalanuvchi yasay olmaydi.
 * maxAgeSec dan eski maʼlumot qabul qilinmaydi (qayta ishlatishdan himoya).
 */
export function verifyInitData(initData: string, token: string, maxAgeSec: number): WebAppUser | null {
  if (!initData || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as WebAppUser | null;
    return user && Number.isSafeInteger(user.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}
