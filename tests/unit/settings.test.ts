import { describe, expect, it } from 'vitest';
import { parseSettings } from '@/lib/settings-schema';

describe('parseSettings home_sections', () => {
  it('eski saqlangan roʻyxatga yangi “reviews” blokini bannerdan (kategoriyalar boʻlmasa) keyin qoʻshadi, tartib va holatni saqlaydi', () => {
    const saved = [
      { key: 'hero', title: '', enabled: true },
      { key: 'sale', title: 'Arzon', enabled: false },
      { key: 'advantages', title: '', enabled: true },
    ];
    const s = parseSettings([{ key: 'home_sections', value: saved }]);
    const keys = s.home_sections.map((x) => x.key);
    expect(keys.slice(0, 3)).toEqual(['hero', 'reviews', 'sale']);
    expect(s.home_sections.find((x) => x.key === 'sale')).toEqual({ key: 'sale', title: 'Arzon', enabled: false });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('kategoriyalar boʻlsa — ulardan keyin', () => {
    const s = parseSettings([{ key: 'home_sections', value: [{ key: 'hero', title: '', enabled: true }, { key: 'categories', title: '', enabled: true }, { key: 'new', title: '', enabled: true }] }]);
    expect(s.home_sections.map((x) => x.key).slice(0, 4)).toEqual(['hero', 'categories', 'reviews', 'new']);
  });

  it('“reviews” allaqachon boʻlsa (oʻchirilgan) — tegilmaydi', () => {
    const s = parseSettings([{ key: 'home_sections', value: [{ key: 'reviews', title: '', enabled: false }] }]);
    expect(s.home_sections.filter((x) => x.key === 'reviews')).toEqual([{ key: 'reviews', title: '', enabled: false }]);
  });
});
