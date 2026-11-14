'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Copy, Crown, Gift, Hourglass, Lock, Send, Users, Wallet } from 'lucide-react';
import { useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { CouponCard } from '@/components/coupon/coupon-card';
import { CopyCoupon } from '@/components/coupon/copy-coupon';
import { Modal } from '@/components/ui/dialog';
import { copyText } from '@/lib/client/copy';

import { couponCardProps } from '@/lib/coupon-design';
import { applyPartner, requestPayout, trackReferral } from '@/lib/actions/referral';
import { PAYOUT_STATUS, REFERRAL_STATUS, type ReferralStep } from '@/lib/referral';

export interface MyReferral {
  enabled: boolean;
  client_no: number | null;
  qualify_on: string;
  steps: ReferralStep[];
  welcome: { enabled: boolean; amount: number; min_order: number };
  partner_cfg: { enabled: boolean; percent: number; min_payout: number; hold_days: number };
  qualified: number;
  friends: { name: string; status: string; created_at: string; qualified_at: string | null }[];
  rewards: { step: number; amount: number; created_at: string }[];
  coupons: { id: string; code: string; description: string | null; value: number; discount_type: string; min_order_amount: number; ends_at: string | null; design: unknown; source: string; used: boolean }[];
  referred_by: { name: string } | null;
  partner: null | {
    status: string; percent: number; card: string | null;
    balance: { earned: number; holding: number; available_total: number; paid: number; requested: number };
    payouts: { amount: number; status: string; requested_at: string }[];
  };
}

const num = (v: number) => new Intl.NumberFormat('ru-RU').format(v).replace(/\s/g, ' ');
const date = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

type TgWebApp = { openTelegramLink?: (url: string) => void; initData?: string };
const tgApp = () => (typeof window !== 'undefined' ? (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp : undefined);

/** Doʻstni taklif qilish: havola, bosqichlar, kuponlar, doʻstlar va (hamkor boʻlsa) balans. */
/** Mijozga tegishli umumiy kuponlar: hammaga ochiq (hali boshlanmagani ham) va botda unga yuborilganlar. */
export interface WalletCoupon {
  id: string; code: string; description: string | null; discount_type: string; value: number; max_discount: number | null;
  min_order_amount: number; starts_at: string | null; ends_at: string | null; design: unknown; sent: boolean; used: boolean;
}

export function ReferralView({ data, link, shopName, wallet = [] }: { data: MyReferral; link: string; shopName: string; wallet?: WalletCoupon[] }) {
  const L = useL();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);

  useEffect(() => { void trackReferral('view'); }, []);

  const steps = data.steps ?? [];
  const lastFriends = steps[steps.length - 1]?.friends ?? 0;
  const next = steps.find((s) => s.friends > data.qualified);
  const welcome = data.welcome?.enabled && data.welcome.amount > 0 ? data.welcome.amount : 0;
  const shareText = welcome
    ? `${shopName}: ${L('shu havola orqali roʻyxatdan oʻting va')} ${num(welcome)} ${L('soʻmlik sovgʻa kupon oling')} 🎁`
    : `${shopName}: ${L('shu havola orqali roʻyxatdan oʻting')} 🎁`;

  const copy = async () => {
    try { if (await copyText(link)) { setCopied(true); setTimeout(() => setCopied(false), 1800); } }
    catch { toast(L('Nusxalab boʻlmadi — havolani qoʻlda belgilang'), 'error'); }
    void trackReferral('copy');
  };
  const share = async () => {
    void trackReferral('share');
    const tg = tgApp();
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
    if (tg?.initData && tg.openTelegramLink) { tg.openTelegramLink(url); return; }
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: shopName, text: shareText, url: link }); return; } catch { /* bekor qilindi */ }
    }
    window.open(url, '_blank', 'noopener');
  };

  if (!data.enabled && !data.partner) {
    return <p className="rounded-2xl border border-line bg-surface p-6 text-center text-ink-3">{L('Doʻst taklif qilish dasturi hozircha toʻxtatilgan.')}</p>;
  }

  const coupons = [...data.coupons].sort((a, b) => Number(isOff(a)) - Number(isOff(b)));
  const walletOn = wallet.filter((c) => !c.used);
  const walletUsed = wallet.filter((c) => c.used);
  const activeCount = coupons.filter((c) => !isOff(c)).length + walletOn.length;

  return (
    <div className="space-y-5">
      {/* Bosqichlar + ulashish (bitta ixcham karta) */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d4f80] to-[#0f2f52] text-white shadow-soft">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight">{L('Doʻstni taklif qilish')}</h2>
            {data.partner?.status === 'active' && <span className="flex items-center gap-1 rounded-full bg-[#ffd34d] px-2.5 py-0.5 text-xs font-semibold text-[#3a2a06]"><Crown className="size-3.5" />{L('Hamkor')}</span>}
          </div>
          <p className="mt-0.5 text-[13px] text-white/70">
            {next
              ? <>{L('Yana')} <b className="text-white">{next.friends - data.qualified}</b> {L('ta doʻst — ')}<b className="text-white">{num(next.amount)} {L('soʻm')}</b> {L('kupon')}</>
              : data.partner ? L('Barcha bosqichlar bajarildi — siz hamkorsiz!') : L('Barcha bosqichlar bajarildi!')}
          </p>
          <Ladder steps={steps} qualified={data.qualified} partnerCfg={data.partner_cfg} partnerActive={data.partner?.status === 'active'} lastFriends={lastFriends} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 px-3 py-3 sm:px-4">
          <button type="button" onClick={() => setFriendsOpen(true)} className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm font-medium text-white/90 hover:bg-white/10">
            <span className="flex -space-x-2">
              {(data.friends.length ? data.friends.slice(0, 3) : [{ name: '?' }]).map((f, i) => (
                <span key={i} className="flex size-7 items-center justify-center rounded-full border-2 border-[#163f69] bg-white text-[11px] font-semibold text-[#1d4f80]">{f.name.charAt(0).toUpperCase()}</span>
              ))}
            </span>
            <span className="truncate num">{data.friends.length} {L('doʻst')}</span>
            <ChevronRight className="size-4 shrink-0 text-white/60" />
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={copy} aria-label={L('Havolani nusxalash')} title={link}
              className="flex size-9 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/20">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
            <button type="button" onClick={share} className="flex h-9 items-center gap-1.5 rounded-full bg-[#2aa3ef] px-4 text-sm font-semibold text-white shadow-soft active:scale-95">
              <Send className="size-4" /> {L('Ulashish')}
            </button>
          </div>
        </div>
      </section>
      <p className="-mt-3 px-1 text-[12px] leading-snug text-ink-3">
        {welcome ? `${L('Doʻstingiz havolangiz orqali roʻyxatdan oʻtsa')} ${num(welcome)} ${L('soʻm sovgʻa oladi')}. ` : ''}
        {data.qualify_on === 'confirmed' ? L('Uning buyurtmasi tasdiqlangach sizga kupon beriladi.') : L('Uning buyurtmasi yetkazilgach sizga kupon beriladi.')}
        {data.referred_by && <> {L('Sizni taklif qilgan')}: <b>{data.referred_by.name}</b>.</>}
      </p>

      {/* Bosqich kuponlari (gorizontal) */}
      {steps.length > 0 && (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-primary"><Users className="size-3.5" /></span>{L('Doʻst taklifi')} · {steps.length} {L('bosqich')}</h2>
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {steps.map((s, i) => {
              const done = data.qualified >= s.friends;
              const current = !done && (i === 0 || data.qualified >= steps[i - 1].friends);
              return <StepTicket key={i} step={s} state={done ? 'done' : current ? 'current' : 'locked'} qualifyOn={data.qualify_on} />;
            })}
          </div>
        </section>
      )}

      {data.partner && <PartnerBox p={data.partner} cfg={data.partner_cfg} />}
      {!data.partner && data.partner_cfg?.enabled && steps.length > 0 && data.qualified >= lastFriends && <ApplyPartner />}

      {/* Mijozdagi barcha kuponlar: shaxsiy (doʻst taklifi, sovgʻa) + hammaga ochiq kuponlar */}
      <section>
        <h2 className="mb-2.5 flex items-baseline justify-between text-[15px] font-semibold">
          <span>{L('Kuponlarim')}</span>
          {activeCount > 0 && <span className="text-sm font-normal text-ink-3 num">{activeCount}</span>}
        </h2>
        {coupons.length + wallet.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-ink-3">{L('Hozircha kupon yoʻq. Doʻstingizni taklif qiling — birinchi kupon 1 ta doʻstdan keyin!')}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {coupons.filter((c) => !isOff(c)).map((c) => <MyCoupon key={c.id} c={c} />)}
            {walletOn.map((c) => <WalletCard key={c.id} c={c} />)}
            {coupons.filter(isOff).map((c) => <MyCoupon key={c.id} c={c} />)}
            {walletUsed.map((c) => <WalletCard key={c.id} c={c} />)}
          </div>
        )}
      </section>

      <Modal open={friendsOpen} onClose={() => setFriendsOpen(false)} title={`${L('Doʻstlarim')} · ${data.friends.length}`}>
        {data.friends.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">{L('Hali hech kim qoʻshilmadi. Havolani yuboring — birinchi doʻstingiz uchun ham kupon bor!')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.friends.map((f, i) => {
              const st = REFERRAL_STATUS[f.status];
              return (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{f.name.charAt(0).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-ink-3 num">{date(f.created_at)}</p>
                    </div>
                  </div>
                  <Badge tone={st?.tone}>{L(st?.label ?? f.status)}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function WalletCard({ c }: { c: WalletCoupon }) {
  const L = useL();
  const upcoming = Boolean(c.starts_at && new Date(c.starts_at).getTime() > Date.now());
  const note = c.used ? L('Ishlatilgan') : upcoming ? `${date(c.starts_at!)} ${L('dan amal qiladi')}` : c.description;
  return (
    <div className={cn(c.used && 'pointer-events-none opacity-50 grayscale')}>
      <CopyCoupon code={c.code} description={note} card={{ ...couponCardProps({ ...c, scope: undefined }, L('Kupon'), L), cutout: 'var(--bg)' }} />
    </div>
  );
}

const isOff = (c: MyReferral['coupons'][number]) => c.used || Boolean(c.ends_at && new Date(c.ends_at).getTime() <= Date.now());

function Ladder({ steps, qualified, partnerCfg, partnerActive, lastFriends }: { steps: ReferralStep[]; qualified: number; partnerCfg: MyReferral['partner_cfg']; partnerActive: boolean; lastFriends: number }) {
  const L = useL();
  return (
    <ol className="no-scrollbar -mx-1 mt-4 flex items-start overflow-x-auto px-1 pb-1">
      {steps.map((s, i) => {
        const done = qualified >= s.friends;
        const current = !done && (i === 0 || qualified >= steps[i - 1].friends);
        return (
          <li key={i} className="flex min-w-[64px] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done || current ? 'bg-white/70' : 'bg-white/20')} />
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition',
                done ? 'border-white bg-white text-[#1d4f80]' : current ? 'border-[#ffd34d] bg-[#ffd34d]/20 text-[#ffd34d] ring-4 ring-[#ffd34d]/20' : 'border-white/25 text-white/50')}>
                {done ? <Check className="size-5" strokeWidth={3} /> : current ? <Gift className="size-5" /> : <Lock className="size-4" />}
              </span>
              <span className={cn('h-0.5 flex-1', done ? 'bg-white/70' : 'bg-white/20')} />
            </div>
            <span className={cn('mt-1.5 text-[12px] font-semibold num', current ? 'text-[#ffd34d]' : done ? 'text-white' : 'text-white/55')}>{num(s.amount)}</span>
          </li>
        );
      })}
      {partnerCfg?.enabled && (
        <li className="flex min-w-[64px] flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center">
            <span className={cn('h-0.5 flex-1', qualified >= lastFriends ? 'bg-white/70' : 'bg-white/20')} />
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full border-2',
              partnerActive ? 'border-[#ffd34d] bg-[#ffd34d] text-[#3a2a06]' : 'border-white/25 text-white/55')}>
              <Crown className="size-5" />
            </span>
            <span className="h-0.5 flex-1 bg-transparent" />
          </div>
          <span className="mt-1.5 text-[12px] font-semibold">{L('Hamkor')}</span>
        </li>
      )}
    </ol>
  );
}

/** Bosqich chiptasi: summa, holat (olindi / navbatda / yopiq) va necha doʻst kerakligi. */
function StepTicket({ step, state, qualifyOn }: { step: ReferralStep; state: 'done' | 'current' | 'locked'; qualifyOn: string }) {
  const L = useL();
  const status = state === 'done'
    ? { icon: <Check className="size-3.5" strokeWidth={3} />, text: L('OLINDI'), cls: 'text-success' }
    : state === 'current'
      ? { icon: <Hourglass className="size-3.5" />, text: L('NAVBATDA'), cls: 'text-ink' }
      : { icon: <Lock className="size-3.5" />, text: L('YOPIQ'), cls: 'text-ink-3' };
  return (
    <div className={cn('flex w-[82%] max-w-[340px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface shadow-soft sm:w-[320px]', state === 'locked' && 'opacity-60')}>
      <div className="relative flex w-[46%] flex-col items-center justify-center bg-surface-2 px-2 py-3 text-center">
        <span className={cn('text-[26px] font-bold leading-none tracking-tight num', state === 'locked' ? 'text-ink-3' : 'text-ink')}>{num(step.amount)}</span>
        <span className="mt-1 text-xs text-ink-3">{L('soʻm')}</span>
        <span className="my-2 w-full border-t border-dashed border-line-strong" />
        <span className={cn('flex items-center gap-1 text-[11px] font-bold tracking-wide', status.cls)}>{status.icon}{status.text}</span>
        <span className="absolute -right-2 -top-2 size-4 rounded-full bg-[var(--bg)]" />
        <span className="absolute -bottom-2 -right-2 size-4 rounded-full bg-[var(--bg)]" />
      </div>
      <div className="flex flex-1 flex-col items-end justify-center gap-2 p-3 text-right">
        <span className="flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-bg">
          <span className="flex size-4 items-center justify-center rounded-full bg-bg text-[10px] text-ink num">{step.friends}</span>{L('DOʻST')}
        </span>
        <span className="text-[12px] leading-snug text-ink-2">
          {qualifyOn === 'confirmed' ? L('Doʻst buyurtmasi tasdiqlansa ochiladi') : L('Doʻst buyurtmasi yetkazilsa ochiladi')}
        </span>
        {step.min_order > 0 && <span className="text-[11px] text-ink-3 num">{L('Min. buyurtma')} {num(step.min_order)}</span>}
      </div>
    </div>
  );
}

function MyCoupon({ c }: { c: MyReferral['coupons'][number] }) {
  const L = useL();
  const [copied, setCopied] = useState(false);
  const expired = Boolean(c.ends_at && new Date(c.ends_at).getTime() <= Date.now());
  const off = c.used || expired;
  const card = couponCardProps({ discount_type: c.discount_type, value: c.value, ends_at: c.ends_at, min_order_amount: c.min_order_amount, design: c.design }, L('Kupon'), L);
  const copy = async () => {
    await copyText(c.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className={cn(off && 'opacity-50 grayscale')}>
      <button type="button" disabled={off} onClick={copy} className="block w-full text-left transition-transform active:scale-[0.99]">
        <CouponCard {...card} action={c.used ? L('Ishlatilgan') : expired ? L('Muddati oʻtgan') : copied ? L('Nusxalandi') : L('Kodni olish')} />
      </button>
      <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[13px]">
        <span className="truncate text-ink-3">{c.description ?? ''}{c.ends_at && !off ? ` · ${date(c.ends_at)} ${L('gacha')}` : ''}</span>
        <span className="shrink-0 rounded-lg border border-dashed border-line-strong px-2 py-0.5 font-mono font-bold">{c.code}</span>
      </div>
    </div>
  );
}

function ApplyPartner() {
  const L = useL();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ffd34d]/60 bg-[#ffd34d]/10 p-4">
      <div className="flex items-center gap-3">
        <Crown className="size-6 text-[#b88a00]" />
        <div>
          <p className="font-semibold">{L('Hamkor boʻling')}</p>
          <p className="text-[13px] text-ink-2">{L('Doʻstlaringiz har bir xaridi uchun foiz oling')}</p>
        </div>
      </div>
      <Button loading={pending} onClick={() => start(async () => {
        const r = await applyPartner();
        toast(r.ok ? L(r.message ?? '') : L(r.error), r.ok ? 'success' : 'error');
        if (r.ok) router.refresh();
      })}>{L('Ariza berish')}</Button>
    </section>
  );
}

function PartnerBox({ p, cfg }: { p: NonNullable<MyReferral['partner']>; cfg: MyReferral['partner_cfg'] }) {
  const L = useL();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const free = Math.max(p.balance.available_total - p.balance.paid - p.balance.requested, 0);
  const [amount, setAmount] = useState(String(free || ''));
  const [card, setCard] = useState(p.card ?? '');
  const waiting = p.payouts.some((x) => x.status === 'requested');

  if (p.status === 'pending') {
    return <section className="rounded-2xl border border-line bg-surface p-4 text-sm"><b>{L('Hamkorlik arizangiz koʻrib chiqilmoqda.')}</b> {L('Javobni shu yerda va botda koʻrasiz.')}</section>;
  }
  if (p.status === 'rejected') return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold"><Crown className="size-5 text-[#b88a00]" /> {L('Hamkor hisobi')}</h2>
        <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status === 'active' ? `${Number(p.percent)}%` : L('Muzlatilgan')}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: L('Yechish mumkin'), value: free, strong: true },
          { label: L('Tekshiruvda'), value: p.balance.holding },
          { label: L('Toʻlangan'), value: p.balance.paid },
        ].map((x) => (
          <div key={x.label} className="rounded-xl bg-surface-2 p-3">
            <p className="text-[11px] text-ink-3">{x.label}</p>
            <p className={cn('mt-1 font-semibold num', x.strong ? 'text-lg text-success' : 'text-[15px]')}>{num(x.value)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">{L('Doʻstlaringiz buyurtmasi yetkazilgach foiz hisoblanadi va')} {cfg.hold_days} {L('kundan keyin yechish mumkin boʻladi.')}</p>

      {p.status === 'active' && (
        waiting ? (
          <p className="mt-4 rounded-xl bg-warn-soft p-3 text-sm text-warn">{L('Pul yechish soʻrovingiz koʻrib chiqilmoqda.')}</p>
        ) : free >= (cfg.min_payout || 1) ? (
          <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <Field label={L('Summa (soʻm)')}><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label={L('Karta raqami')}><Input inputMode="numeric" autoComplete="cc-number" value={card} placeholder="8600 0000 0000 0000"
              onChange={(e) => setCard(e.target.value.replace(/[^\d ]/g, '').slice(0, 23))} /></Field>
            <Button loading={pending} className="h-11" onClick={() => start(async () => {
              const r = await requestPayout({ amount: Number(amount), card });
              toast(r.ok ? L(r.message ?? '') : L(r.error), r.ok ? 'success' : 'error');
              if (r.ok) router.refresh();
            })}><Wallet className="size-4" /> {L('Yechib olish')}</Button>
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-ink-3">{L('Minimal yechish summasi')}: <b className="num">{num(cfg.min_payout)} {L('soʻm')}</b></p>
        )
      )}

      {p.payouts.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
          {p.payouts.map((x, i) => {
            const st = PAYOUT_STATUS[x.status];
            return (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="text-ink-3 num">{date(x.requested_at)}</span>
                <span className="font-semibold num">{num(x.amount)} {L('soʻm')}</span>
                <Badge tone={st?.tone}>{L(st?.label ?? x.status)}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
