import 'server-only';
import { currentLang } from '@/lib/data/public';
import { translate, type TKey } from './dict';
import { tr } from './ui-ru';

export const getLang = currentLang;

export async function getT() {
  const lang = await getLang();
  return (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

/** Server komponentlar uchun: const L = await getL(); L('Bosh sahifa') */
export async function getL() {
  const lang = await getLang();
  return (s: string) => tr(lang, s);
}
