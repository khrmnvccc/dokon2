import { describe, expect, it } from 'vitest';
import { formatUzPhone, normalizeUzPhone } from '@/lib/phone';
import { checkoutSchema, registerSchema } from '@/lib/validation';
import { productSchema } from '@/lib/admin/schemas';
import { settingsSchemas } from '@/lib/settings-schema';
import { safeNext } from '@/lib/safe-next';
import { slugify } from '@/lib/format';

describe('telefon', () => {
  it.each([
    ['+998 90 123 45 67', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['90 123-45-67', '+998901234567'],
    ['(33) 444 55 66', '+998334445566'],
    ['8901234567', '+998901234567'],
  ])('%s -> %s', (input, out) => expect(normalizeUzPhone(input)).toBe(out));
  it.each(['12345', '+7 900 123 45 67', '+998 11 123 45 67', ''])('noto‘g‘ri: %s', (input) => expect(normalizeUzPhone(input)).toBeNull());
  it('formatlaydi', () => expect(formatUzPhone('+998901234567')).toBe('+998 90 123 45 67'));
});

describe('checkout sxemasi', () => {
  const base = {
    idempotencyKey: '7f9c1e2a-1111-4c3b-9a6e-1234567890ab',
    items: [{ productId: '7f9c1e2a-1111-4c3b-9a6e-1234567890ab', quantity: 1 }],
    customer_name: 'Ali Valiyev',
    phone: '90 123 45 67',
    shippingMethodId: '7f9c1e2a-1111-4c3b-9a6e-1234567890ab',
    paymentMethodId: '7f9c1e2a-1111-4c3b-9a6e-1234567890ab',
  };
  it('telefonni normallashtiradi', () => {
    const r = checkoutSchema.parse(base);
    expect(r.phone).toBe('+998901234567');
  });
  it('bo‘sh savatcha va noto‘g‘ri miqdorni rad etadi', () => {
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: 1.5 }] }).success).toBe(false);
  });
  it('idempotency kalit majburiy', () => {
    expect(checkoutSchema.safeParse({ ...base, idempotencyKey: 'abc' }).success).toBe(false);
  });
  it('mijoz narx yubora olmaydi (sxemada narx maydoni yo‘q)', () => {
    const r = checkoutSchema.parse({ ...base, total: 1, items: [{ ...base.items[0], price: 1 }] });
    expect('total' in r).toBe(false);
    expect('price' in r.items[0]).toBe(false);
  });
});

describe('ro‘yxatdan o‘tish', () => {
  const ok = { full_name: 'Ali', phone: '901234567', email: 'Ali@Mail.uz', password: 'parol1234', password_confirm: 'parol1234', accept: true };
  it('to‘g‘ri ma’lumot', () => expect(registerSchema.parse(ok).email).toBe('ali@mail.uz'));
  it('parol talablari', () => {
    expect(registerSchema.safeParse({ ...ok, password: 'qisqa1', password_confirm: 'qisqa1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password: 'faqatharflar', password_confirm: 'faqatharflar' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password_confirm: 'boshqa1234' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, accept: false }).success).toBe(false);
  });
});

describe('admin mahsulot sxemasi', () => {
  const base = {
    name: 'Futbolka', slug: 'futbolka', category_id: '', price: '149 000', compare_at_price: '', cost_price: '90000', stock: '5',
    low_stock_threshold: 3, track_stock: true, is_active: true, is_featured: false, is_bestseller: false, is_new: true, weight_grams: '',
    attributes: [], images: [], variants: [],
  };
  it('narxlarni raqamga aylantiradi', () => {
    const r = productSchema.parse(base);
    expect(r.price).toBe(149000);
    expect(r.compare_at_price).toBeNull();
    expect(r.cost_price).toBe(90000);
    expect(r.category_id).toBeNull();
  });
  it('eski narx joriy narxdan katta bo‘lishi kerak', () => {
    expect(productSchema.safeParse({ ...base, compare_at_price: '100000' }).success).toBe(false);
  });
  it('slug formati', () => {
    expect(productSchema.safeParse({ ...base, slug: 'Futbolka Qora' }).success).toBe(false);
  });
});

describe('sozlamalar', () => {
  it('rang formati tekshiriladi (CSS injection himoyasi)', () => {
    const store = { name: 'Do‘kon', tagline: '', logo_url: null, favicon_url: null, primary_color: '#0e7c66', accent_color: '#f97316' };
    expect(settingsSchemas.store.safeParse(store).success).toBe(true);
    expect(settingsSchemas.store.safeParse({ ...store, primary_color: 'red;}body{display:none' }).success).toBe(false);
  });
});

describe('yordamchilar', () => {
  it('safeNext ochiq redirectni bloklaydi', () => {
    expect(safeNext('/account/orders')).toBe('/account/orders');
    expect(safeNext('//evil.com')).toBe('/account');
    expect(safeNext('https://evil.com')).toBe('/account');
    expect(safeNext('/\\evil.com')).toBe('/account');
  });
  it('slugify lotin va kirillni qo‘llaydi', () => {
    expect(slugify('Erkaklar ko‘ylagi')).toMatch(/^[a-z0-9-]+$/);
    expect(slugify('Телефон Samsung')).toMatch(/^[a-z0-9-]+$/);
  });
});
