'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, RefreshCw, Send } from 'lucide-react';
import { checkMyTelegram, unlinkMyTelegram } from '@/lib/actions/admin/telegram';
import { useToast } from '@/components/ui/toast';
import { Button, buttonClass } from '@/components/ui/button';
import { Panel } from './ui';

export function MyTelegram({ botName, linked, chatName, code, messages }: { botName: string; linked: boolean; chatName: string | null; code: string | null; messages: string[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: typeof checkMyTelegram) => start(async () => {
    const res = await fn();
    toast(res.ok ? res.message ?? 'Bajarildi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) router.refresh();
  });
  return (
    <Panel className="max-w-xl">
      {linked ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-success" />
            <div><div className="font-semibold">Ulangan: {chatName}</div><div className="text-xs text-ink-3">@{botName}</div></div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Sizga keladigan xabarlar</div>
            {messages.length ? <ul className="list-disc pl-5 text-sm">{messages.map((m) => <li key={m}>{m}</li>)}</ul>
              : <p className="text-sm text-ink-3">Hozircha yoʻq — Ega “Telegram → Xabarlar va Push” boʻlimida belgilaydi.</p>}
          </div>
          <Button variant="ghost" loading={pending} onClick={() => run(unlinkMyTelegram)}>Uzish</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">Botni oching va <b>Start</b> bosing — kod avtomatik ketadi. Keyin “Tekshirish”ni bosing.</p>
          <div className="num rounded-[var(--r-md)] bg-surface-2 py-3 text-center text-xl font-semibold tracking-[0.15em]">{code}</div>
          <div className="flex flex-wrap gap-2">
            <a className={buttonClass("primary", "md")} href={`https://t.me/${botName}?start=${code}`} target="_blank" rel="noreferrer">
              <Send className="size-4" /> @{botName} ni ochish
            </a>
            <Button variant="secondary" loading={pending} onClick={() => run(checkMyTelegram)}><RefreshCw className="size-4" /> Tekshirish</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
