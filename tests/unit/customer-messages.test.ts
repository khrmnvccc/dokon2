import { describe, expect, it } from 'vitest';
import { CUSTOMER_MESSAGES, customerImage, customerSample, validImageUrl } from '@/lib/telegram/customer-messages';
import { renderTemplate } from '@/lib/telegram/templates';

describe('mijozga xabarlar', () => {
  it('har bir standart matn namunaviy qiymatlar bilan toʻliq chiqadi va rasm ostiga sigʻadi', () => {
    for (const m of CUSTOMER_MESSAGES) {
      const html = renderTemplate(m.text, customerSample(m.key));
      expect(html).not.toMatch(/\{\{/);
      expect(html.length).toBeLessThan(1024);
      expect(m.button.length).toBeGreaterThan(0);
    }
  });

  it('qiymatlar escape qilinadi', () => {
    const html = renderTemplate('{{kupon}}', { kupon: '<script>x</script>' });
    expect(html).toBe('&lt;script&gt;x&lt;/script&gt;');
  });

  it('rasm: standart, oʻz rasmi yoki rasmsiz', () => {
    expect(customerImage('https://s.uz', 'shipped', undefined)).toBe('https://s.uz/api/tg-card/shipped');
    expect(customerImage('https://s.uz', 'coupon', {}, '?c=1')).toBe('https://s.uz/api/tg-card/coupon?c=1');
    expect(customerImage('https://s.uz', 'shipped', { image: 'none' })).toBeNull();
    expect(customerImage('https://s.uz', 'shipped', { image: 'https://cdn.uz/a.png' })).toBe('https://cdn.uz/a.png');
    expect(customerImage('https://s.uz', 'shipped', { image: 'javascript:alert(1)' })).toBe('https://s.uz/api/tg-card/shipped');
  });

  it('faqat https rasm manzili qabul qilinadi', () => {
    expect(validImageUrl('https://cdn.uz/a.png')).toBe(true);
    expect(validImageUrl('http://cdn.uz/a.png')).toBe(false);
    expect(validImageUrl('https://a b')).toBe(false);
  });
});
