'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban, BarChart3, Bell, Bot, CheckCircle2, ChevronLeft, CreditCard, ExternalLink, Link2, Package, PackageMinus, RefreshCw, RotateCcw, Send,
  ShoppingCart, Trash2, Undo2, Users, Zap, Truck, Gift, Ticket, ReceiptText, BadgeCheck, XCircle, MessageCircle, type LucideIcon } from 'lucide-react';
import {
  connectBot, checkOwnerChat, linkGroup, disconnectTelegram, setChatPaused, updateTemplate, testTemplate,
  unlinkPerson, syncCustomers, saveBroadcast, updateCustomerMessage, testCustomerMsg, testBroadcast, removeBroadcast, connectShopBot, refreshBots, disconnectShopBot,
} from '@/lib/actions/admin/telegram';
import {
  BROADCAST_MAX_BUTTONS, BROADCAST_MAX_TEXT, BROADCAST_STATUS, MAX_BUTTON_LENGTH, MAX_TEMPLATE_LENGTH, TEMPLATES, TEMPLATE_BY_KEY, TEMPLATE_GROUPS,
  renderTemplate, sampleValues, type Broadcast, type BroadcastAudience, type BroadcastButton, type TemplateChats,
  type TemplateKey, type TemplateSettings,
} from '@/lib/telegram/templates';
import {
  CAPTION_MAX, CUSTOMER_BUTTON_MAX, CUSTOMER_MESSAGES, CUSTOMER_MSG_BY_KEY, CUSTOMER_TEXT_MAX, customerSample,
  type CustomerMsgKey, type CustomerMsgSettings,
} from '@/lib/telegram/customer-messages';
import { SingleImageField } from './upload';
import { formatDateTime } from '@/lib/format';
import type { ActionResult } from '@/lib/types';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Button, buttonClass } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/misc';
import { Alert, Segmented, Toggle } from '@/components/ui/kit';
import { cn } from '@/components/ui/cn';
import { Panel, Table } from './ui';

export interface MessagesData {
  isOwner: boolean;
  telegram: {
    botName: string; connected: boolean; chatName: string | null; code: string | null; groupName: string | null; groupCode: string | null;
    groupPaused: boolean; personalPaused: boolean; errors: { chat: 'personal' | 'group'; message: string; at: string }[];
  } | null;
  templates: TemplateSettings;
  customerMessages: CustomerMsgSettings;
  people: { id: string; name: string; linked: boolean; chatName: string | null }[];
  log: { id: number; at: string; template: string; chat: string; ok: boolean; text: string | null; error: string | null }[];
  logTotal: number;
  broadcasts: Broadcast[];
  subscribers: number;
  shopBot: { botName: string; webhookError: string | null; setupAt: string; users: number } | null;
  siteUrl: string;
  adminUrl: string;
}

type Tab = 'customer' | 'templates' | 'broadcast' | 'log';

/** Amal + toast + sahifani yangilash. */
function useRun() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (r: ActionResult<T> & { ok: true }) => void) => start(async () => {
    const res = await fn();
    if (res.ok) { if (res.message) toast(res.message, 'success'); onOk?.(res); router.refresh(); }
    else toast(res.error, 'error');
  });
  return { pending, run };
}

export function MessagesEditor({ data }: { data: MessagesData }) {
  const [tab, setTab] = useState<Tab>('customer');
  return (
    <div className="space-y-4">
      {!data.telegram?.connected && (
        <Alert tone="warn">Admin boti hali ulanmagan — xabarlar yuborilmaydi. <a href="/admin/bots" className="font-semibold underline">Telegram → Botlar</a> boʻlimida ulang.</Alert>
      )}
      <Segmented<Tab> label="Boʻlim" value={tab} onChange={setTab} className="no-scrollbar max-w-full overflow-x-auto"
        options={[
          { value: 'customer', label: 'Mijozga' },
          { value: 'templates', label: 'Adminga' },
          { value: 'broadcast', label: 'Ommaviy xabar' },
          { value: 'log', label: `Yuborilganlar${data.logTotal ? ` · ${data.logTotal}` : ''}` },
        ]} />
      {tab === 'customer' && <CustomerTab data={data} />}
      {tab === 'templates' && <TemplatesTab data={data} />}
      {tab === 'broadcast' && <BroadcastTab data={data} />}
      {tab === 'log' && <LogTab data={data} />}
    </div>
  );
}

// ---------- Telegram koʻrinishi (oldindan koʻrish) ----------
/** Telegram chatidagi xabar pufakchasi. HTML renderTemplate'dan keladi: hamma matn escape qilingan, faqat <b> qoʻshilgan. */
export function TelegramPreview({ html, buttons = [], botName, time = '12:00', image }: { html: string; buttons?: { text: string }[]; botName?: string; time?: string; image?: string | null }) {
  return (
    <div className="rounded-[var(--r-lg)] bg-[#dfe7ee] p-3 dark:bg-[#0e1621]" aria-label="Telegramda koʻrinishi">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#5b6b79] dark:text-[#7d8b99]">
        <Bot className="size-3.5" /> {botName ? `@${botName}` : 'Doʻkon boti'}
      </div>
      <div className="max-w-[340px]">
        <div className="relative overflow-hidden rounded-2xl rounded-tl-md bg-white px-3 py-2 text-[14px] leading-snug text-[#0f1419] shadow-sm dark:bg-[#182533] dark:text-[#e9edf0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image && <img src={image} alt="" className="-mx-3 -mt-2 mb-2 block aspect-[1200/750] w-[calc(100%+1.5rem)] max-w-none bg-[#c9d6e2] object-cover" />}
          {html
            ? <div className="whitespace-pre-wrap break-words [&_b]:font-semibold [&_i]:italic [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[#2b7bc0]" dangerouslySetInnerHTML={{ __html: html }} />
            : <div className="italic text-[#8a98a5]">Matn boʻsh</div>}
          <div className="mt-0.5 text-right text-[11px] text-[#8a98a5]">{time}</div>
        </div>
        {buttons.filter((b) => b.text).map((b, i) => (
          <div key={i} className="mt-1 flex items-center justify-center gap-1 rounded-xl bg-white/70 py-2 text-[13px] font-medium text-[#2b7bc0] dark:bg-[#182533]/80 dark:text-[#6ab3f3]">
            {b.text} <ExternalLink className="size-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Botlar (alohida sahifa: Telegram → Botlar) ----------
export function BotsManager({ data }: { data: MessagesData }) {
  const t = data.telegram;
  const { pending, run } = useRun();
  const confirm = useConfirm();
  const [token, setToken] = useState('');

  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      <div className="xl:col-span-2 grid gap-3 sm:grid-cols-2">
        <BotIntro tone="bg-[#2f80c1]" icon={ShoppingCart} title="Doʻkon boti — xaridorlar uchun"
          text="Xaridor botni ochadi va doʻkon Telegram ichida ochiladi. Roʻyxatdan oʻtish shart emas, buyurtma holati botga keladi." ok={Boolean(data.shopBot)} />
        <BotIntro tone="bg-[#14253b]" icon={Bot} title="Admin boti — siz va xodimlar uchun"
          text="Yangi buyurtma, bekor qilish va kechki hisobot shu botga keladi. Menyu tugmasi admin panelni ochadi." ok={Boolean(t?.connected)} />
      </div>

      <ShopBotPanel data={data} />

      <Panel title="Admin boti" subtitle="Siz va xodimlar uchun. Token faqat bazada saqlanadi va brauzerga qaytmaydi">
        {!t && (
          data.isOwner ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => connectBot(token), () => setToken('')); }}>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
                <li>Telegramda <b>@BotFather</b> ni oching va <b>/newbot</b> yozing.</li>
                <li>Bot nomini bering — BotFather token beradi.</li>
                <li>Tokenni shu yerga qoʻying. U boshqa hech qayerda koʻrinmaydi.</li>
              </ol>
              <Field label="Bot tokeni" htmlFor="tg-token">
                <Input id="tg-token" type="password" autoComplete="off" spellCheck={false} placeholder="123456789:AA…" value={token} onChange={(e) => setToken(e.target.value)} />
              </Field>
              <Button type="submit" loading={pending} disabled={!token.trim()}>Saqlash</Button>
            </form>
          ) : <p className="text-sm text-ink-3">Botni Ega ulaydi.</p>
        )}
        {t && !t.connected && (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">Bot: <b>@{t.botName}</b>. Endi botni oching, <b>Start</b> bosing (kod avtomatik ketadi) yoki kodni oʻzingiz yozing:</p>
            <div className="num rounded-[var(--r-md)] bg-surface-2 py-3 text-center text-2xl font-semibold tracking-[0.2em]">{t.code}</div>
            <div className="flex flex-wrap gap-2">
              <a className={buttonClass("primary", "md")} href={`https://t.me/${t.botName}?start=${t.code}`} target="_blank" rel="noreferrer">
                <Send className="size-4" /> Botni ochish
              </a>
              <Button variant="secondary" loading={pending} onClick={() => run(checkOwnerChat)}><RefreshCw className="size-4" /> Tekshirish</Button>
              {data.isOwner && <Button variant="ghost" onClick={async () => { if (await confirm({ title: 'Botni uzish?', danger: true, confirmText: 'Uzish' })) run(() => disconnectTelegram('bot')); }}>Bekor qilish</Button>}
            </div>
          </div>
        )}
        {t?.connected && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-success" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">@{t.botName} → {t.chatName}</div>
                <div className="text-xs text-ink-3">Shaxsiy chat: buyurtmalar, bekor qilishlar va kechki hisobot</div>
              </div>
              <Toggle label="Shaxsiy chatga yuborish" checked={!t.personalPaused} disabled={pending} onChange={(on) => run(() => setChatPaused('personal', !on))} />
            </div>
            {t.personalPaused && <Alert tone="warn">Shaxsiy chat vaqtincha toʻxtatilgan. Kechki hisobot baribir keladi.</Alert>}
            {data.isOwner && (
              <Button variant="secondary" size="sm" loading={pending} onClick={() => run(refreshBots)}><RefreshCw className="size-4" /> Menyu tugmasini sozlash</Button>
            )}
            {data.isOwner && (
              <Button variant="ghost" size="sm" onClick={async () => {
                if (await confirm({ title: 'Botni butunlay uzish?', text: 'Guruh va xodimlar ham xabar olmay qoladi. Matnlar saqlanib qoladi.', danger: true, confirmText: 'Uzish' })) run(() => disconnectTelegram('bot'));
              }}>Botni uzish</Button>
            )}
          </div>
        )}
        {t?.errors.map((e) => (
          <Alert key={e.chat} tone="danger" className="mt-3">
            <b>{e.chat === 'group' ? 'Guruh' : 'Shaxsiy chat'}:</b> {e.message} <span className="text-xs opacity-70">({formatDateTime(e.at)})</span>
          </Alert>
        ))}
      </Panel>

      <Panel title="Guruh" subtitle="Xodimlar guruhi: yangi buyurtmalar va bekor qilishlar">
        {!t?.connected ? <p className="text-sm text-ink-3">Avval botni oʻzingizga ulang.</p> : t.groupName ? (
          <div className="flex items-center gap-3">
            <Users className="size-5 text-primary" />
            <div className="min-w-0 flex-1 text-sm font-semibold">{t.groupName}</div>
            <Toggle label="Guruhga yuborish" checked={!t.groupPaused} disabled={pending} onChange={(on) => run(() => setChatPaused('group', !on))} />
            {data.isOwner && <Button variant="ghost" size="sm" onClick={async () => { if (await confirm({ title: 'Guruhni uzish?', danger: true, confirmText: 'Uzish' })) run(() => disconnectTelegram('group')); }}>Uzish</Button>}
          </div>
        ) : data.isOwner ? (
          <div className="space-y-3 text-sm text-ink-2">
            <p>1. Botni guruhga qoʻshing. 2. Guruhda quyidagini yozing (mavzuli guruhda — kerakli mavzuda):</p>
            <code className="num block rounded-[var(--r-md)] bg-surface-2 px-3 py-2 text-[13px]">/start@{t.botName} {t.groupCode}</code>
            <Button variant="secondary" loading={pending} onClick={() => run(linkGroup)}><Link2 className="size-4" /> Tekshirish</Button>
          </div>
        ) : <p className="text-sm text-ink-3">Guruhni Ega ulaydi.</p>}
      </Panel>

      <Panel title="Xodimlar" subtitle="Har bir xodim oʻz Telegramini “Mening Telegramim” sahifasida ulaydi" padded={false}>
        <Table>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="text-sm">{p.linked ? <span className="text-success">✓ {p.chatName}</span> : <span className="text-ink-3">Ulanmagan</span>}</td>
                <td className="text-right">{p.linked && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => unlinkPerson(p.id))}>Uzish</Button>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel title="Xaridorlar" subtitle="Botga /start bosgan xaridorlar ommaviy xabar oladi. /stop yozsa — chiqadi">
        <div className="flex items-center justify-between gap-3">
          <div><div className="num text-2xl font-semibold">{data.subscribers}</div><div className="text-xs text-ink-3">obunachi</div></div>
          <Button variant="secondary" loading={pending} disabled={!t?.connected} onClick={() => run(syncCustomers)}><RefreshCw className="size-4" /> Yangilash</Button>
        </div>
        {t?.connected && <p className="mt-3 text-xs text-ink-3">Doʻkon havolasi: <span className="num">t.me/{t.botName}</span> — uni saytga yoki Instagramga qoʻying.</p>}
      </Panel>
    </div>
  );
}

function BotIntro({ tone, icon: Icon, title, text, ok }: { tone: string; icon: LucideIcon; title: string; text: string; ok: boolean }) {
  return (
    <div className="flex gap-3 rounded-[var(--r-lg)] border border-line bg-surface p-4">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl text-white', tone)}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">{title} {ok ? <Badge tone="green">Ulangan</Badge> : <Badge tone="gray">Ulanmagan</Badge>}</div>
        <p className="mt-1 text-xs leading-relaxed text-ink-3">{text}</p>
      </div>
    </div>
  );
}

function ShopBotPanel({ data }: { data: MessagesData }) {
  const s = data.shopBot;
  const { pending, run } = useRun();
  const confirm = useConfirm();
  const [token, setToken] = useState('');
  return (
    <Panel title="Doʻkon boti" subtitle="Xaridorlar uchun alohida bot. Token faqat bazada saqlanadi">
      {!s ? (
        data.isOwner ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => connectShopBot(token), () => setToken('')); }}>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
              <li>Telegramda <b>@BotFather</b> ni oching, <b>/newbot</b> yozing.</li>
              <li>Bot nomini yozing (masalan, doʻkoningiz nomi), keyin <b>_bot</b> bilan tugaydigan manzil.</li>
              <li>BotFather bergan tokenni shu yerga qoʻying — qolganini (menyu tugmasi, buyruqlar, tavsif) oʻzimiz sozlaymiz.</li>
            </ol>
            <Field label="Doʻkon boti tokeni" htmlFor="shop-token" hint="Admin botidan boshqa, yangi bot boʻlsin">
              <Input id="shop-token" type="password" autoComplete="off" spellCheck={false} placeholder="123456789:AA…" value={token} onChange={(e) => setToken(e.target.value)} />
            </Field>
            <Button type="submit" loading={pending} disabled={!token.trim()}>Ulash</Button>
          </form>
        ) : <p className="text-sm text-ink-3">Botni Ega ulaydi.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">@{s.botName}</div>
              <div className="text-xs text-ink-3">{s.users} ta xaridor bot orqali kirgan · sozlangan {formatDateTime(s.setupAt)}</div>
            </div>
          </div>
          {s.webhookError && <Alert tone="warn">{s.webhookError}</Alert>}
          <div className="rounded-[var(--r-md)] bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
            Bot havolasi: <a className="num font-semibold text-primary" href={`https://t.me/${s.botName}`} target="_blank" rel="noreferrer">t.me/{s.botName}</a> — uni Instagram, saytga va qadoqqa qoʻying.
            Xaridor <b>Start</b> bosadi → <b>Doʻkon</b> tugmasi saytni Telegram ichida ochadi → avtomatik kiradi.
          </div>
          <div className="flex flex-wrap gap-2">
            <a className={buttonClass('primary', 'md')} href={`https://t.me/${s.botName}`} target="_blank" rel="noreferrer"><Send className="size-4" /> Botni ochish</a>
            {data.isOwner && <Button variant="secondary" loading={pending} onClick={() => run(refreshBots)}><RefreshCw className="size-4" /> Qayta sozlash</Button>}
            {data.isOwner && <Button variant="ghost" onClick={async () => { if (await confirm({ title: 'Doʻkon botini uzish?', text: 'Xaridorlar botdan doʻkonni ocholmay qoladi.', danger: true, confirmText: 'Uzish' })) run(disconnectShopBot); }}>Uzish</Button>}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ---------- 2. Xabar matnlari: chapda roʻyxat, oʻngda tahrir ----------
const TEMPLATE_ICONS: Record<TemplateKey, LucideIcon> = {
  newOrder: ShoppingCart, paymentReceipt: ReceiptText, customerMessage: MessageCircle, paymentReceived: CreditCard, orderStatus: Package, orderCancel: Ban,
  paymentVoid: Undo2, lowStock: PackageMinus, dailyReport: BarChart3,
};
const GROUP_TONES = ['bg-[#1d4f80]', 'bg-[#2f80c1]', 'bg-[#1f7a4d]', 'bg-[#8a5a12]'];

function TemplatesTab({ data }: { data: MessagesData }) {
  const [selected, setSelected] = useState<TemplateKey | null>(null);
  const current = selected ?? TEMPLATES[0].key;
  const linkedPeople = data.people.filter((p) => p.linked);
  const { pending, run } = useRun();
  return (
    <div className="space-y-4">
      {!data.telegram?.connected && <Alert tone="warn">Bot hali ulanmagan — matnlarni hozir sozlab qoʻyish mumkin.</Alert>}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className={cn('space-y-4 lg:sticky lg:top-[120px] lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-1 scrollbar-thin', selected && 'hidden lg:block')}>
          {TEMPLATE_GROUPS.map((g, gi) => (
            <section key={g.key}>
              <h3 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-wide text-ink-2">
                <span className={cn('inline-flex size-6 items-center justify-center rounded-md text-xs font-bold text-white', GROUP_TONES[gi % GROUP_TONES.length])}>{g.letter}</span>
                {g.title}
              </h3>
              <div className="space-y-2">
                {TEMPLATES.filter((t) => t.group === g.key).map((t) => {
                  const Icon = TEMPLATE_ICONS[t.key] ?? Bell;
                  const on = !data.templates.off.includes(t.key);
                  const active = current === t.key;
                  return (
                    <div key={t.key} className={cn('flex items-center gap-3 rounded-2xl border bg-surface-solid px-3.5 py-3 transition-colors',
                      active ? 'border-[#9fc0e3] bg-[#eef4fb] dark:border-white/25 dark:bg-white/5' : 'border-line hover:border-line-strong')}>
                      <button type="button" onClick={() => setSelected(t.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-current={active ? 'true' : undefined}>
                        <Icon className="size-[19px] shrink-0 text-ink-3" strokeWidth={1.8} />
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-ink">{t.title}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-ink-3">
                            {data.templates.texts[t.key] && <span className="text-[11px] font-medium text-[#1d4f80] dark:text-white/80">oʻzgartirilgan</span>}
                            {t.groupChat && <Users className="size-3.5" aria-label="Guruhga ham" />}
                          </span>
                        </span>
                      </button>
                      <Toggle label={`${t.title}: yoqilgan`} checked={on} disabled={pending} onChange={(v) => run(() => updateTemplate(t.key, { on: v }))} />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className={cn(!selected && 'hidden lg:block')}>
          <TemplateEditor key={current} k={current} data={data} people={linkedPeople} onBack={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between first:mt-0">
      <span className="text-[13px] font-bold uppercase tracking-wide text-ink-2">{children}</span>
      {right}
    </div>
  );
}

function TemplateEditor({ k, data, people, onBack }: { k: TemplateKey; data: MessagesData; people: MessagesData['people']; onBack: () => void }) {
  const def = TEMPLATE_BY_KEY[k];
  const settings = data.templates;
  const on = !settings.off.includes(k);
  const saved = settings.texts[k] ?? def.text;
  const [text, setText] = useState(saved);
  const chats: TemplateChats = settings.chats[k] ?? {};
  const ref = useRef<HTMLTextAreaElement>(null);
  const { pending, run } = useRun();
  const html = renderTemplate(text, sampleValues(k));
  const savedButton = settings.buttons?.[k] ?? def.button ?? '';
  const [button, setButton] = useState(savedButton);

  const insert = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) return setText((v) => v + token);
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const next = text.slice(0, a) + token + text.slice(b);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + token.length, a + token.length); });
  };
  const setChats = (patch: TemplateChats) => run(() => updateTemplate(k, { chats: patch }));

  return (
    <div className="rounded-2xl border border-line bg-surface-solid p-4 sm:p-5">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-2 lg:hidden"><ChevronLeft className="size-4" /> Roʻyxat</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold tracking-tight text-ink">{def.title}</h2>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-2">
            <Zap className="size-3.5" /> {def.hint}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-3">
          {on ? 'Yoqilgan' : 'Oʻchirilgan'}
          <Toggle label={`${def.title}: yoqilgan`} checked={on} disabled={pending} onChange={(v) => run(() => updateTemplate(k, { on: v }))} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div>
          <SectionLabel right={<span className="text-xs text-ink-3 num">{text.length}/{MAX_TEMPLATE_LENGTH}</span>}>Matn</SectionLabel>
          <Textarea ref={ref} rows={8} value={text} maxLength={MAX_TEMPLATE_LENGTH} onChange={(e) => setText(e.target.value)} aria-label={`${def.title}: matn`} className="rounded-2xl text-[15px] leading-relaxed" />
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-ink-3">Oʻzgaruvchi qoʻshish:</span>
            {def.vars.map((v) => (
              <button key={v.name} type="button" onClick={() => insert(v.name)} title={v.label}
                className="rounded-lg border border-[#c9d9ea] bg-[#eef4fb] px-2 py-1 font-mono text-xs text-[#1d4f80] hover:border-[#1d4f80] dark:border-white/15 dark:bg-white/5 dark:text-white/85">
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">*yulduzcha orasida* — qalin, `teskari tirnoq orasida` — bosilsa nusxalanadi. Qiymati boʻsh qator chiqmaydi.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button loading={pending} disabled={text === saved} onClick={() => run(() => updateTemplate(k, { text }))}>Saqlash</Button>
            <Button variant="secondary" disabled={pending || !data.telegram?.connected} onClick={() => run(() => testTemplate(k, text))}><Send className="size-4" /> Namuna yuborish</Button>
            <Button variant="ghost" disabled={pending || text === def.text} onClick={() => { setText(def.text); run(() => updateTemplate(k, { text: null })); }}><RotateCcw className="size-4" /> Standart</Button>
          </div>

          {def.button && (
            <>
              <SectionLabel right={<span className="text-xs text-ink-3 num">{button.length}/{MAX_BUTTON_LENGTH}</span>}>Tugma</SectionLabel>
              <div className="flex flex-wrap gap-2">
                <Input value={button} maxLength={MAX_BUTTON_LENGTH} onChange={(e) => setButton(e.target.value)} placeholder="Boʻsh — tugmasiz" aria-label={`${def.title}: tugma`} className="min-w-0 flex-1" />
                <Button variant="secondary" loading={pending} disabled={button === savedButton} onClick={() => run(() => updateTemplate(k, { button }))}>Saqlash</Button>
              </div>
              <p className="mt-1.5 text-xs text-ink-3">Bosilganda admin panel Telegram ichida, kerakli sahifada ochiladi (guruhda — brauzerda). Boʻsh qoldirsangiz, tugma chiqmaydi.</p>
            </>
          )}

          {k !== 'dailyReport' && (
            <>
              <SectionLabel>Kimga yuboriladi</SectionLabel>
              <div className="divide-y divide-line rounded-2xl border border-line">
                <ChatRow label="Mening chatim" checked={chats.personal !== false} disabled={pending} onChange={(v) => setChats({ personal: v })} />
                {def.groupChat && <ChatRow label={data.telegram?.groupName ? `Guruh: ${data.telegram.groupName}` : 'Guruh (ulanmagan)'} checked={chats.group !== false} disabled={pending} onChange={(v) => setChats({ group: v })} />}
                {def.staff && people.map((p) => (
                  <ChatRow key={p.id} label={p.name} checked={chats.staff?.includes(p.id) ?? false} disabled={pending}
                    onChange={(v) => setChats({ staff: v ? [...(chats.staff ?? []), p.id] : (chats.staff ?? []).filter((x) => x !== p.id) })} />
                ))}
                {def.staff && !people.length && <p className="px-4 py-3 text-xs text-ink-3">Telegramini ulagan xodim yoʻq.</p>}
              </div>
            </>
          )}
        </div>
        <div>
          <SectionLabel>Telegramda koʻrinishi</SectionLabel>
          <TelegramPreview html={html} buttons={button.trim() ? [{ text: button.trim() }] : []} botName={data.telegram?.botName} />
        </div>
      </div>
    </div>
  );
}

function ChatRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm font-medium text-ink">{label}</span>
      <Toggle label={label} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

// ---------- Mijozga xabarlar (doʻkon boti) ----------
const CUSTOMER_ICONS: Record<CustomerMsgKey, LucideIcon> = {
  orderNew: ShoppingCart, awaitPayment: CreditCard, paid: BadgeCheck, receiptRejected: XCircle, confirmed: CheckCircle2, processing: Package, shipped: Truck, delivered: Gift, cancelled: Ban, returned: Undo2, coupon: Ticket,
};

function CustomerTab({ data }: { data: MessagesData }) {
  const [selected, setSelected] = useState<CustomerMsgKey | null>(null);
  const current = selected ?? CUSTOMER_MESSAGES[0].key;
  const { pending, run } = useRun();
  return (
    <div className="space-y-4">
      {!data.shopBot
        ? <Alert tone="warn">Doʻkon boti hali ulanmagan — xabarlar xaridorlarga ketmaydi. <a href="/admin/bots" className="font-semibold underline">Telegram → Botlar</a> boʻlimida ulang. Matn va rasmlarni hozir sozlab qoʻyish mumkin.</Alert>
        : <Alert tone="info">Bu xabarlar xaridorga <b>@{data.shopBot.botName}</b> orqali keladi: rasm, matn va tugma. Har birini oʻzingiz yozasiz, rasmni almashtirasiz yoki oʻchirib qoʻyasiz.</Alert>}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <div className={cn('space-y-2 lg:sticky lg:top-[120px]', selected && 'hidden lg:block')}>
          {CUSTOMER_MESSAGES.map((m) => {
            const Icon = CUSTOMER_ICONS[m.key];
            const st = data.customerMessages[m.key];
            const on = !st?.off;
            const active = current === m.key;
            return (
              <div key={m.key} className={cn('flex items-center gap-3 rounded-2xl border bg-surface-solid px-3.5 py-3 transition-colors',
                active ? 'border-[#9fc0e3] bg-[#eef4fb] dark:border-white/25 dark:bg-white/5' : 'border-line hover:border-line-strong')}>
                <button type="button" onClick={() => setSelected(m.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-current={active ? 'true' : undefined}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${m.art.from}, ${m.art.to})` }}><Icon className="size-[18px]" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">{m.title}</span>
                    <span className="block truncate text-xs text-ink-3">{st?.text || st?.button || st?.image ? 'oʻzgartirilgan · ' : ''}{m.hint}</span>
                  </span>
                </button>
                <Toggle label={`${m.title}: yoqilgan`} checked={on} disabled={pending} onChange={(v) => run(() => updateCustomerMessage(m.key, { on: v }))} />
              </div>
            );
          })}
        </div>
        <div className={cn(!selected && 'hidden lg:block')}>
          <CustomerEditor key={current} k={current} data={data} onBack={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}

type ImageMode = 'default' | 'custom' | 'none';

function CustomerEditor({ k, data, onBack }: { k: CustomerMsgKey; data: MessagesData; onBack: () => void }) {
  const def = CUSTOMER_MSG_BY_KEY[k];
  const st = data.customerMessages[k] ?? {};
  const on = !st.off;
  const savedText = st.text ?? def.text;
  const savedButton = st.button ?? def.button;
  const savedMode: ImageMode = st.image === 'none' ? 'none' : st.image ? 'custom' : 'default';
  const [text, setText] = useState(savedText);
  const [button, setButton] = useState(savedButton);
  const [mode, setMode] = useState<ImageMode>(savedMode);
  const [custom, setCustom] = useState<string | null>(savedMode === 'custom' ? st.image! : null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { pending, run } = useRun();
  const html = renderTemplate(text, customerSample(k));
  const previewSrc = mode === 'default' ? `${data.siteUrl}/api/tg-card/${k}` : mode === 'custom' ? custom : null;
  const dirty = text !== savedText || button !== savedButton || mode !== savedMode || (mode === 'custom' && custom !== st.image);
  const tooLong = mode !== 'none' && html.length > CAPTION_MAX;

  const insert = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) return setText((v) => v + token);
    const [a, b] = [el.selectionStart, el.selectionEnd];
    setText(text.slice(0, a) + token + text.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + token.length, a + token.length); });
  };
  const save = () => run(() => updateCustomerMessage(k, {
    text: text === def.text ? null : text,
    button: button === def.button ? null : button,
    image: mode === 'default' ? null : mode === 'none' ? 'none' : custom,
  }));

  return (
    <div className="rounded-2xl border border-line bg-surface-solid p-4 sm:p-5">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-2 lg:hidden"><ChevronLeft className="size-4" /> Roʻyxat</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold tracking-tight text-ink">{def.title}</h2>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-2"><Zap className="size-3.5" /> {def.hint}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-3">
          {on ? 'Yoqilgan' : 'Oʻchirilgan'}
          <Toggle label={`${def.title}: yoqilgan`} checked={on} disabled={pending} onChange={(v) => run(() => updateCustomerMessage(k, { on: v }))} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <SectionLabel>Rasm</SectionLabel>
          <Segmented<ImageMode> label="Rasm" value={mode} onChange={setMode} className="no-scrollbar max-w-full overflow-x-auto"
            options={[{ value: 'default', label: 'Standart rasm' }, { value: 'custom', label: 'Oʻz rasmim' }, { value: 'none', label: 'Rasmsiz' }]} />
          {mode === 'default' && <p className="mt-2 text-xs text-ink-3">Doʻkon nomi bilan tayyor kartochka.{k === 'coupon' ? ' Kuponning rangi va yozuvi (masalan “11.11”) olinadi.' : ''}</p>}
          {mode === 'custom' && <div className="mt-3"><SingleImageField label="Rasm yuklang (yotiq, masalan 1200×750)" folder="telegram" aspect="aspect-[1200/750]" value={custom} onChange={setCustom} /></div>}

          <SectionLabel right={<span className={cn('text-xs num', tooLong ? 'text-danger' : 'text-ink-3')}>{text.length}/{mode === 'none' ? CUSTOMER_TEXT_MAX : CAPTION_MAX}</span>}>Matn</SectionLabel>
          <Textarea ref={ref} rows={8} value={text} maxLength={CUSTOMER_TEXT_MAX} onChange={(e) => setText(e.target.value)} aria-label={`${def.title}: matn`} className="rounded-2xl text-[15px] leading-relaxed" />
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-ink-3">Oʻzgaruvchi qoʻshish:</span>
            {def.vars.map((v) => (
              <button key={v.name} type="button" onClick={() => insert(v.name)} title={v.label}
                className="rounded-lg border border-[#c9d9ea] bg-[#eef4fb] px-2 py-1 font-mono text-xs text-[#1d4f80] hover:border-[#1d4f80] dark:border-white/15 dark:bg-white/5 dark:text-white/85">
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">*yulduzcha orasida* — qalin, `teskari tirnoq orasida` — bosilsa nusxalanadi. Qiymati boʻsh qator chiqmaydi.{tooLong ? ' Rasmli xabarda matn 1024 belgidan oshsa, rasmsiz yuboriladi.' : ''}</p>

          <SectionLabel>Tugma</SectionLabel>
          <Input value={button} maxLength={CUSTOMER_BUTTON_MAX} onChange={(e) => setButton(e.target.value)} aria-label="Tugma nomi" placeholder="Boʻsh qoldirsangiz tugma chiqmaydi" className="max-w-sm" />
          <p className="mt-1.5 text-xs text-ink-3">Bosilganda {k === 'coupon' ? 'Chegirmalar sahifasi' : 'buyurtma sahifasi'} Telegram ichida ochiladi.</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button loading={pending} disabled={!dirty || !text.trim() || (mode === 'custom' && !custom)} onClick={save}>Saqlash</Button>
            <Button variant="secondary" disabled={pending || !data.shopBot} onClick={() => run(() => testCustomerMsg(k, text, button))}><Send className="size-4" /> Oʻzimga namuna</Button>
            <Button variant="ghost" disabled={pending || (!st.text && !st.button && !st.image)} onClick={() => {
              setText(def.text); setButton(def.button); setMode('default'); setCustom(null);
              run(() => updateCustomerMessage(k, { text: null, button: null, image: null }));
            }}><RotateCcw className="size-4" /> Standart</Button>
          </div>
        </div>
        <div>
          <SectionLabel>Telegramda koʻrinishi</SectionLabel>
          <div className="max-w-[380px]"><TelegramPreview html={html} buttons={button.trim() ? [{ text: button.trim() }] : []} botName={data.shopBot?.botName} image={mode === 'none' ? null : previewSrc} /></div>
        </div>
      </div>
    </div>
  );
}

// ---------- 3. Ommaviy xabar ----------
interface Draft { id: number | null; title: string; text: string; image: string | null; buttons: BroadcastButton[]; audience: BroadcastAudience; silent: boolean; when: 'now' | 'later'; sendAt: string }
const EMPTY: Draft = { id: null, title: '', text: '', image: null, buttons: [], audience: { kind: 'all' }, silent: false, when: 'now', sendAt: '' };

/** datetime-local qiymati (Toshkent emas, brauzer vaqti). */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function BroadcastTab({ data }: { data: MessagesData }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const { pending, run } = useRun();
  const confirm = useConfirm();
  if (draft) return <BroadcastEditor data={data} initial={draft} onClose={() => setDraft(null)} />;
  return (
    <Panel title="Ommaviy xabarlar" subtitle="Xodimlarga, obuna xaridorlarga yoki hammaga — hozir yoki belgilangan vaqtda"
      actions={<Button size="sm" onClick={() => setDraft(EMPTY)}>+ Yangi xabar</Button>} padded={false}>
      {!data.broadcasts.length ? <EmptyState plain title="Hali xabar yoʻq" text="Aksiya, yangi mahsulot yoki ish vaqti haqida bitta xabar yozib, hammaga yuboring." /> : (
        <div className="divide-y divide-line">
          {data.broadcasts.map((b) => {
            const st = BROADCAST_STATUS[b.status];
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="truncate">{b.title || b.text.split('\n')[0].slice(0, 60)}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="text-xs text-ink-3">
                    {b.audience.kind === 'staff' ? 'Xodimlar' : b.audience.kind === 'customers' ? 'Xaridorlar' : 'Hammaga'}
                    {b.status === 'scheduled' && b.send_at && ` · ${formatDateTime(b.send_at)}`}
                    {(b.status === 'sent' || b.status === 'failed') && ` · ${b.delivered} ta yetdi${b.failed ? `, ${b.failed} ta yetmadi` : ''} · ${formatDateTime(b.sent_at ?? b.created_at)}`}
                  </div>
                </div>
                {(b.status === 'draft' || b.status === 'scheduled') && (
                  <Button size="sm" variant="secondary" onClick={() => setDraft({
                    id: b.id, title: b.title, text: b.text, image: b.image ?? null, buttons: b.buttons, audience: b.audience, silent: b.silent,
                    when: b.status === 'scheduled' ? 'later' : 'now', sendAt: toLocalInput(b.send_at),
                  })}>Tahrirlash</Button>
                )}
                {(b.status === 'sent' || b.status === 'failed') && (
                  <Button size="sm" variant="ghost" onClick={() => setDraft({ ...EMPTY, title: b.title, text: b.text, image: b.image ?? null, buttons: b.buttons, audience: b.audience, silent: b.silent })}>Nusxa</Button>
                )}
                {b.status !== 'sending' && b.status !== 'sent' && (
                  <Button size="sm" variant="ghost" disabled={pending} aria-label={b.status === 'scheduled' ? 'Rejani bekor qilish' : 'Oʻchirish'}
                    onClick={async () => { if (await confirm({ title: b.status === 'scheduled' ? 'Rejani bekor qilish?' : 'Xabarni oʻchirish?', danger: true, confirmText: 'Ha' })) run(() => removeBroadcast(b.id)); }}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><span className="num inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-fg">{n}</span>{title}</h3>
      {children}
    </section>
  );
}

function BroadcastEditor({ data, initial, onClose }: { data: MessagesData; initial: Draft; onClose: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const { pending, run } = useRun();
  const confirm = useConfirm();
  const linked = data.people.filter((p) => p.linked);
  const staffCount = d.audience.users?.length ?? linked.length;
  const reach = d.audience.kind === 'staff' ? staffCount : d.audience.kind === 'customers' ? data.subscribers : linked.length + data.subscribers;
  const input = () => ({ title: d.title, text: d.text, image: d.image, buttons: d.buttons, audience: d.audience, silent: d.silent, sendAt: d.when === 'later' && d.sendAt ? new Date(d.sendAt).toISOString() : null });
  const html = renderTemplate(d.text, {});

  const send = async () => {
    if (d.when === 'later') return run(() => saveBroadcast(d.id, input(), 'schedule'), onClose);
    if (!(await confirm({ title: `${reach} kishiga hozir yuborilsinmi?`, text: 'Yuborilgan xabarni qaytarib boʻlmaydi.', confirmText: 'Yuborish' }))) return;
    run(() => saveBroadcast(d.id, input(), 'now'), onClose);
  };

  return (
    <Panel title={d.id ? 'Xabarni tahrirlash' : 'Yangi ommaviy xabar'} actions={<Button size="sm" variant="ghost" onClick={onClose}>Orqaga</Button>}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Step n={1} title="Matn">
            <Field label="Sarlavha (faqat roʻyxat uchun)"><Input maxLength={80} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Masalan: Qora juma aksiyasi" /></Field>
            <SingleImageField label="Rasm (ixtiyoriy)" folder="telegram" aspect="aspect-[1200/750]" value={d.image} onChange={(image) => set({ image })} />
            <Field label="Xabar" hint={`*yulduzcha orasida* — qalin · ${d.text.length}/${d.image ? CAPTION_MAX : BROADCAST_MAX_TEXT}`}>
              <Textarea rows={7} maxLength={d.image ? CAPTION_MAX : BROADCAST_MAX_TEXT} value={d.text} onChange={(e) => set({ text: e.target.value })} />
            </Field>
            {d.buttons.map((b, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <Input aria-label="Tugma nomi" placeholder="Tugma nomi" maxLength={40} value={b.text} onChange={(e) => set({ buttons: d.buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                <Input aria-label="Havola" placeholder="https://…" value={b.url} onChange={(e) => set({ buttons: d.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                <Button variant="ghost" aria-label="Tugmani olib tashlash" onClick={() => set({ buttons: d.buttons.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            {d.buttons.length < BROADCAST_MAX_BUTTONS && <Button size="sm" variant="secondary" onClick={() => set({ buttons: [...d.buttons, { text: '', url: '' }] })}>+ Havola tugmasi</Button>}
          </Step>

          <Step n={2} title="Kimga">
            <Segmented label="Kimga" value={d.audience.kind} onChange={(kind) => set({ audience: { kind } })}
              options={[{ value: 'all', label: 'Hammaga' }, { value: 'customers', label: `Xaridorlar · ${data.subscribers}` }, { value: 'staff', label: `Xodimlar · ${linked.length}` }]} />
            {d.audience.kind === 'staff' && linked.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {linked.map((p) => {
                  const users = d.audience.users ?? linked.map((x) => x.id);
                  return <Checkbox key={p.id} label={p.name} checked={users.includes(p.id)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...users, p.id] : users.filter((x) => x !== p.id);
                      set({ audience: next.length === linked.length ? { kind: 'staff' } : { kind: 'staff', users: next } });
                    }} />;
                })}
              </div>
            )}
            <Checkbox label="Ovozsiz (bildirishnoma jiringlamaydi)" checked={d.silent} onChange={(e) => set({ silent: e.target.checked })} />
          </Step>

          <Step n={3} title="Qachon">
            <Segmented label="Qachon" value={d.when} onChange={(when) => set({ when })} options={[{ value: 'now', label: 'Hozir' }, { value: 'later', label: 'Belgilangan vaqtda' }]} />
            {d.when === 'later' && <Input type="datetime-local" aria-label="Yuborish vaqti" value={d.sendAt} onChange={(e) => set({ sendAt: e.target.value })} className="max-w-xs" />}
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button loading={pending} disabled={!d.text.trim() || !reach || (d.when === 'later' && !d.sendAt)} onClick={send}>
                <Send className="size-4" /> {d.when === 'later' ? 'Rejalashtirish' : `Yuborish · ${reach}`}
              </Button>
              <Button variant="secondary" disabled={pending || !d.text.trim() || !data.telegram?.connected} onClick={() => run(() => testBroadcast(input()))}>Oʻzimga sinov</Button>
              <Button variant="ghost" disabled={pending || !d.text.trim()} onClick={() => run(() => saveBroadcast(d.id, input(), 'draft'), onClose)}>Qoralama</Button>
            </div>
            {!reach && <p className="text-xs text-ink-3">Bu xabar hozircha hech kimga yetmaydi.</p>}
          </Step>
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <TelegramPreview html={html} buttons={d.buttons} botName={data.telegram?.botName} image={d.image} />
        </div>
      </div>
    </Panel>
  );
}

// ---------- 4. Yuborilganlar ----------
const chatLabel = (c: string) => (c === 'personal' ? 'Mening chatim' : c === 'group' ? 'Guruh' : c.startsWith('staff:') ? c.slice(6) || 'Xodim' : c.startsWith('mijoz:') ? `Xaridor ${c.slice(6)}` : c);
const templateLabel = (k: string) => (k in TEMPLATE_BY_KEY ? TEMPLATE_BY_KEY[k as TemplateKey].title : k.startsWith('customer:') ? `Mijozga: ${CUSTOMER_MSG_BY_KEY[(({ new: 'orderNew' } as Record<string, string>)[k.slice(9)] ?? k.slice(9)) as CustomerMsgKey]?.title ?? k.slice(9)}` : k === 'broadcast' ? 'Ommaviy xabar' : k === 'test' ? 'Namuna' : k);

function LogTab({ data }: { data: MessagesData }) {
  return (
    <Panel title="Yuborilganlar" subtitle="Oxirgi xabarlar: qayerga ketgani va yetib borgani. Jurnal 500 tadan oshmaydi" padded={false}>
      <Table>
        <thead><tr><th>Vaqt</th><th>Xabar</th><th>Kimga</th><th>Holat</th></tr></thead>
        <tbody>
          {!data.log.length && <tr><td colSpan={4} className="py-10 text-center text-sm text-ink-3">Hali hech narsa yuborilmagan</td></tr>}
          {data.log.map((l) => (
            <tr key={l.id}>
              <td className="num whitespace-nowrap text-xs text-ink-3">{formatDateTime(l.at)}</td>
              <td className="text-sm font-medium">{templateLabel(l.template)}</td>
              <td className="text-sm">{chatLabel(l.chat)}</td>
              <td className={cn('text-sm', l.ok ? 'text-success' : 'text-danger')}>{l.ok ? '✓ Yetdi' : `✕ ${l.error ?? 'Xato'}`}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
