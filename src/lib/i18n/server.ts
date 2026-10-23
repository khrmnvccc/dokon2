import 'server-only';
import { cookies } from 'next/headers';
import { getSettings } from '@/lib/data/public';
import { LANGS, translate, type Lang, type TKey } from './dict';

export async function getLang(): Promise<Lang> {
  const settings = await getSettings();
  const enabled = settings.localization.languages;
  const fromCookie = (await cookies()).get('lang')?.value as Lang | undefined;
  if (fromCookie && LANGS.includes(fromCookie) && enabled.includes(fromCookie)) return fromCookie;
  return settings.localization.default_language;
}

export async function getT() {
  const lang = await getLang();
  return (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
