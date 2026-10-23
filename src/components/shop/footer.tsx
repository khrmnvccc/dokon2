import Link from 'next/link';
import { Mail, MapPin, Phone, Clock } from 'lucide-react';
import type { SiteSettings } from '@/lib/settings-schema';

const socialLabels: Record<string, string> = { telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok' };

export function Footer({ settings, t }: { settings: SiteSettings; t: (k: 'footer.contacts' | 'footer.social' | 'footer.hours') => string }) {
  const { store, contact, social, footer } = settings;
  const socials = Object.entries(social).filter(([, url]) => url) as [string, string][];
  return (
    <footer className="mt-12 bg-slate-900 pb-20 text-slate-300 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="text-xl font-extrabold text-white">{store.name}</div>
          {footer.about_text && <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">{footer.about_text}</p>}
          {socials.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('footer.social')}</div>
              <div className="flex flex-wrap gap-2">
                {socials.map(([key, url]) => (
                  <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20">
                    {socialLabels[key] ?? key}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        {footer.columns.map((col) => (
          <div key={col.title}>
            <div className="mb-3 text-sm font-semibold text-white">{col.title}</div>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href + l.label}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <div className="mb-3 text-sm font-semibold text-white">{t('footer.contacts')}</div>
          <ul className="space-y-2.5 text-sm">
            {contact.phone && <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="hover:text-white">{contact.phone}</a></li>}
            {contact.email && <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a></li>}
            {contact.address && <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{contact.address}</li>}
            {contact.working_hours && <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{contact.working_hours}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-slate-500">{footer.copyright}</div>
      </div>
    </footer>
  );
}
