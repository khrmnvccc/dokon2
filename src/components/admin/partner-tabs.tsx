import Link from 'next/link';
import { cn } from '@/components/ui/cn';

const TABS = [
  { href: '/admin/partners', label: 'Hamkorlar', key: 'partners' },
  { href: '/admin/partners/attribution', label: 'Atributsiya', key: 'attribution' },
  { href: '/admin/partners/applications', label: 'Arizalar', key: 'applications' },
  { href: '/admin/partners/earnings', label: 'Hisoblar', key: 'earnings' },
  { href: '/admin/partners/payouts', label: 'Yechimlar', key: 'payouts' },
  { href: '/admin/partners/rules', label: 'Qoidalar', key: 'rules' },
] as const;

/** Marketing → Hamkorlar boʻlimining ichki tablari. counts — kutilayotgan ishlar soni (nuqta bilan). */
export function PartnerTabs({ active, counts = {} }: { active: (typeof TABS)[number]['key']; counts?: Partial<Record<(typeof TABS)[number]['key'], number>> }) {
  return (
    <nav className="no-scrollbar mb-5 flex gap-5 overflow-x-auto border-b border-line" aria-label="Hamkorlar boʻlimi">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.key === active ? 'page' : undefined}
          className={cn('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-[15px] font-semibold transition-colors',
            t.key === active ? 'border-[#1d4f80] text-[#1d4f80] dark:border-white dark:text-white' : 'border-transparent text-ink-3 hover:text-ink-2')}>
          {t.label}
          {(counts[t.key] ?? 0) > 0 && <span className="rounded-full bg-warn px-1.5 text-[11px] font-bold leading-[18px] text-white num">{counts[t.key]}</span>}
        </Link>
      ))}
    </nav>
  );
}
