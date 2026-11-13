import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyInitData } from '@/lib/telegram/webapp-auth';

// Telegram mini-ilova imzosi: faqat toʻgʻri bot tokeni bilan, yangi va oʻzgartirilmagan maʼlumot qabul qilinadi.
const TOKEN = '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function sign(token: string, fields: Record<string, string>) {
  const p = new URLSearchParams(fields);
  const check = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return p.toString();
}
const now = () => String(Math.floor(Date.now() / 1000));
const user = JSON.stringify({ id: 42, first_name: 'Ali' });

describe('verifyInitData', () => {
  it('toʻgʻri imzoni qabul qiladi', () => {
    expect(verifyInitData(sign(TOKEN, { auth_date: now(), user }), TOKEN, 3600)?.id).toBe(42);
  });
  it('boshqa bot tokeni bilan imzolanganini rad etadi', () => {
    expect(verifyInitData(sign('999:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', { auth_date: now(), user }), TOKEN, 3600)).toBeNull();
  });
  it('oʻzgartirilgan foydalanuvchini rad etadi', () => {
    const data = sign(TOKEN, { auth_date: now(), user }).replace('%22id%22%3A42', '%22id%22%3A43');
    expect(verifyInitData(data, TOKEN, 3600)).toBeNull();
  });
  it('eskirgan maʼlumotni rad etadi', () => {
    expect(verifyInitData(sign(TOKEN, { auth_date: String(Math.floor(Date.now() / 1000) - 7200), user }), TOKEN, 3600)).toBeNull();
  });
  it('hash yoʻq yoki boʻsh maʼlumotni rad etadi', () => {
    expect(verifyInitData('', TOKEN, 3600)).toBeNull();
    expect(verifyInitData(`auth_date=${now()}&user=${encodeURIComponent(user)}`, TOKEN, 3600)).toBeNull();
  });
});
