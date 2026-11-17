'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import type { z } from 'zod';
import { trackSchema } from '@/lib/validation';
import { useApp, useL } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/misc';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import { formatDateTime } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';
import { StatusTimeline } from './order-view';
import { CargoTimeline, type CargoStageDef } from './cargo-timeline';
import { cn } from '@/components/ui/cn';

interface Tracked {
  number: number; status: OrderStatus; total?: number; items_count?: number; shipping_method_name?: string;
  tracking_number: string | null; created_at: string; history?: { status: OrderStatus; created_at: string }[];
  cargo_stage?: string | null; cargo?: { stage: string; note: string | null; created_at: string }[];
}

export interface TrackCargo { enabled: boolean; byNumber: boolean; stages: CargoStageDef[]; carrierUrl: string }

export function TrackForm({ cargo }: { cargo?: TrackCargo }) {
  const L = useL();
  const { price, lang } = useApp();
  const byTrack = Boolean(cargo?.enabled && cargo.byNumber);
  const [mode, setMode] = useState<'order' | 'track'>('order');
  const [track, setTrack] = useState('');
  const [busy, setBusy] = useState(false);
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
    if (!res?.ok) setError(data?.error ?? L("Xatolik yuz berdi"));
    else setResult(data.order);
  };

  const onTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    const res = await fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ track }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) setError(data?.error ?? L("Xatolik yuz berdi"));
    else setResult(data.order);
  };

  return (
    <div className="space-y-4">
      {byTrack && (
        <div className="inline-flex rounded-xl bg-surface-2 p-1 text-sm font-medium">
          {(['order', 'track'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setResult(null); setError(null); }}
              className={cn('rounded-lg px-3 py-1.5', mode === m ? 'bg-surface shadow-soft' : 'text-ink-3')}>
              {m === 'order' ? L('Buyurtma raqami bilan') : L('Trek raqami bilan')}
            </button>
          ))}
        </div>
      )}
      {mode === 'track' && byTrack ? (
        <form onSubmit={onTrack} className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-soft sm:grid-cols-[1fr_auto] sm:items-end sm:p-6" noValidate>
          <Field label={L("Trek raqami")} htmlFor="trek">
            <Input id="trek" value={track} onChange={(e) => setTrack(e.target.value)} placeholder="YT1234567890" maxLength={80} autoComplete="off" />
          </Field>
          <Button type="submit" loading={busy} disabled={track.trim().length < 4}><Search className="h-4 w-4" /> {L("Tekshirish")}</Button>
        </form>
      ) : (
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-soft sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6" noValidate>
        <Field label={L("Buyurtma raqami")} error={(L(errors.number?.message ?? '') || undefined)} htmlFor="number">
          <Input id="number" inputMode="numeric" placeholder="100001" {...register('number')} />
        </Field>
        <Field label={L("Telefon")} error={(L(errors.phone?.message ?? '') || undefined)} htmlFor="phone">
          <Input id="phone" type="tel" placeholder="+998 90 123 45 67" {...register('phone')} />
        </Field>
        <Button type="submit" loading={isSubmitting}><Search className="h-4 w-4" /> {L("Tekshirish")}</Button>
      </form>
      )}
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      {result && (
        <div className="rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-6 anim-fade">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">{L('Buyurtma')} #{result.number}</h2>
              <p className="text-sm text-ink-3">{formatDateTime(result.created_at)}{result.total !== undefined ? ` · ${result.items_count} ${L('dona')} · ${price(result.total)}` : ''}</p>
            </div>
            <Badge tone={orderStatusTone[result.status]}>{L(orderStatusLabel[result.status])}</Badge>
          </div>
          <StatusTimeline status={result.status} history={result.history ?? []} lang={lang} />
          {result.shipping_method_name && <p className="mt-4 text-sm text-ink-3">{L('Yetkazib berish')}: {L(result.shipping_method_name)}{result.tracking_number ? ` · ${L('Kuzatuv raqami:')} ${result.tracking_number}` : ''}</p>}
        </div>
      )}
      {result && cargo?.enabled && result.status !== 'cancelled' && result.status !== 'returned' && (
        <CargoTimeline stages={cargo.stages} events={result.cargo ?? []} current={result.cargo_stage ?? null} tracking={result.tracking_number} carrierUrl={cargo.carrierUrl} lang={lang} />
      )}
    </div>
  );
}
