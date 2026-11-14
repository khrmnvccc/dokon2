import { describe, expect, it } from 'vitest';
import { cleanReferralSettings, DEFAULT_REFERRAL, parseRefCode, referralSettingsSchema, shareLinks } from '@/lib/referral';

describe('parseRefCode', () => {
  it('bot va sayt koʻrinishlarini oʻqiydi', () => {
    expect(parseRefCode('ref_1024')).toBe(1024);
    expect(parseRefCode('REF_77')).toBe(77);
    expect(parseRefCode('1050')).toBe(1050);
  });
  it('notoʻgʻri qiymatni rad etadi', () => {
    for (const v of [null, undefined, '', 'ref_', 'ref_abc', '0', '-5', '1e3', 'ref_12345678901234', "1;drop"]) expect(parseRefCode(v)).toBeNull();
  });
});

describe('referral sozlamalari', () => {
  it('boʻsh qiymat → standart', () => {
    expect(cleanReferralSettings(null)).toEqual(DEFAULT_REFERRAL);
    expect(cleanReferralSettings('xato')).toEqual(DEFAULT_REFERRAL);
  });
  it('qisman saqlangan qiymat standart bilan toʻldiriladi', () => {
    const s = cleanReferralSettings({ enabled: false, partner: { percent: 5 } });
    expect(s.enabled).toBe(false);
    expect(s.partner.percent).toBe(5);
    expect(s.partner.min_payout).toBe(DEFAULT_REFERRAL.partner.min_payout);
    expect(s.steps).toHaveLength(5);
  });
  it('bosqichlar oʻsib borishi shart', () => {
    const bad = { ...DEFAULT_REFERRAL, steps: [{ friends: 2, amount: 1, min_order: 0 }, { friends: 2, amount: 1, min_order: 0 }] };
    expect(referralSettingsSchema.safeParse(bad).success).toBe(false);
    expect(referralSettingsSchema.safeParse({ ...DEFAULT_REFERRAL, steps: [] }).success).toBe(false);
    expect(referralSettingsSchema.safeParse({ ...DEFAULT_REFERRAL, partner: { ...DEFAULT_REFERRAL.partner, percent: 80 } }).success).toBe(false);
    expect(referralSettingsSchema.safeParse(DEFAULT_REFERRAL).success).toBe(true);
  });
});

describe('shareLinks', () => {
  it('bot ulangan boʻlsa — bot havolasi, aks holda sayt', () => {
    expect(shareLinks(1024, 'https://x.uz/', 'MyShopBot').main).toBe('https://t.me/MyShopBot?start=ref_1024');
    expect(shareLinks(1024, 'https://x.uz', null).main).toBe('https://x.uz/r/1024');
  });
});
