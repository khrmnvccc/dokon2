'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Check, ChevronRight, CircleHelp, Copy, CreditCard, Flag, Phone, Play, Send, Warehouse, type LucideIcon } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { Modal } from '@/components/ui/dialog';
import { cn } from '@/components/ui/cn';
import { copyText } from '@/lib/client/copy';
import type { SiteSettings } from '@/lib/settings-schema';

type Help = SiteSettings['help_center'];
type TgWebApp = { openTelegramLink?: (url: string) => void; initData?: string };

/** Telegram ichida (mini-ilova) boʻlsa — chatni Telegramning oʻzida ochadi. */
function openTg(url: string) {
  const tg = (window as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  if (tg?.initData && tg.openTelegramLink) { tg.openTelegramLink(url); return; }
  window.open(url, '_blank', 'noopener');
}

/** YouTube havolasi → embed; boshqasi — oddiy video fayl. */
function embedOf(url: string): { kind: 'iframe' | 'video'; src: string } {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0` };
  return { kind: 'video', src: url };
}

export function SupportCard({ help, bot }: { help: Help; bot: string | null }) {
  const L = useL();
  if (!bot) return null;
  const url = `https://t.me/${bot}?start=support`;
  return (
    <section className="rounded-[28px] border border-line bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-3.5">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[#2a9fd8] text-white shadow-soft"><Send className="size-8 -translate-x-0.5" fill="currentColor" /></span>
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold tracking-tight">{L(help.support_title)}</h2>
          {help.status && <p className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold text-success"><span className="size-2 rounded-full bg-success" />{L(help.status)}</p>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-surface-2 px-4 py-3"><div className="text-[20px] font-bold tracking-tight">{help.reply_time || '—'}</div><div className="text-[13px] text-ink-3">{L('Oʻrtacha javob')}</div></div>
        <div className="rounded-2xl bg-surface-2 px-4 py-3"><div className="text-[20px] font-bold tracking-tight">{help.hours || '—'}</div><div className="text-[13px] text-ink-3">{L('Ish vaqti')}</div></div>
      </div>
      <button type="button" onClick={() => openTg(url)}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2a9fd8] text-[17px] font-semibold text-white shadow-[0_12px_28px_-12px_#2a9fd8] transition active:scale-[0.99]">
        <Send className="size-5" fill="currentColor" /> {L('Telegramʼda yozish')}
      </button>
      <p className="mt-2.5 text-center text-[13px] text-ink-3">@{bot}</p>
    </section>
  );
}

export function TourRow() {
  const L = useL();
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.push('/?tour=1')}
      className="flex w-full items-center gap-3.5 rounded-[24px] border border-line bg-surface p-4 text-left shadow-soft transition hover:bg-surface-2">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-primary"><Flag className="size-[22px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold tracking-tight">{L('Ilova bilan tanishish')}</span>
        <span className="block text-[13px] text-ink-3">{L('Bosh sahifadagi boʻlimlar — 1 daqiqada')}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-3" />
    </button>
  );
}

type TopicKey = 'order' | 'payment' | 'address' | 'other';
interface Topic { key: TopicKey; icon: LucideIcon; tone: string; title: string; sub: string; text: string; action?: { label: string; href?: string; bot?: boolean } }

export function QuickTopics({ help, bot }: { help: Help; bot: string | null }) {
  const L = useL();
  const { user } = useApp();
  const [open, setOpen] = useState<Topic | null>(null);
  const topics: Topic[] = [
    { key: 'order', icon: Archive, tone: 'bg-primary-soft text-primary', title: 'Buyurtma holati', sub: 'Posilkam qayerda?',
      text: 'Buyurtmangiz holati “Mening buyurtmalarim”da koʻrinadi. Har oʻzgarishda tepadagi qoʻngʻiroqchaga va Telegramga xabar keladi.',
      action: { label: 'Mening buyurtmalarim', href: user ? '/account/orders' : '/track' } },
    { key: 'payment', icon: CreditCard, tone: 'bg-[color-mix(in_srgb,#f59e0b_16%,transparent)] text-[#d97706]', title: 'Toʻlov muammosi', sub: 'Toʻlov oʻtmadi yoki narx savoli',
      text: 'Kartaga oʻtkazgan boʻlsangiz, buyurtma sahifasida chek rasmini yuklang — tekshirib tasdiqlaymiz. Muammo boʻlsa, operatorga yozing.',
      action: bot ? { label: 'Operatorga yozish', bot: true } : undefined },
    { key: 'address', icon: Warehouse, tone: 'bg-success-soft text-success', title: 'Manzil va ombor', sub: 'Manzilingizni qoʻshing',
      text: 'Yetkazish manzilingizni bir marta qoʻshib qoʻying — keyingi buyurtmalarda tanlab qoʻyasiz.',
      action: { label: 'Manzil qoʻshish', href: user ? '/account/addresses' : '/login?next=/account/addresses' } },
    { key: 'other', icon: CircleHelp, tone: 'bg-surface-2 text-ink-2', title: 'Boshqa savol', sub: 'Operatorga toʻgʻridan-toʻgʻri yozing',
      text: 'Telegram botimiz ochiladi — savolingizni oʻsha yerga yozsangiz boʻladi. Operator shu chatda javob beradi.',
      action: bot ? { label: 'Botni ochish', bot: true } : undefined },
  ];
  const video = (k: TopicKey) => (k === 'other' ? null : help.videos[k]?.url ? help.videos[k] : null);

  const click = (t: Topic) => {
    // “Boshqa savol” — darhol botga (video boʻlmasa ortiqcha oyna kerak emas)
    if (t.key === 'other' && bot) { openTg(`https://t.me/${bot}?start=support`); return; }
    setOpen(t);
  };

  return (
    <>
      <ul className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-soft">
        {topics.map((t) => {
          const v = video(t.key);
          return (
            <li key={t.key} className="border-t border-line first:border-t-0">
              <button type="button" onClick={() => click(t)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-2">
                <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', t.tone)}><t.icon className="size-[22px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold tracking-tight">{L(t.title)}</span>
                  <span className="block truncate text-[13px] text-ink-3">{L(t.sub)}</span>
                </span>
                {v ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[13px] font-bold text-success">
                    <span className="flex size-4 items-center justify-center rounded-full bg-success text-white"><Play className="size-2.5 translate-x-px" fill="currentColor" /></span>
                    <span className="num">{v.duration || L('Video')}</span>
                  </span>
                ) : <ChevronRight className="size-5 shrink-0 text-ink-3" />}
              </button>
            </li>
          );
        })}
      </ul>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? L(open.title) : ''}>
        {open && (() => {
          const v = video(open.key);
          const e = v?.url ? embedOf(v.url) : null;
          return (
            <div className="space-y-4">
              {e && (
                <div className="overflow-hidden rounded-2xl bg-black">
                  {e.kind === 'iframe'
                    ? <iframe src={e.src} title={L(open.title)} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="aspect-video w-full" />
                     
                    : <video src={e.src} controls autoPlay playsInline className="max-h-[70vh] w-full" />}
                </div>
              )}
              <p className="text-[15px] leading-relaxed text-ink-2">{L(open.text)}</p>
              {open.action && (open.action.href ? (
                <Link href={open.action.href} onClick={() => setOpen(null)} className="flex h-12 items-center justify-center rounded-2xl bg-primary text-[15px] font-semibold text-primary-fg">{L(open.action.label)}</Link>
              ) : (
                <button type="button" onClick={() => bot && openTg(`https://t.me/${bot}?start=support`)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2a9fd8] text-[15px] font-semibold text-white">
                  <Send className="size-4" fill="currentColor" /> {L(open.action.label)}
                </button>
              ))}
            </div>
          );
        })()}
      </Modal>
    </>
  );
}

export function PhoneCard({ phone, hours }: { phone: string; hours: string }) {
  const L = useL();
  const [copied, setCopied] = useState(false);
  if (!phone) return null;
  return (
    <div className="flex items-center gap-3.5 rounded-[24px] border border-line bg-surface p-4 shadow-soft">
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Phone className="size-[22px]" fill="currentColor" /></span>
        <span className="min-w-0">
          <span className="num block truncate text-[17px] font-bold tracking-tight">{phone}</span>
          {hours && <span className="block truncate text-[13px] text-ink-3">{hours}</span>}
        </span>
      </a>
      <button type="button" aria-label={L('Nusxalash')} title={L('Nusxalash')}
        onClick={async () => { if (await copyText(phone)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
        className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink-2 transition hover:bg-surface-3">
        {copied ? <Check className="size-5 text-success" /> : <Copy className="size-5" />}
      </button>
    </div>
  );
}
