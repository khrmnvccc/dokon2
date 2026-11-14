'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, X } from 'lucide-react';
import { reviewReceipt } from '@/lib/actions/admin/orders';
import { formatDateTime } from '@/lib/format';
import { formatCardNumber, type PaymentCard } from '@/lib/payment-card';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { Textarea } from '@/components/ui/field';
import type { StaffReceipt } from '@/lib/payments/receipts';

const statusText = { submitted: 'Tekshirilmoqda', approved: 'Tasdiqlangan', rejected: 'Rad etilgan' } as const;
const statusTone = { submitted: 'warn', approved: 'success', rejected: 'danger' } as const;

/** Admin: kartaga toʻlov cheklari — rasm, tasdiqlash yoki sabab bilan rad etish. */
export function ReceiptReview({ orderId, card, receipts, paid, canWrite }: { orderId: string; card: PaymentCard; receipts: StaffReceipt[]; paid: boolean; canWrite: boolean }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const toast = useToast();
  const router = useRouter();

  const decide = (receiptId: string, approve: boolean) => start(async () => {
    const res = await reviewReceipt({ receiptId, orderId, approve, note: approve ? null : note });
    toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) { setRejecting(null); setNote(''); router.refresh(); }
  });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-ink-3">Karta: <span className="num font-medium text-ink-2">{formatCardNumber(card.number)}</span>{card.holder ? ` · ${card.holder}` : ''}</p>
      {paid ? (
        <p className="rounded-lg bg-success/10 px-3 py-2 font-medium text-success">Toʻlov tasdiqlangan — joʻnatish mumkin</p>
      ) : !receipts.length ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-ink-3">Mijoz hali chek yuklamagan. Chek tasdiqlanmaguncha buyurtmani “Yoʻlda”ga oʻtkazib boʻlmaydi.</p>
      ) : null}
      {receipts.map((r) => (
        <div key={r.id} className="overflow-hidden rounded-xl border border-line">
          {r.url ? (
            <a href={r.url} target="_blank" rel="noreferrer" className="group relative block bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.url} alt="Toʻlov cheki" className="max-h-80 w-full object-contain" />
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100"><ExternalLink className="size-3" /> Kattalashtirish</span>
            </a>
          ) : <p className="bg-surface-2 p-4 text-center text-ink-3">Rasm topilmadi</p>}
          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-ink-3">{formatDateTime(r.created_at)}</span>
              <Badge tone={statusTone[r.status]}>{statusText[r.status]}</Badge>
            </div>
            {r.note && <p className="text-ink-2">Sabab: {r.note}</p>}
            {r.status === 'submitted' && canWrite && (rejecting === r.id ? (
              <div className="space-y-2">
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: summa toʻliq emas / chek boshqa buyurtmaniki" maxLength={500} autoFocus />
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" loading={pending} disabled={!note.trim()} onClick={() => decide(r.id, false)}>Rad etish</Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => { setRejecting(null); setNote(''); }}>Bekor</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="success" className="flex-1" loading={pending} onClick={() => decide(r.id, true)}><Check className="size-4" /> Tasdiqlash</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(r.id)}><X className="size-4" /> Rad etish</Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
