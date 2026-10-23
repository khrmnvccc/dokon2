import type { MetadataRoute } from 'next';
import { SITE_URL, isSupabaseConfigured } from '@/lib/env';
import { getPublicSupabase } from '@/lib/supabase/server';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages = ['', '/catalog', '/sale', '/about', '/delivery', '/contact', '/faq', '/privacy', '/terms', '/track'].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: now,
    changeFrequency: p === '' || p === '/catalog' || p === '/sale' ? ('daily' as const) : ('monthly' as const),
    priority: p === '' ? 1 : p === '/catalog' ? 0.9 : 0.5,
  }));
  if (!isSupabaseConfigured) return staticPages;

  const supabase = getPublicSupabase();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from('categories').select('slug, updated_at').eq('is_active', true),
    supabase.from('products').select('slug, updated_at').eq('is_active', true).order('updated_at', { ascending: false }).limit(45000),
  ]);
  return [
    ...staticPages,
    ...(categories ?? []).map((c) => ({ url: `${SITE_URL}/category/${c.slug}`, lastModified: new Date(c.updated_at), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...(products ?? []).map((p) => ({ url: `${SITE_URL}/product/${p.slug}`, lastModified: new Date(p.updated_at), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
