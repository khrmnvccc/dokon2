import Link from 'next/link';
import { cn } from '@/components/ui/cn';

const TABS = [
  { href: '/admin/promotions', label: 'Aksiyalar' },
  { href: '/admin/coupons', label: 'Promo-kodlar' },
  { href: '/admin/coupons/issued', label: 'Berilgan kuponlar' },
  { href: '/admin/coupons/used', label: 'Ishlatilganlar' },
] as const;

/** Aksiyalar boʻlimining ichki tablari (videodagi “Aksiyalar · Berilgan kuponlar · Dizaynlar”). */
export function DiscountTabs({ active }: { active: (typeof TABS)[number]['href'] }) {
  return (
    <nav className="mb-5 flex gap-6 border-b border-line" aria-label="Aksiyalar boʻlimi">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === active ? 'page' : undefined}
          className={cn('-mb-px border-b-2 pb-2.5 text-[15px] font-semibold transition-colors',
            t.href === active ? 'border-[#1d4f80] text-[#1d4f80] dark:border-white dark:text-white' : 'border-transparent text-ink-3 hover:text-ink-2')}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
