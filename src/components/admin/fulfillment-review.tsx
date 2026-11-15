'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, ExternalLink, MapPin, Store, Truck } from 'lucide-react';
import { approveFulfillment } from '@/lib/actions/admin/orders';
import { formatDateTime, formatPrice } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';

export interface FulfillmentInfo {
  kind: 'delivery' | 'pickup';
  status: 'requested' | 'approved' | null;
  method: string;
  address: string;
  fee: number;
  requestedAt: string | null;
  hours?: string | null;
  mapUrl?: string | null;
}

/** Admin: mijozning yetkazish arizasi yoki olib ketish tanlovi — bir bosishda tasdiqlash. */
export function FulfillmentReview({ orderId, info, canApprove }: { orderId: string; info: FulfillmentInfo; canApprove: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const approved = info.status === 'approved';
  const pickup = info.kind === 'pickup';
  const approve = () => start(async () => {
    const res = await approveFulfillment(orderId);
    toast(res.ok ? res.message ?? 'Tasdiqlandi' : res.error, res.ok ? 'success' : 'error');
    if (res.ok) router.refresh();
  });
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-semibold">{pickup ? <Store className="size-4 text-primary" /> : <Truck className="size-4 text-primary" />}{pickup ? 'Oʻzi olib ketadi' : 'Yetkazishga ariza'}</span>
        <Badge tone={approved ? 'success' : 'warn'}>{approved ? 'Tasdiqlangan' : 'Kutilmoqda'}</Badge>
      </div>
      <dl className="space-y-1.5">
        <div><dt className="text-xs text-ink-3">{pickup ? 'Punkt' : 'Usul'}</dt><dd>{info.method}</dd></div>
        {info.address && <div><dt className="text-xs text-ink-3">Manzil</dt><dd className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-3" />{info.address}</dd></div>}
        {pickup && info.hours && <div><dt className="text-xs text-ink-3">Ish vaqti</dt><dd className="flex items-center gap-1.5"><Clock className="size-3.5 text-ink-3" />{info.hours}</dd></div>}
        {pickup && info.mapUrl && <a href={info.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary"><ExternalLink className="size-3.5" />Xaritada</a>}
        {!pickup && <div><dt className="text-xs text-ink-3">Yetkazish narxi</dt><dd>{info.fee > 0 ? `${formatPrice(info.fee, 'soʻm')} · yetkazganda olinadi` : 'Bepul'}</dd></div>}
        {info.requestedAt && <div><dt className="text-xs text-ink-3">Ariza vaqti</dt><dd>{formatDateTime(info.requestedAt)}</dd></div>}
      </dl>
      {!approved && canApprove && (
        <Button className="w-full" loading={pending} onClick={approve}><Check className="size-4" />{pickup ? 'Tayyor — mijozga xabar berish' : 'Arizani tasdiqlash'}</Button>
      )}
      {approved && <p className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">Mijozga xabar yuborilgan. Topshirilgach “Yetkazildi” holatiga oʻtkazing — mijozdan sharh soʻraladi.</p>}
    </div>
  );
}
