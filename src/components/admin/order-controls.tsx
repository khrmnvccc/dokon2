'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrder } from '@/lib/actions/admin/orders';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/order-status';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

export function OrderControls({ orderId, status, nextStatuses, paymentStatus, trackingNumber, adminNote, canWrite, canFulfill }: {
  orderId: string; status: OrderStatus; nextStatuses: OrderStatus[]; paymentStatus: PaymentStatus; trackingNumber: string | null;
  adminNote: string | null; canWrite: boolean; canFulfill: boolean;
}) {
  const [next, setNext] = useState<OrderStatus | ''>(nextStatuses[0] ?? '');
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState(trackingNumber ?? '');
  const [internal, setInternal] = useState(adminNote ?? '');
  const [payment, setPayment] = useState<PaymentStatus>(paymentStatus);
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();

  const submit = (payload: Parameters<typeof updateOrder>[0]) =>
    start(async () => {
      const res = await updateOrder(payload);
      toast(res.ok ? res.message ?? 'Saqlandi' : res.error, res.ok ? 'success' : 'error');
      if (res.ok) {
        setNote('');
        router.refresh();
      }
    });

  return (
    <div className="space-y-5">
      {nextStatuses.length > 0 ? (
        <div className="space-y-3">
          <Field label="Yangi holat" htmlFor="next-status">
            <Select id="next-status" value={next} onChange={(e) => setNext(e.target.value as OrderStatus)}>
              {nextStatuses.map((s) => <option key={s} value={s}>{orderStatusLabel[s]}</option>)}
            </Select>
          </Field>
          <Field label={next === 'cancelled' ? 'Bekor qilish sababi (majburiy)' : 'Izoh (mijozga ko‘rinadi)'} htmlFor="status-note">
            <Input id="status-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          <Button className="w-full" variant={next === 'cancelled' || next === 'returned' ? 'danger' : 'primary'} loading={pending} disabled={!next}
            onClick={async () => {
              if ((next === 'cancelled' || next === 'returned') && !(await confirm({ title: `Buyurtmani “${orderStatusLabel[next]}” holatiga o‘tkazish?`, text: 'Mahsulotlar omborga qaytariladi. Bu amalni ortga qaytarib bo‘lmaydi.', danger: true }))) return;
              submit({ orderId, status: next || null, note });
            }}>
            {status === 'new' && next === 'confirmed' ? 'Tasdiqlash' : `“${next ? orderStatusLabel[next] : ''}” holatiga o‘tkazish`}
          </Button>
        </div>
      ) : (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted">Bu holatdan keyingi o‘zgarish yo‘q yoki sizda ruxsat yo‘q.</p>
      )}

      {canFulfill && (
        <div className="space-y-2 border-t border-line pt-4">
          <Field label="Kuzatuv (trek) raqami" htmlFor="tracking">
            <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} />
          </Field>
          <Button size="sm" variant="outline" loading={pending} disabled={tracking === (trackingNumber ?? '')} onClick={() => submit({ orderId, tracking_number: tracking })}>Saqlash</Button>
        </div>
      )}

      {canWrite && (
        <div className="space-y-3 border-t border-line pt-4">
          <Field label="To‘lov holati" htmlFor="pay">
            <Select id="pay" value={payment} onChange={(e) => setPayment(e.target.value as PaymentStatus)}>
              {(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((s) => <option key={s} value={s}>{paymentStatusLabel[s]}</option>)}
            </Select>
          </Field>
          <Field label="Ichki izoh (mijozga ko‘rinmaydi)" htmlFor="admin-note">
            <Textarea id="admin-note" rows={3} value={internal} onChange={(e) => setInternal(e.target.value)} maxLength={2000} />
          </Field>
          <Button size="sm" variant="outline" loading={pending} disabled={payment === paymentStatus && internal === (adminNote ?? '')}
            onClick={() => submit({ orderId, payment_status: payment !== paymentStatus ? payment : null, admin_note: internal })}>
            Saqlash
          </Button>
        </div>
      )}
    </div>
  );
}
