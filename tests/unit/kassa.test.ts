import { describe, expect, it } from 'vitest';
import { renderTemplate, sampleValues, translateTelegramError, TEMPLATES } from '@/lib/telegram/templates';
import { parseBroadcast } from '@/lib/telegram/broadcast';
import { canSee, pageAccess } from '@/lib/admin/pages';
import { ALL_PERMS, PRESETS, roleLabel } from '@/lib/perms';
import { cleanBrand } from '@/lib/brand/config';

describe('Telegram shablonlari', () => {
  it('qalin matn va qiymatlar, HTML escape', () => {
    expect(renderTemplate('*Salom* {{ism}}', { ism: '<b>Ali</b> & co' })).toBe('<b>Salom</b> &lt;b&gt;Ali&lt;/b&gt; &amp; co');
  });
  it('qiymati boʻsh qator tashlab ketiladi', () => {
    expect(renderTemplate('A\n📝 {{izoh}}\nB', { izoh: '  ' })).toBe('A\nB');
  });
  it('har bir standart shablon namunasi bilan boʻsh emas', () => {
    for (const t of TEMPLATES) expect(renderTemplate(t.text, sampleValues(t.key)).length).toBeGreaterThan(5);
  });
  it('xatolar oʻzbekchaga oʻgiriladi', () => {
    expect(translateTelegramError('Forbidden: bot was blocked by the user')).toBe('Foydalanuvchi botni bloklagan');
    expect(translateTelegramError('Bad Request: chat not found')).toMatch(/Chat topilmadi/);
    expect(translateTelegramError('something new')).toBe('Telegram rad etdi: something new');
  });
});

describe('Ommaviy xabar tekshiruvi', () => {
  it('https boʻlmagan tugma rad etiladi', () => {
    expect(() => parseBroadcast({ text: 'x', buttons: [{ text: 'Sayt', url: 'http://a.uz' }] })).toThrow(/https/);
  });
  it('boʻsh matn rad etiladi', () => {
    expect(() => parseBroadcast({ text: '   ' })).toThrow();
  });
  it('auditoriya va vaqt tozalanadi', () => {
    const b = parseBroadcast({ text: ' Salom ', audience: { kind: 'staff', users: ['bad', '11111111-1111-1111-1111-111111111111'] }, sendAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(b.text).toBe('Salom');
    expect(b.audience).toEqual({ kind: 'staff', users: ['11111111-1111-1111-1111-111111111111'] });
    expect(() => parseBroadcast({ text: 'x', sendAt: '2099-01-01T00:00:00Z' })).toThrow(/60 kun/);
  });
});

describe('Oynalar va ruxsatlar', () => {
  const item = { href: '/admin/orders', label: 'Buyurtmalar', icon: 'x', perm: 'orders.read' };
  const owner = { roles: ['super_admin'], permissions: new Set(['orders.read', 'settings.write']) };
  const staff = { roles: ['operator'], permissions: new Set(['orders.read']) };
  it('"Faqat Ega" oynasi xodimga koʻrinmaydi', () => {
    const pages = { '/admin/orders': { paused: false, who: 'owner' as const, label: '' } };
    expect(canSee(owner, item, pages)).toBe(true);
    expect(canSee(staff, item, pages)).toBe(false);
  });
  it('toʻxtatilgan oynani Ega baribir ochadi', () => {
    const pages = { '/admin/orders': { paused: true, who: 'all' as const, label: '' } };
    expect(pageAccess(owner, '/admin/orders/1', pages)).toBe('owner-paused');
    expect(pageAccess(staff, '/admin/orders', pages)).toBe('paused');
  });
  it('Sozlamalar oynasini toʻxtatib boʻlmaydi', () => {
    const pages = { '/admin/settings': { paused: true, who: 'owner' as const, label: '' } };
    expect(pageAccess(owner, '/admin/settings', pages)).toBe('ok');
  });
  it('tayyor toʻplamlar faqat mavjud ruxsatlardan', () => {
    for (const p of PRESETS) for (const k of p.perms) expect(ALL_PERMS).toContain(k);
    expect(roleLabel(['operator'], ['inventory.write', 'products.read'])).toBe('Omborchi');
    expect(roleLabel(['super_admin'], null)).toBe('Ega');
  });
});

describe('Brend', () => {
  it('notoʻgʻri rang standartga qaytadi, nom qisqartiriladi', () => {
    const b = cleanBrand({ color: 'red;}', name: 'x'.repeat(200) });
    expect(b.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(b.name.length).toBeLessThanOrEqual(60);
  });
});
