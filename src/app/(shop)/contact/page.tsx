import { Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { CmsPageView, cmsMetadata } from '@/components/shop/cms-page';
import { getSettings } from '@/lib/data/public';
import { SITE_URL } from '@/lib/env';

export const generateMetadata = () => cmsMetadata('contact');

export default async function ContactPage() {
  const { contact, social, store } = await getSettings();
  const rows = [
    contact.phone && { icon: Phone, label: 'Telefon', value: contact.phone, href: `tel:${contact.phone.replace(/\s/g, '')}` },
    contact.phone2 && { icon: Phone, label: 'Qo‘shimcha telefon', value: contact.phone2, href: `tel:${contact.phone2.replace(/\s/g, '')}` },
    contact.email && { icon: Mail, label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
    social.telegram && { icon: Send, label: 'Telegram', value: social.telegram.replace(/^https?:\/\//, ''), href: social.telegram },
    contact.address && { icon: MapPin, label: 'Manzil', value: contact.address, href: contact.map_url ?? undefined },
    contact.working_hours && { icon: Clock, label: 'Ish vaqti', value: contact.working_hours },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store.name,
    url: SITE_URL,
    telephone: contact.phone || undefined,
    email: contact.email || undefined,
    address: contact.address || undefined,
    openingHours: contact.working_hours || undefined,
  };

  return (
    <>
      <CmsPageView
        slug="contact"
        aside={
          <aside className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
            <h2 className="mb-4 font-bold">Bog‘lanish</h2>
            <ul className="space-y-4">
              {rows.map(({ icon: Icon, label, value, href }) => (
                <li key={label} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">{label}</span>
                    {href ? <a href={href} className="break-words font-medium hover:text-brand" target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{value}</a> : <span className="font-medium">{value}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        }
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </>
  );
}
