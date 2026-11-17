'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Send } from 'lucide-react';
import type { SiteSettings } from '@/lib/settings-schema';
import { SMS_EVENTS, renderSms, type SmsEvent } from '@/lib/sms/events';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Badge } from '@/components/ui/misc';
import { Toggle } from '@/components/ui/kit';
import { clearSmsCredsAction, saveSmsCredsAction, smsBalanceAction, testSmsAction } from '@/lib/actions/admin/sms';
import { Panel } from './ui';
import { SwitchRow } from './growth-ui';
import { SaveBar, useSection } from './settings-editor';

const SAMPLE = { dokon: 'Doʻkon', raqam: '100245', summa: '1 250 000 soʻm', trek: 'YT123456789', sorov: '1024' };

export function SmsConnect({ status, isOwner }: { status: { configured: boolean; email: string; from: string }; isOwner: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [from, setFrom] = useState(status.from);
  const [balance, setBalance] = useState<number | null | undefined>(undefined);
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('Sinov xabari');
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const r = await fn();
    toast(r.ok ? r.message ?? 'Bajarildi' : r.error ?? 'Xatolik', r.ok ? undefined : 'error');
    if (r.ok) { setPassword(''); router.refresh(); }
  });
  return (
    <Panel title="Eskiz.uz ulanishi" subtitle="SMS Eskiz orqali ketadi. Hisob: my.eskiz.uz — login (email) va parol"
      actions={status.configured ? <Badge tone="success">Ulangan · {status.email}</Badge> : <Badge>Ulanmagan</Badge>}>
      {isOwner ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Email (login)"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={status.configured ? status.email : 'siz@mail.uz'} autoComplete="off" /></Field>
          <Field label="Parol" hint={status.configured ? 'Boʻsh — eskisi qoladi' : undefined}><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Joʻnatuvchi (nik)" hint="Tasdiqlangan nik yoki 4546"><Input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={11} /></Field>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <Button size="sm" loading={pending} disabled={!email && !status.configured} onClick={() => run(() => saveSmsCredsAction({ email: email || '', password, from }))}><KeyRound className="size-4" />Saqlash va tekshirish</Button>
            {status.configured && <Button size="sm" variant="ghost" disabled={pending} onClick={() => window.confirm('Eskiz uzilsinmi? SMS yuborilmay qoladi') && run(clearSmsCredsAction)}>Uzish</Button>}
          </div>
          {status.configured && !email && <p className="text-xs text-ink-3 sm:col-span-3">Loginni oʻzgartirish uchun emailni qayta kiriting.</p>}
        </div>
      ) : <p className="text-sm text-ink-3">Eskiz login va parolini faqat doʻkon egasi kiritadi.</p>}
      {status.configured && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <Field label="Sinov: telefon"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" inputMode="tel" /></Field>
          <Field label="Matn"><Input value={text} onChange={(e) => setText(e.target.value)} maxLength={900} /></Field>
          <Button size="sm" variant="secondary" loading={pending} disabled={!phone} onClick={() => run(() => testSmsAction(phone, text))}><Send className="size-4" />Yuborish</Button>
          <div className="text-xs text-ink-3 sm:col-span-3">
            <button type="button" className="text-primary" onClick={() => start(async () => { const r = await smsBalanceAction(); setBalance(r.ok ? r.data?.balance ?? null : null); })}>Balansni koʻrish</button>
            {balance !== undefined && <span className="ml-2">{balance === null ? 'aniqlab boʻlmadi' : `${balance.toLocaleString('ru-RU')} soʻm`}</span>}
          </div>
        </div>
      )}
    </Panel>
  );
}

export function SmsEventsSettings({ initial, canEdit }: { initial: SiteSettings['sms']; canEdit: boolean }) {
  const s = useSection('sms', initial);
  const v = s.value;
  const set = (p: Partial<typeof v>) => s.setValue({ ...v, ...p });
  const ev = (k: SmsEvent) => v.events[k] ?? { on: false, text: '' };
  const setEv = (k: SmsEvent, p: Partial<{ on: boolean; text: string }>) => set({ events: { ...v.events, [k]: { ...ev(k), ...p } } });
  return (
    <Panel title="Qachon SMS ketadi" subtitle="Eskiz har bir matnni shablon sifatida tasdiqlaydi: oʻzgartirsangiz, yangi matnni my.eskiz.uz → Shablonlar’da tasdiqlating">
      <SwitchRow label="SMS xabarlarni yoqish" checked={v.enabled} onChange={(x) => set({ enabled: x })} disabled={!canEdit} />
      <SwitchRow label="Faqat Telegram’ga ulanmagan mijozlarga" hint="Doʻkon botiga ulangan mijozlar xabarni Telegramda oladi — SMS pulini tejaydi" checked={v.only_without_telegram} onChange={(x) => set({ only_without_telegram: x })} disabled={!canEdit} />
      <ul className="mt-2 space-y-3">
        {SMS_EVENTS.map((e) => {
          const cur = ev(e.key);
          const text = cur.text || e.text;
          return (
            <li key={e.key} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{e.title}</p>
                <Toggle checked={cur.on} onChange={(x) => setEv(e.key, { on: x })} label={e.title} disabled={!canEdit} />
              </div>
              {cur.on && (
                <>
                  <Textarea rows={2} className="mt-2" value={text} maxLength={400} onChange={(x) => setEv(e.key, { text: x.target.value === e.text ? '' : x.target.value })} disabled={!canEdit} />
                  <p className="mt-1 text-xs text-ink-3">{e.vars.map((x) => `{{${x}}}`).join(' ')} · Namuna: {renderSms(text, SAMPLE)}</p>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit ? <SaveBar pending={s.pending} onSave={() => s.save()} /> : <p className="mt-3 text-xs text-ink-3">Oʻzgartirish uchun “Sozlamalar” ruxsati kerak.</p>}
    </Panel>
  );
}
