import { describe, expect, it } from 'vitest';
import { parseSettings } from '@/lib/settings-schema';

describe('parseSettings home_sections', () => {
  it('eski saqlangan roʻyxatga yangi “reviews” blokini Afzalliklar oldiga qoʻshadi, tartib va holatni saqlaydi', () => {
    const saved = [
      { key: 'hero', title: '', enabled: true },
      { key: 'sale', title: 'Arzon', enabled: false },
      { key: 'advantages', title: '', enabled: true },
    ];
    const s = parseSettings([{ key: 'home_sections', value: saved }]);
    const keys = s.home_sections.map((x) => x.key);
    expect(keys.slice(0, 2)).toEqual(['hero', 'sale']);
    expect(keys.indexOf('reviews')).toBe(keys.indexOf('advantages') - 1);
    expect(s.home_sections.find((x) => x.key === 'sale')).toEqual({ key: 'sale', title: 'Arzon', enabled: false });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('“reviews” allaqachon boʻlsa (oʻchirilgan) — tegilmaydi', () => {
    const s = parseSettings([{ key: 'home_sections', value: [{ key: 'reviews', title: '', enabled: false }] }]);
    expect(s.home_sections.filter((x) => x.key === 'reviews')).toEqual([{ key: 'reviews', title: '', enabled: false }]);
  });
});
