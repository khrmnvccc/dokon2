'use client';

import { useState, useTransition } from 'react';
import { MessageSquareReply } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { moderateReview, replyReview } from '@/lib/actions/admin/people';
import { Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ReviewActions({ id, approved }: { id: string; approved: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const run = (a: 'approve' | 'hide' | 'delete') => start(async () => {
    const res = await moderateReview(id, a);
    toast(res.ok ? res.message ?? 'Bajarildi' : res.error, res.ok ? 'success' : 'error');
    router.refresh();
  });
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" loading={pending} onClick={() => run(approved ? 'hide' : 'approve')}>{approved ? 'Yashirish' : 'Ko‘rsatish'}</Button>
      <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={async () => { if (await confirm({ title: 'Sharhni o‘chirish?', danger: true, confirmText: 'O‘chirish' })) run('delete'); }}>O‘chirish</Button>
    </div>
  );
}

/** Sharhga doʻkon javobi: yozish, tahrirlash, oʻchirish. */
export function ReviewReply({ id, reply }: { id: string; reply: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(reply ?? '');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const save = (value: string) => start(async () => {
    const res = await replyReview(id, value);
    toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) { setOpen(false); router.refresh(); }
  });
  if (!open) {
    return reply ? (
      <div className="mt-3 rounded-lg border-l-2 border-primary bg-primary-soft/40 px-3 py-2 text-sm">
        <p className="text-xs font-semibold text-primary">Doʻkon javobi</p>
        <p className="whitespace-pre-line text-ink-2">{reply}</p>
        <button type="button" className="mt-1 text-xs font-medium text-primary hover:underline" onClick={() => setOpen(true)}>Tahrirlash</button>
      </div>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <MessageSquareReply className="size-4" /> Javob yozish
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} autoFocus placeholder="Masalan: Rahmat! Sizni yana kutib qolamiz" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={pending} disabled={!text.trim()} onClick={() => save(text)}>Javobni saqlash</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => { setOpen(false); setText(reply ?? ''); }}>Bekor</Button>
        {reply && <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => save('')}>Javobni oʻchirish</Button>}
      </div>
    </div>
  );
}
