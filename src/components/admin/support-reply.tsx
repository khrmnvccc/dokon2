'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { replySupport } from '@/lib/actions/admin/support';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';

export function SupportReply({ chatId }: { chatId: number }) {
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const send = () => start(async () => {
    const res = await replySupport(chatId, text);
    if (!res.ok) { toast(res.error, 'error'); return; }
    setText('');
    router.refresh();
  });
  return (
    <form className="flex items-end gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(); }}>
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={3500} placeholder="Javob yozing…" className="min-h-[44px] flex-1 resize-none"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) { e.preventDefault(); send(); } }} />
      <Button type="submit" loading={pending} disabled={!text.trim()} aria-label="Yuborish"><Send className="size-4" /> Yuborish</Button>
    </form>
  );
}

/** Mijoz ID (kabinetdagi raqam) boʻyicha suhbatni ochish — oʻzingiz birinchi yozish uchun. */
export function ClientIdJump({ notFound }: { notFound: string | null }) {
  const [id, setId] = useState('');
  const router = useRouter();
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (/^\d+$/.test(id)) router.push(`/admin/support?client=${id}`); }}>
      <div className="w-56"><Input value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Mijoz ID (masalan 1024)" aria-label="Mijoz ID" /></div>
      <Button type="submit" variant="secondary" disabled={!id}>Yozish</Button>
      {notFound && <span className="text-sm text-danger">ID {notFound}: mijoz topilmadi yoki doʻkon botini ochmagan</span>}
    </form>
  );
}
