'use client';

import Link from 'next/link';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, ChevronRight, CircleHelp, Coins, Globe, Handshake, Headset, LayoutDashboard, LogOut, MapPin, Megaphone, Package, Wallet, type LucideIcon } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Toggle } from '@/components/ui/kit';
import { Modal } from '@/components/ui/dialog';
import { cn } from '@/components/ui/cn';
import { logout } from '@/lib/actions/auth';
import { setMyPrefs } from '@/lib/actions/shop';
import { SizeBlock } from './size-block';

const LANG_NAMES: Record<string, string> = { uz: 'Oʻzbekcha', ru: 'Русский', zh: '中文' };

interface Props {
  name: string; clientNo: number | null; avatar: string | null; partner: boolean;
  wallet: number; friends: number; goal: number; referralOn: boolean;
  notifyOrders: boolean; notifyPromo: boolean; languages: string[]; isStaff: boolean;
  /** Xitoydan buyurtma xizmati nomi (oʻchiq — null) va bonus balansi (oʻchiq — null) */
  importTitle: string | null; bonus: number | null;
}

/** Telegram ilovasidagi kabi profil: yuqorida koʻk karta, pastda bitta roʻyxat. */
export function ProfileHome(p: Props) {
  const L = useL();
  const { lang, price } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [orders, setOrders] = useState(p.notifyOrders);
  const [promo, setPromo] = useState(p.notifyPromo);
  const [langOpen, setLangOpen] = useState(false);
  const [, start] = useTransition();

  const savePref = (key: 'notify_orders' | 'notify_promo', v: boolean, set: (v: boolean) => void) => {
    set(v);
    start(async () => {
      const res = await setMyPrefs({ [key]: v });
      if (!res.ok) { set(!v); toast(res.error ?? L('Saqlab boʻlmadi'), 'error'); }
    });
  };
  const pct = Math.min(1, p.goal ? p.friends / p.goal : 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Karta */}
      <SizeBlock id="profile.card" label="Profil kartasi">
      <section className="relative overflow-hidden rounded-[28px] p-4 text-white shadow-pop sm:p-5"
        style={{ background: 'linear-gradient(140deg, color-mix(in srgb, var(--primary) 70%, #0b1f3a), color-mix(in srgb, var(--primary) 30%, #071426))' }}>
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full opacity-[0.13]" viewBox="0 0 400 220" preserveAspectRatio="none">
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M-20 ${30 + i * 14} C 90 ${-10 + i * 16}, 220 ${90 + i * 10}, 420 ${10 + i * 15}`} fill="none" stroke="white" strokeWidth="1" />
          ))}
        </svg>
        <Link href="/account/profile" className="relative flex items-center gap-3.5">
          <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-white/15 text-2xl font-semibold">
            {p.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatar} alt="" className="size-full object-cover" />
            ) : p.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[19px] font-semibold tracking-tight">{p.name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {p.clientNo != null && <span className="num rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-semibold">ID {p.clientNo}</span>}
              {p.partner && <span className="inline-flex items-center gap-1 rounded-full border border-white/30 px-2.5 py-0.5 text-[12px] font-semibold"><Handshake className="size-3.5" /> {L('Hamkor')}</span>}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 opacity-70" />
        </Link>
        <div className="relative mt-4 grid grid-cols-2 gap-2.5">
          <Link href="/account/referral" className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur transition hover:bg-white/15">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-[color-mix(in_srgb,var(--primary)_70%,#0b1f3a)]"><Wallet className="size-5" /></span>
            <span className="min-w-0">
              <span className="block text-[13px] opacity-80">{L('Hamyon')}</span>
              <span className="num block truncate text-[17px] font-bold">{price(p.wallet)}</span>
            </span>
          </Link>
          <Link href="/account/referral" className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur transition hover:bg-white/15">
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[color-mix(in_srgb,var(--primary)_70%,#0b1f3a)]"
              style={{ background: `conic-gradient(var(--primary) ${pct * 360}deg, white 0)` }}>
              <span className="num flex size-9 items-center justify-center rounded-full bg-white">{p.friends}/{p.goal}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] opacity-80">{L('Taklif')}</span>
              <span className="block truncate text-[17px] font-bold">{L('Doʻstlar')}</span>
            </span>
          </Link>
        </div>
      </section>
      </SizeBlock>

      {/* Roʻyxat */}
      <SizeBlock id="profile.menu" label="Menyu">
      <ul className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-soft">
        <Row href="/account/addresses" icon={MapPin} title={L('Mening manzillarim')} sub={L('Yetkazish manzillaringiz')} />
        <Row href="/account/orders" icon={Package} title={L('Mening buyurtmalarim')} sub={L('Barcha buyurtmalar tarixi')} />
        {p.importTitle && <Row href="/account/requests" icon={Globe} tone="orange" title={L(p.importTitle)} sub={L('Havola yoki rasm yuboring — narxini aytamiz')} />}
        {p.bonus !== null && <Row href="/account/bonus" icon={Coins} tone="amber" title={L('Bonuslarim')} sub={L('Keshbek va bonus ballar')} end={<span className="num text-[15px] font-semibold text-ink-2">{price(p.bonus)}</span>} />}
        {p.languages.length > 1 && (
          <Row icon={Globe} title={L('Til')} onClick={() => setLangOpen(true)} end={<span className="text-[15px] font-medium text-ink-3">{LANG_NAMES[lang] ?? lang}</span>} />
        )}
        <Row icon={Bell} title={L('Bildirishnomalar')} sub={L('Buyurtma holati Telegramga')}
          end={<Toggle checked={orders} onChange={(v) => savePref('notify_orders', v, setOrders)} label={L('Bildirishnomalar')} />} />
        <Row icon={Megaphone} title={L('Aksiya va kuponlar')} sub={L('Aksiya bildirishnomalari')}
          end={<Toggle checked={promo} onChange={(v) => savePref('notify_promo', v, setPromo)} label={L('Aksiya va kuponlar')} />} />
        <Row href="/help" icon={Headset} tone="green" title={L('Yordam markazi')} />
        <Row href="/faq" icon={CircleHelp} tone="purple" title={L('Savol-javob')} />
        {p.isStaff && <Row href="/admin" icon={LayoutDashboard} title={L('Admin panel')} />}
      </ul>
      </SizeBlock>

      <form action={logout}>
        <button className="flex w-full items-center justify-center gap-2 rounded-[24px] border border-danger/20 bg-surface py-4 text-[15px] font-semibold text-danger shadow-soft transition hover:bg-danger-soft">
          <LogOut className="size-5" /> {L('Chiqish')}
        </button>
      </form>

      <Modal open={langOpen} onClose={() => setLangOpen(false)} title={L('Til')}>
        <ul className="space-y-1.5">
          {p.languages.map((l) => (
            <li key={l}>
              <button type="button" onClick={() => { document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`; setLangOpen(false); router.refresh(); }}
                className={cn('flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-[15px] font-medium', l === lang ? 'bg-primary-soft text-primary' : 'hover:bg-surface-2')}>
                {LANG_NAMES[l] ?? l}{l === lang && <Check className="size-5" />}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

const TONES = { orange: 'bg-[color-mix(in_srgb,#e2552b_14%,transparent)] text-[#e2552b]', amber: 'bg-[color-mix(in_srgb,#f59e0b_16%,transparent)] text-[#d97706]', default: 'bg-surface-2 text-[color-mix(in_srgb,var(--primary)_70%,#0b1f3a)] dark:text-primary', green: 'bg-success-soft text-success', purple: 'bg-[color-mix(in_srgb,#8a3ffc_14%,transparent)] text-[#8a3ffc]' } as const;

function Row({ href, onClick, icon: Icon, title, sub, end, tone = 'default' }: {
  href?: string; onClick?: () => void; icon: LucideIcon; title: string; sub?: string; end?: ReactNode; tone?: keyof typeof TONES;
}) {
  const inner = (
    <>
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', TONES[tone])}><Icon className="size-[22px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold tracking-tight">{title}</span>
        {sub && <span className="block truncate text-[13px] text-ink-3">{sub}</span>}
      </span>
      {end ?? <ChevronRight className="size-5 shrink-0 text-ink-3" />}
    </>
  );
  const cls = 'flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors';
  return (
    <li className="border-t border-line first:border-t-0 [&:first-child>*]:pt-3.5">
      {href ? <Link href={href} className={cn(cls, 'hover:bg-surface-2')}>{inner}</Link>
        : onClick ? <button type="button" onClick={onClick} className={cn(cls, 'hover:bg-surface-2')}>{inner}</button>
        : <div className={cls}>{inner}</div>}
    </li>
  );
}
