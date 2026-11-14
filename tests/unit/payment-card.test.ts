import { describe, expect, it } from 'vitest';
import { cleanCard, formatCardNumber, sniffImage } from '@/lib/payment-card';

describe('payment card', () => {
  it('formats and validates number', () => {
    expect(formatCardNumber('8600123412341234')).toBe('8600 1234 1234 1234');
    expect(cleanCard({ number: '8600 1234 1234 1234', theme: 'nope' })).toEqual({ number: '8600123412341234', holder: '', bank: '', theme: 'dark' });
    expect(cleanCard({ number: '1234' })).toBeNull();
    expect(cleanCard(null)).toBeNull();
  });
  it('sniffs image bytes', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });
});

import { paymentMethodSchema } from '@/lib/admin/schemas';
describe('payment method card field', () => {
  const base = { code: 'karta', name: 'Karta', kind: 'bank_transfer', provider: '', is_active: true, sort_order: 0 };
  it('keeps card only for bank transfer', () => {
    const r = paymentMethodSchema.parse({ ...base, card: { number: '8600 1234 5678 1234', holder: 'ALI', bank: '', theme: 'blue' } });
    expect(r.card).toEqual({ number: '8600123456781234', holder: 'ALI', bank: '', theme: 'blue' });
    expect(paymentMethodSchema.parse({ ...base, kind: 'cash', card: { number: '8600123456781234' } }).card).toBeNull();
    expect(paymentMethodSchema.parse({ ...base, card: { number: '', holder: 'x' } }).card).toBeNull();
    expect(paymentMethodSchema.safeParse({ ...base, card: { number: '8600 12' } }).success).toBe(false);
  });
});

import { templateButton, TEMPLATE_BY_KEY } from '@/lib/telegram/templates';
describe('template buttons', () => {
  const base = { texts: {}, off: [], chats: {} };
  it('uses default, own text, or none', () => {
    expect(templateButton(base, 'newOrder')).toBe(TEMPLATE_BY_KEY.newOrder.button);
    expect(templateButton({ ...base, buttons: { newOrder: 'Ochish' } }, 'newOrder')).toBe('Ochish');
    expect(templateButton({ ...base, buttons: { newOrder: '  ' } }, 'newOrder')).toBeNull();
    expect(templateButton(base, 'dailyReport')).toBeNull();
  });
});
