'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Crown, Gift, Lock, Send, Users, Wallet } from 'lucide-react';
import { useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { CouponCard } from '@/components/coupon/coupon-card';
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
export function ReferralView({ data, link, shopName }: { data: MyReferral; link: string; shopName: string }) {
  const L = useL();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => { void trackReferral('view'); }, []);

  const steps = data.steps ?? [];
  const lastFriends = steps[steps.length - 1]?.friends ?? 0;
  const next = steps.find((s) => s.friends > data.qualified);
  const welcome = data.welcome?.enabled && data.welcome.amount > 0 ? data.welcome.amount : 0;
  const shareText = welcome
    ? `${shopName}: ${L('shu havola orqali roʻyxatdan oʻting va')} ${num(welcome)} ${L('soʻmlik sovgʻa kupon oling')} 🎁`
    : `${shopName}: ${L('shu havola orqali roʻyxatdan oʻting')} 🎁`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
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

  return (
    <div className="space-y-5">
      {/* Bosqichlar */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d4f80] to-[#0f2f52] p-5 text-white shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{L('Doʻstlaringizni taklif qiling')}</h2>
            <p className="mt-1 text-sm text-white/75">
              {next
                ? <>{L('Yana')} <b className="text-white">{next.friends - data.qualified}</b> {L('ta doʻst — ')}<b className="text-white">{num(next.amount)} {L('soʻm')}</b> {L('kupon')}</>
                : data.partner ? L('Barcha bosqichlar bajarildi — siz hamkorsiz!') : L('Barcha bosqichlar bajarildi!')}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold num"><Users className="size-4" />{data.qualified}</span>
        </div>
        <ol className="no-scrollbar -mx-1 mt-5 flex items-start overflow-x-auto px-1 pb-1">
          {steps.map((s, i) => {
            const done = data.qualified >= s.friends;
            const current = !done && (i === 0 || data.qualified >= steps[i - 1].friends);
            return (
              <li key={i} className="flex min-w-[76px] flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done || current ? 'bg-white/70' : 'bg-white/20')} />
                  <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition',
                    done ? 'border-white bg-white text-[#1d4f80]' : current ? 'border-[#ffd34d] bg-[#ffd34d]/20 text-[#ffd34d] ring-4 ring-[#ffd34d]/20' : 'border-white/25 text-white/50')}>
                    {done ? <Check className="size-5" strokeWidth={3} /> : current ? <Gift className="size-5" /> : <Lock className="size-4" />}
                  </span>
                  <span className={cn('h-0.5 flex-1', done ? 'bg-white/70' : 'bg-white/20')} />
                </div>
                <span className={cn('mt-2 text-[13px] font-semibold num', done || current ? 'text-white' : 'text-white/55')}>{num(s.amount)}</span>
                <span className="text-[11px] text-white/60 num">{s.friends} {L('doʻst')}</span>
              </li>
            );
          })}
          {data.partner_cfg?.enabled && (
            <li className="flex min-w-[76px] flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={cn('h-0.5 flex-1', data.qualified >= lastFriends ? 'bg-white/70' : 'bg-white/20')} />
                <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full border-2',
                  data.partner?.status === 'active' ? 'border-[#ffd34d] bg-[#ffd34d] text-[#3a2a06]' : 'border-white/25 text-white/55')}>
                  <Crown className="size-5" />
                </span>
                <span className="h-0.5 flex-1 bg-transparent" />
              </div>
              <span className="mt-2 text-[13px] font-semibold">{L('Hamkor')}</span>
              <span className="text-[11px] text-white/60 num">{data.partner_cfg.percent}%</span>
            </li>
          )}
        </ol>
      </section>

      {/* Havola */}
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
        <p className="text-sm font-semibold">{L('Sizning havolangiz')}</p>
        <div className="mt-2 flex items-center gap-2">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={L('Sizning havolangiz')}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 font-mono text-[13px] text-ink-2" />
          <Button variant="outline" onClick={copy} aria-label={L('Nusxalash')} className="h-11 shrink-0">
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}<span className="max-sm:hidden">{copied ? L('Nusxalandi') : L('Nusxalash')}</span>
          </Button>
        </div>
        <Button className="mt-3 h-11 w-full" onClick={share}><Send className="size-4" /> {L('Doʻstga yuborish')}</Button>
        <ol className="mt-4 grid gap-2 text-[13px] text-ink-2 sm:grid-cols-3">
          <li className="rounded-xl bg-surface-2 p-3"><b className="text-ink">1.</b> {L('Havolani doʻstingizga yuboring')}</li>
          <li className="rounded-xl bg-surface-2 p-3"><b className="text-ink">2.</b> {welcome ? `${L('Doʻstingiz roʻyxatdan oʻtadi va')} ${num(welcome)} ${L('soʻm sovgʻa oladi')}` : L('Doʻstingiz havola orqali roʻyxatdan oʻtadi')}</li>
          <li className="rounded-xl bg-surface-2 p-3"><b className="text-ink">3.</b> {data.qualify_on === 'confirmed' ? L('Buyurtmasi tasdiqlangach sizga kupon beriladi') : L('Buyurtmasi yetkazilgach sizga kupon beriladi')}</li>
        </ol>
        {data.referred_by && <p className="mt-3 text-xs text-ink-3">{L('Sizni taklif qilgan')}: <b>{data.referred_by.name}</b></p>}
      </section>

      {/* Kuponlar */}
      {data.coupons.length > 0 && (
        <section>
          <h2 className="mb-3 text-[17px] font-semibold">{L('Kuponlarim')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.coupons.map((c) => <MyCoupon key={c.id} c={c} />)}
          </div>
        </section>
      )}

      {data.partner && <PartnerBox p={data.partner} cfg={data.partner_cfg} />}
      {!data.partner && data.partner_cfg?.enabled && steps.length > 0 && data.qualified >= lastFriends && <ApplyPartner />}

      {/* Doʻstlar */}
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">{L('Doʻstlarim')}</h2>
          <span className="text-sm text-ink-3 num">{data.friends.length}</span>
        </div>
        {data.friends.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">{L('Hali hech kim qoʻshilmadi. Havolani yuboring — birinchi doʻstingiz uchun ham kupon bor!')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
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
      </section>
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
    try { await navigator.clipboard.writeText(c.code); } catch { /* kod koʻrinib turadi */ }
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
