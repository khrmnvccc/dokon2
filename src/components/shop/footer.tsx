import Link from 'next/link';
import { Mail, MapPin, Phone, Clock } from 'lucide-react';
import type { SiteSettings } from '@/lib/settings-schema';
import { Logo } from '@/components/brand';

const socialLabels: Record<string, string> = { telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok' };

export function Footer({ settings, t }: { settings: SiteSettings; t: (k: 'footer.contacts' | 'footer.social' | 'footer.hours') => string }) {
  const { contact, social, footer } = settings;
  const socials = Object.entries(social).filter(([, url]) => url) as [string, string][];
  const link = 'text-ink-2 transition-colors hover:text-ink';
  return (
    <footer className="no-print mt-12 border-t border-line bg-surface glass pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo />
          {footer.about_text && <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-ink-3">{footer.about_text}</p>}
          <Link href="/help" className="mt-3 inline-flex h-8 items-center rounded-lg bg-primary-soft px-3 text-[13px] font-semibold text-primary">Yordam markazi</Link>
          {socials.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{t('footer.social')}</div>
              <div className="flex flex-wrap gap-2">
                {socials.map(([key, url]) => (
                  <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink shadow-soft hover:bg-surface-2">
                    {socialLabels[key] ?? key}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        {footer.columns.map((col) => (
          <div key={col.title}>
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{col.title}</div>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href + l.label}><Link href={l.href} className={link}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{t('footer.contacts')}</div>
          <ul className="space-y-2.5 text-sm text-ink-2">
            {contact.phone && <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /><a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className={`${link} num`}>{contact.phone}</a></li>}
            {contact.email && <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /><a href={`mailto:${contact.email}`} className={link}>{contact.email}</a></li>}
            {contact.address && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />{contact.address}</li>}
            {contact.working_hours && <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />{contact.working_hours}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-3">{footer.copyright}</div>
      </div>
    </footer>
  );
}
