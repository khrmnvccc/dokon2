'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import type { z } from 'zod';
import { trackSchema } from '@/lib/validation';
import { useApp } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/misc';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import { formatDateTime } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';
import { StatusTimeline } from './order-view';

interface Tracked {
  number: number; status: OrderStatus; total: number; items_count: number; shipping_method_name: string;
  tracking_number: string | null; created_at: string; history: { status: OrderStatus; created_at: string }[];
}

export function TrackForm() {
  const { price } = useApp();
  const [result, setResult] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof trackSchema>, unknown, z.output<typeof trackSchema>>({
    resolver: zodResolver(trackSchema),
  });

  const onSubmit = async (values: z.output<typeof trackSchema>) => {
    setError(null);
    setResult(null);
    const res = await fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(data?.error ?? 'Xatolik yuz berdi');
    else setResult(data.order);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-2xl bg-white p-4 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6" noValidate>
        <Field label="Buyurtma raqami" error={errors.number?.message} htmlFor="number">
          <Input id="number" inputMode="numeric" placeholder="100001" {...register('number')} />
        </Field>
        <Field label="Telefon" error={errors.phone?.message} htmlFor="phone">
          <Input id="phone" type="tel" placeholder="+998 90 123 45 67" {...register('phone')} />
        </Field>
        <Button type="submit" loading={isSubmitting}><Search className="h-4 w-4" /> Tekshirish</Button>
      </form>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="rounded-2xl bg-white p-4 shadow-card sm:p-6 animate-fade-in">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Buyurtma #{result.number}</h2>
              <p className="text-sm text-muted">{formatDateTime(result.created_at)} · {result.items_count} dona · {price(result.total)}</p>
            </div>
            <Badge tone={orderStatusTone[result.status]}>{orderStatusLabel[result.status]}</Badge>
          </div>
          <StatusTimeline status={result.status} history={result.history} />
          <p className="mt-4 text-sm text-muted">Yetkazib berish: {result.shipping_method_name}{result.tracking_number ? ` · Kuzatuv raqami: ${result.tracking_number}` : ''}</p>
        </div>
      )}
    </div>
  );
}
