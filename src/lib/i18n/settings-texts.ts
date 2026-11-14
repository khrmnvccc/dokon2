import type { SiteSettings } from '@/lib/settings-schema';

// Sayt sozlamalaridagi tarjima qilinadigan matnlar roʻyxati: yoʻli (masalan “footer.columns.0.title”),
// nomi, oʻzbekchasi va saqlangan ruschasi. Boʻsh oʻzbekcha matnlar koʻrsatilmaydi.

export interface SettingText { path: string; label: string; uz: string; ru: string; long?: boolean }

const SECTION_LABELS: Record<string, string> = {
  announcement: 'Eʼlon qatori', store: 'Doʻkon', brand: 'Brend', header_menu: 'Yuqori menyu', footer: 'Pastki qism (footer)',
  advantages: 'Afzalliklar', home_sections: 'Bosh sahifa boʻlimlari', contact: 'Aloqa', seo: 'SEO (qidiruv tizimlari)',
  maintenance: 'Texnik ishlar', checkout: 'Rasmiylashtirish',
};
export const settingKeyLabel = (path: string) => SECTION_LABELS[path.split('.')[0]] ?? path;

export function settingsTexts(s: SiteSettings): SettingText[] {
  const ru = s.translations?.ru ?? {};
  const out: SettingText[] = [];
  const add = (path: string, label: string, uz: string | null | undefined, long = false) => {
    if (uz && uz.trim()) out.push({ path, label, uz, ru: ru[path] ?? '', long });
  };
  add('announcement.text', 'Eʼlon matni', s.announcement.text);
  add('brand.tagline', 'Shior (nom ostidagi yozuv)', s.brand.tagline);
  add('store.tagline', 'Doʻkon shiori', s.store.tagline);
  s.header_menu.forEach((l, i) => add(`header_menu.${i}.label`, `Menyu: ${l.label}`, l.label));
  s.home_sections.forEach((h, i) => add(`home_sections.${i}.title`, `Boʻlim sarlavhasi`, h.title));
  s.advantages.forEach((a, i) => { add(`advantages.${i}.title`, `Afzallik ${i + 1}: sarlavha`, a.title); add(`advantages.${i}.text`, `Afzallik ${i + 1}: matn`, a.text); });
  add('footer.about_text', 'Doʻkon haqida qisqa matn', s.footer.about_text, true);
  s.footer.columns.forEach((c, i) => {
    add(`footer.columns.${i}.title`, `Ustun ${i + 1}: sarlavha`, c.title);
    c.links.forEach((l, j) => add(`footer.columns.${i}.links.${j}.label`, `Ustun ${i + 1}: havola`, l.label));
  });
  add('footer.copyright', 'Mualliflik huquqi qatori', s.footer.copyright);
  add('contact.address', 'Manzil', s.contact.address);
  add('contact.working_hours', 'Ish vaqti', s.contact.working_hours);
  add('checkout.order_note', 'Rasmiylashtirishdagi eslatma', s.checkout.order_note, true);
  add('seo.title', 'Sayt sarlavhasi (Google)', s.seo.title);
  add('seo.description', 'Sayt tavsifi (Google)', s.seo.description, true);
  add('maintenance.message', 'Texnik ishlar xabari', s.maintenance.message, true);
  return out;
}
