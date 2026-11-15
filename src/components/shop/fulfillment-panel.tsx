'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, ExternalLink, Hourglass, MapPin, PackageCheck, Pencil, Store, Truck } from 'lucide-react';
import { useApp, useL } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { cn } from '@/components/ui/cn';
import { UZ_REGIONS } from '@/lib/validation';
import { requestFulfillment } from '@/lib/actions/shop';
import type { Address, OrderAddress, ShippingMethod } from '@/lib/types';

export interface FulfillmentOrder {
  id: string;
  status: string;
  fulfillment: 'delivery' | 'pickup' | null;
  fulfillment_status: 'requested' | 'approved' | null;
  delivery_fee: number;
  shipping_method_id: string | null;
  shipping_method_name: string;
  address: OrderAddress | null;
  pickup: { name: string; address: string | null; map_url: string | null; hours: string | null } | null;
  subtotal: number;
  discount_total: number;
}

type PickupMethod = ShippingMethod & { pickup_address?: string | null; map_url?: string | null; work_hours?: string | null };

const addrLine = (a: Partial<OrderAddress> | null) => (a ? [a.region, a.city, a.street, a.apartment, a.landmark].filter(Boolean).join(', ') : '');

/**
 * Buyurtma “Oʻzbekistonda”: mijoz yetkazishga ariza qoldiradi yoki oʻzi olib ketishni tanlaydi.
 * Ariza yuborilgach — kutish, tasdiqlangach — natija koʻrsatiladi.
 */
export function FulfillmentPanel({ order, methods, addresses }: { order: FulfillmentOrder; methods: PickupMethod[]; addresses: Address[] }) {
  const L = useL();
  const [editing, setEditing] = useState(!order.fulfillment);

  if (order.status === 'delivered') {
    return (
      <Hero tone="green" icon={<PackageCheck className="size-6" />} title={L('Buyurtmangiz yetib bordi!')}
        text={L('Xaridingiz uchun rahmat. Pastda mahsulotlarga baho berib, sharh qoldiring ⭐️')} />
    );
  }
  if (order.status !== 'arrived') return null;

  if (order.fulfillment && !editing) {
    const approved = order.fulfillment_status === 'approved';
    const pickup = order.fulfillment === 'pickup';
    return (
      <Hero tone={approved ? 'green' : 'amber'} icon={approved ? <Check className="size-6" /> : <Hourglass className="size-6" />}
        title={approved
          ? (pickup ? L('Olib ketishga tayyor!') : L('Arizangiz tasdiqlandi — kuryer yoʻlga chiqadi'))
          : (pickup ? L('Tanlovingiz yuborildi — tayyorlanishini kuting') : L('Ariza yuborildi — tasdiqlanishini kuting'))}
        text={approved ? undefined : L('Tasdiqlanganda sizga xabar beramiz.')}>
        <div className="mt-3 space-y-1.5 rounded-xl bg-[var(--panel)] p-3 text-sm text-ink">
          <p className="flex items-start gap-2 font-semibold">{pickup ? <Store className="mt-0.5 size-4 shrink-0 text-primary" /> : <Truck className="mt-0.5 size-4 shrink-0 text-primary" />}{order.shipping_method_name}</p>
          {pickup ? (
            <>
              {order.pickup?.address && <p className="flex items-start gap-2 text-ink-2"><MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" />{order.pickup.address}</p>}
              {order.pickup?.hours && <p className="flex items-start gap-2 text-ink-2"><Clock className="mt-0.5 size-4 shrink-0 text-ink-3" />{order.pickup.hours}</p>}
              {order.pickup?.map_url && <a href={order.pickup.map_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-primary"><ExternalLink className="size-4" />{L('Xaritada ochish')}</a>}
            </>
          ) : (
            <>
              <p className="flex items-start gap-2 text-ink-2"><MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" />{addrLine(order.address)}</p>
              <p className="pl-6 text-ink-3">{L('Yetkazish')}: <b className="text-ink">{order.delivery_fee > 0 ? <Money v={order.delivery_fee} /> : L('Bepul')}</b>{order.delivery_fee > 0 && <> · {L('yetkazganda toʻlanadi')}</>}</p>
            </>
          )}
        </div>
        {!approved && (
          <button type="button" onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"><Pencil className="size-4" />{L('Oʻzgartirish')}</button>
        )}
      </Hero>
    );
  }

  return <ChooseForm order={order} methods={methods} addresses={addresses} onDone={() => setEditing(false)} />;
}

function Money({ v }: { v: number }) {
  const { price } = useApp();
  return <>{price(v)}</>;
}

function ChooseForm({ order, methods, addresses, onDone }: { order: FulfillmentOrder; methods: PickupMethod[]; addresses: Address[]; onDone: () => void }) {
  const L = useL();
  const { price } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const delivery = useMemo(() => methods.filter((m) => m.requires_address), [methods]);
  const pickups = useMemo(() => methods.filter((m) => !m.requires_address), [methods]);
  const [kind, setKind] = useState<'delivery' | 'pickup' | null>(order.fulfillment ?? (delivery.length ? null : pickups.length ? 'pickup' : null));
  const [methodId, setMethodId] = useState<string>(order.shipping_method_id ?? '');
  const [saved, setSaved] = useState<string>(order.address ? 'order' : addresses[0]?.id ?? 'new');
  const [addr, setAddr] = useState({ region: order.address?.region ?? 'Toshkent shahri', city: order.address?.city ?? '', street: order.address?.street ?? '', apartment: order.address?.apartment ?? '', landmark: order.address?.landmark ?? '' });
  const [err, setErr] = useState<string | null>(null);

  const afterDiscount = order.subtotal - order.discount_total;
  const fee = (m: ShippingMethod) => (m.free_from && afterDiscount >= m.free_from ? 0 : m.price);
  const minFee = delivery.length ? Math.min(...delivery.map(fee)) : 0;
  const list = kind === 'delivery' ? delivery : kind === 'pickup' ? pickups : [];
  const chosen = list.find((m) => m.id === methodId) ?? null;

  const pick = (k: 'delivery' | 'pickup') => {
    setKind(k);
    setErr(null);
    const l = k === 'delivery' ? delivery : pickups;
    if (!l.some((m) => m.id === methodId)) setMethodId(l.length === 1 ? l[0].id : '');
  };

  const submit = () => {
    setErr(null);
    if (!kind) return setErr(L('Tanlang: yetkazib berish yoki oʻzim olib ketaman'));
    if (!chosen) return setErr(kind === 'delivery' ? L('Yetkazish usulini tanlang') : L('Olib ketish joyini tanlang'));
    let address = null as null | typeof addr;
    if (kind === 'delivery') {
      const s = saved === 'order' || saved === 'new' ? null : addresses.find((a) => a.id === saved) ?? null;
      address = s ? { region: s.region, city: s.city ?? '', street: s.street, apartment: s.apartment ?? '', landmark: s.landmark ?? '' } : addr;
      if (!address.street.trim() || address.street.trim().length < 3) return setErr(L('Manzilni kiriting'));
    }
    start(async () => {
      const res = await requestFulfillment(kind === 'delivery' ? { orderId: order.id, kind, methodId: chosen.id, address } : { orderId: order.id, kind, methodId: chosen.id });
      if (!res.ok) { setErr(L(res.error)); return; }
      toast(L(res.message ?? 'Yuborildi'), 'success');
      onDone();
      router.refresh();
    });
  };

  return (
    <Hero tone="blue" icon={<span className="text-2xl leading-none">🇺🇿</span>} title={L('Buyurtmangiz Oʻzbekistonda!')}
      text={L('Yetkazib berishga ariza qoldirishingiz mumkin. Shu bilan birga oʻzingiz olib ketishingiz ham mumkin.')}>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Choice active={kind === 'delivery'} disabled={!delivery.length} onClick={() => pick('delivery')} icon={<Truck className="size-6" />}
          title={L('Yetkazib berish')} sub={delivery.length ? (minFee > 0 ? `${price(minFee)} ${L('dan')}` : L('Bepul')) : L('Mavjud emas')} />
        <Choice active={kind === 'pickup'} disabled={!pickups.length} onClick={() => pick('pickup')} icon={<Store className="size-6" />}
          title={L('Oʻzim olib ketaman')} sub={pickups.length ? L('Bepul') : L('Mavjud emas')} />
      </div>

      {kind && list.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{kind === 'delivery' ? L('Yetkazish usuli') : L('Qayerdan olib ketasiz')}</p>
          {list.map((m) => {
            const where = m.pickup_address || m.description;
            return (
              <label key={m.id} className={cn('flex cursor-pointer gap-3 rounded-2xl border-2 bg-[var(--panel)] p-3 text-ink transition', methodId === m.id ? 'border-primary' : 'border-line hover:border-line-strong')}>
                <input type="radio" name="fulfill-method" className="sr-only" checked={methodId === m.id} onChange={() => setMethodId(m.id)} />
                <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2', methodId === m.id ? 'border-primary bg-primary text-primary-fg' : 'border-line-strong')}>{methodId === m.id && <Check className="size-3" strokeWidth={3} />}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="flex justify-between gap-2 font-semibold">{m.name}<span className="shrink-0">{kind === 'pickup' || fee(m) === 0 ? L('Bepul') : price(fee(m))}</span></span>
                  {kind === 'delivery' && m.eta && <span className="block text-xs text-ink-3">{m.eta}</span>}
                  {kind === 'delivery' && m.description && <span className="block text-xs text-ink-3">{m.description}</span>}
                  {kind === 'pickup' && where && <span className="mt-0.5 flex items-start gap-1 text-xs text-ink-2"><MapPin className="mt-px size-3.5 shrink-0 text-ink-3" />{where}</span>}
                  {kind === 'pickup' && m.work_hours && <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-3"><Clock className="size-3.5 shrink-0" />{m.work_hours}</span>}
                  {kind === 'pickup' && m.map_url && <a href={m.map_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"><ExternalLink className="size-3.5" />{L('Xaritada ochish')}</a>}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {kind === 'delivery' && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{L('Manzil')}</p>
          {(addresses.length > 0 || order.address) && (
            <div className="space-y-2">
              {order.address && (
                <SavedRow active={saved === 'order'} onClick={() => setSaved('order')} text={addrLine(order.address)} />
              )}
              {addresses.map((a) => <SavedRow key={a.id} active={saved === a.id} onClick={() => setSaved(a.id)} text={`${a.label ? `${a.label}: ` : ''}${addrLine(a)}`} />)}
              <SavedRow active={saved === 'new'} onClick={() => setSaved('new')} text={L('Yangi manzil')} />
            </div>
          )}
          {(saved === 'new' || saved === 'order') && (
            <div className="grid gap-3 rounded-2xl bg-[var(--panel)] p-3 text-ink sm:grid-cols-2">
              <Field label={L('Viloyat')} required htmlFor="f-region">
                <Select id="f-region" value={addr.region} onChange={(e) => setAddr({ ...addr, region: e.target.value })}>
                  {UZ_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label={L('Tuman / shahar')} htmlFor="f-city"><Input id="f-city" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></Field>
              <Field label={L('Koʻcha, uy')} required htmlFor="f-street" className="sm:col-span-2"><Input id="f-street" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} /></Field>
              <Field label={L('Xonadon / ofis')} htmlFor="f-apt"><Input id="f-apt" value={addr.apartment} onChange={(e) => setAddr({ ...addr, apartment: e.target.value })} /></Field>
              <Field label={L('Mo‘ljal')} htmlFor="f-lm"><Input id="f-lm" placeholder={L('Masalan: maktab yonida')} value={addr.landmark} onChange={(e) => setAddr({ ...addr, landmark: e.target.value })} /></Field>
            </div>
          )}
          {chosen && <p className="text-xs text-ink-3">{L('Yetkazish narxi')}: <b className="text-ink">{fee(chosen) ? price(fee(chosen)) : L('Bepul')}</b>{fee(chosen) > 0 && ` · ${L('yetkazganda toʻlanadi')}`}</p>}
        </div>
      )}

      {err && <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{err}</p>}
      {kind && (
        <Button type="button" size="lg" className="mt-4 w-full" loading={pending} onClick={submit}>
          {kind === 'delivery' ? L('Ariza yuborish') : L('Shu yerdan olib ketaman')}
        </Button>
      )}
      {order.fulfillment && <button type="button" onClick={onDone} className="mt-2 w-full text-center text-sm font-medium text-ink-3">{L('Bekor qilish')}</button>}
    </Hero>
  );
}

function SavedRow({ active, onClick, text }: { active: boolean; onClick: () => void; text: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-start gap-3 rounded-2xl border-2 bg-[var(--panel)] p-3 text-left text-sm text-ink', active ? 'border-primary' : 'border-line')}>
      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{text}
    </button>
  );
}

function Choice({ active, disabled, onClick, icon, title, sub }: { active: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn('flex flex-col items-start gap-2 rounded-2xl border-2 bg-[var(--panel)] p-3.5 text-left text-ink transition active:scale-[0.98] disabled:opacity-50',
        active ? 'border-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_15%,transparent)]' : 'border-line hover:border-line-strong')}>
      <span className={cn('flex size-11 items-center justify-center rounded-xl', active ? 'bg-primary text-primary-fg' : 'bg-primary/10 text-primary')}>{icon}</span>
      <span className="text-[15px] font-semibold leading-tight">{title}</span>
      <span className="text-xs text-ink-3">{sub}</span>
    </button>
  );
}

const TONES = {
  blue: 'from-[#e8f2ff] to-[#f5f9ff] border-[#cfe3ff] dark:from-[#10233d] dark:to-[#0d1a2c] dark:border-[#1d3a5f]',
  amber: 'from-[#fff6e5] to-[#fffaf0] border-[#ffe2a8] dark:from-[#2e2410] dark:to-[#211a0c] dark:border-[#4a3a17]',
  green: 'from-[#e7f8ee] to-[#f3fcf6] border-[#bfe9cf] dark:from-[#0f2a1b] dark:to-[#0b1f14] dark:border-[#1d4a31]',
} as const;
const ICON_TONES = { blue: 'bg-[#2a7de1] text-white', amber: 'bg-[#f59e0b] text-white', green: 'bg-[#1fa45a] text-white' } as const;

function Hero({ tone, icon, title, text, children }: { tone: keyof typeof TONES; icon: React.ReactNode; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <section className={cn('rounded-[22px] border bg-gradient-to-br p-4 shadow-soft sm:p-5', TONES[tone])}>
      <div className="flex items-start gap-3">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', ICON_TONES[tone])}>{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-ink">{title}</h2>
          {text && <p className="mt-0.5 text-sm text-ink-2">{text}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
