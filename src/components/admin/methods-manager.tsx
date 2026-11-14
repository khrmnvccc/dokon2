'use client';

import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { AlertTriangle, Plus } from 'lucide-react';
import { paymentMethodSchema, shippingMethodSchema } from '@/lib/admin/schemas';
import { formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/misc';
import { MoveButtons, RowActions, Toggle, useCrud } from './crud-kit';
import { Panel } from './ui';
import type { PaymentMethod, ShippingMethod } from '@/lib/types';
import { CARD_THEMES, CARD_THEME_KEYS, cleanCard, formatCardNumber, type CardTheme } from '@/lib/payment-card';
import { CardVisual } from '@/components/payment/card-visual';

const kindLabel = { courier: 'Kuryer', pickup: 'Olib ketish', post: 'Pochta' } as const;
const payKindLabel = { cash: 'Naqd', card_on_delivery: 'Karta (qabulda)', bank_transfer: 'Kartaga / bank o‘tkazmasi', online: 'Onlayn' } as const;

export function MethodsManager({ shipping, payment, configured }: { shipping: ShippingMethod[]; payment: PaymentMethod[]; configured: Record<string, boolean> }) {
  const ship = useCrud('shipping_methods');
  const pay = useCrud('payment_methods');
  const [editShip, setEditShip] = useState<ShippingMethod | 'new' | null>(null);
  const [editPay, setEditPay] = useState<PaymentMethod | 'new' | null>(null);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Yetkazib berish usullari" padded={false} actions={<Button size="sm" variant="secondary" onClick={() => setEditShip('new')}><Plus className="h-4 w-4" /> Qo‘shish</Button>}>
        <ul>
          {shipping.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
              <MoveButtons list={shipping} index={i} onReorder={ship.reorder} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.name} <Badge className="ml-1">{kindLabel[m.kind]}</Badge></p>
                <p className="text-xs text-ink-3">{m.kind === 'pickup' || m.price === 0 ? 'Bepul' : formatPrice(m.price)}{m.free_from ? ` · ${formatPrice(m.free_from)} dan bepul` : ''}{m.eta ? ` · ${m.eta}` : ''}</p>
              </div>
              <Toggle checked={m.is_active} label="Faol" onChange={(v) => ship.toggle(m.id, v)} />
              <RowActions onEdit={() => setEditShip(m)} onDelete={() => ship.remove(m.id)} />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="To‘lov usullari" padded={false} actions={<Button size="sm" variant="secondary" onClick={() => setEditPay('new')}><Plus className="h-4 w-4" /> Qo‘shish</Button>}>
        <ul>
          {payment.map((m, i) => {
            const notConnected = m.kind === 'online' && !(m.provider && configured[m.provider]);
            return (
              <li key={m.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <MoveButtons list={payment} index={i} onReorder={pay.reorder} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.name} <Badge className="ml-1">{payKindLabel[m.kind]}</Badge></p>
                  {notConnected ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-warn"><AlertTriangle className="h-3.5 w-3.5" /> Ulanmagan — checkout’da ko‘rinmaydi (README: to‘lov integratsiyasi)</p>
                  ) : (() => {
                    const card = m.kind === 'bank_transfer' ? cleanCard(m.card) : null;
                    return card
                      ? <p className="num text-xs text-ink-3">Karta: {formatCardNumber(card.number)}{card.holder ? ` · ${card.holder}` : ''} · chek bilan tasdiqlanadi</p>
                      : m.description && <p className="text-xs text-ink-3">{m.description}</p>;
                  })()}
                </div>
                <Toggle checked={m.is_active} label="Faol" onChange={(v) => pay.toggle(m.id, v)} />
                <RowActions onEdit={() => setEditPay(m)} onDelete={() => pay.remove(m.id)} />
              </li>
            );
          })}
        </ul>
      </Panel>
      <Modal open={editShip !== null} onClose={() => setEditShip(null)} title="Yetkazib berish usuli" className="max-w-xl">
        {editShip !== null && <ShippingForm method={editShip === 'new' ? null : editShip} count={shipping.length} onDone={() => setEditShip(null)} save={ship.save} />}
      </Modal>
      <Modal open={editPay !== null} onClose={() => setEditPay(null)} title="To‘lov usuli" className="max-w-xl">
        {editPay !== null && <PaymentForm method={editPay === 'new' ? null : editPay} count={payment.length} onDone={() => setEditPay(null)} save={pay.save} />}
      </Modal>
    </div>
  );
}

function ShippingForm({ method, count, onDone, save }: { method: ShippingMethod | null; count: number; onDone: () => void; save: ReturnType<typeof useCrud>['save'] }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.input<typeof shippingMethodSchema>, unknown, z.output<typeof shippingMethodSchema>>({
    resolver: zodResolver(shippingMethodSchema),
    defaultValues: method ? { ...method, description: method.description ?? '', eta: method.eta ?? '', free_from: method.free_from ?? '' } : { name: '', kind: 'courier', price: 0, free_from: '', requires_address: true, is_active: true, sort_order: count * 10 },
  });
  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (d) => { if (await save(method?.id ?? null, d, setError)) onDone(); })}>
      <Field label="Nomi" required error={errors.name?.message} htmlFor="s-name"><Input id="s-name" {...register('name')} /></Field>
      <Field label="Turi" htmlFor="s-kind"><Select id="s-kind" {...register('kind')}>{Object.entries(kindLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      <Field label="Narxi (so‘m)" error={errors.price?.message} htmlFor="s-price"><Input id="s-price" inputMode="numeric" {...register('price')} /></Field>
      <Field label="Bepul bo‘ladigan summa" hint="Bo‘sh — umumiy sozlamadagi chegara" htmlFor="s-free"><Input id="s-free" inputMode="numeric" {...register('free_from')} /></Field>
      <Field label="Muddat" hint="Masalan: 1–2 kun" htmlFor="s-eta"><Input id="s-eta" {...register('eta')} /></Field>
      <Field label="Tavsif" htmlFor="s-desc"><Input id="s-desc" {...register('description')} /></Field>
      <Checkbox label="Manzil talab qilinadi" {...register('requires_address')} />
      <Checkbox label="Faol" {...register('is_active')} />
      <input type="hidden" {...register('sort_order')} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" loading={isSubmitting}>Saqlash</Button>
      </div>
    </form>
  );
}

type PayFormIn = Omit<z.input<typeof paymentMethodSchema>, 'card'> & { card: { number: string; holder: string; bank: string; theme: CardTheme } };

function PaymentForm({ method, count, onDone, save }: { method: PaymentMethod | null; count: number; onDone: () => void; save: ReturnType<typeof useCrud>['save'] }) {
  const card = cleanCard(method?.card);
  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<PayFormIn, unknown, z.output<typeof paymentMethodSchema>>({
    resolver: zodResolver(paymentMethodSchema) as unknown as Resolver<PayFormIn, unknown, z.output<typeof paymentMethodSchema>>,
    defaultValues: {
      ...(method ? { ...method, description: method.description ?? '', instructions: method.instructions ?? '', provider: method.provider ?? '' } : { code: '', name: '', kind: 'cash', provider: '', is_active: true, sort_order: count * 10 }),
      card: { number: card ? formatCardNumber(card.number) : '', holder: card?.holder ?? '', bank: card?.bank ?? '', theme: card?.theme ?? 'dark' },
    },
  });
  const kind = watch('kind');
  const c = watch('card');
  const cardErr = errors.card ?? {};
  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (d) => { if (await save(method?.id ?? null, d, setError)) onDone(); })}>
      <Field label="Nomi" required error={errors.name?.message} htmlFor="pm-name"><Input id="pm-name" {...register('name')} /></Field>
      <Field label="Kod" required error={errors.code?.message} htmlFor="pm-code"><Input id="pm-code" readOnly={Boolean(method)} {...register('code')} /></Field>
      <Field label="Turi" htmlFor="pm-kind"><Select id="pm-kind" {...register('kind')}>{Object.entries(payKindLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      {kind === 'online' && (
        <Field label="Provayder" error={errors.provider?.message} htmlFor="pm-prov" hint="Integratsiya va kalitlarsiz checkout’da ko‘rinmaydi">
          <Select id="pm-prov" {...register('provider')}><option value="">—</option><option value="click">Click</option><option value="payme">Payme</option><option value="uzum">Uzum</option></Select>
        </Field>
      )}
      {kind === 'bank_transfer' && (
        <div className="grid gap-4 rounded-xl border border-line bg-surface-2/50 p-4 sm:col-span-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold">Karta (mijozga shunday koʻrinadi)</p>
            <p className="text-xs text-ink-3">Mijoz pul oʻtkazib, chek rasmini yuklaydi. Siz chekni tasdiqlamaguningizcha buyurtmani “Yoʻlda”ga oʻtkazib boʻlmaydi. Raqamni boʻsh qoldirsangiz, karta va chek yuklash chiqmaydi.</p>
          </div>
          <Field label="Karta raqami" error={cardErr.number?.message} htmlFor="pm-cnum">
            <Input id="pm-cnum" inputMode="numeric" autoComplete="off" placeholder="8600 0000 0000 0000" {...register('card.number', {
              onChange: (e) => setValue('card.number', formatCardNumber(String(e.target.value)).slice(0, 23)),
            })} />
          </Field>
          <Field label="Karta egasi" hint="Masalan: ALIYEV ALI" htmlFor="pm-chold"><Input id="pm-chold" {...register('card.holder')} /></Field>
          <Field label="Bank / karta turi" hint="Masalan: Uzcard, Humo, Kapitalbank" htmlFor="pm-cbank"><Input id="pm-cbank" {...register('card.bank')} /></Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">Rang</p>
            <div className="flex flex-wrap gap-2">
              {CARD_THEME_KEYS.map((k) => (
                <button key={k} type="button" title={CARD_THEMES[k].label} aria-pressed={c.theme === k} onClick={() => setValue('card.theme', k)}
                  className={`size-8 rounded-full ring-offset-2 ring-offset-surface ${c.theme === k ? 'ring-2 ring-primary' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${CARD_THEMES[k].bg[0]}, ${CARD_THEMES[k].bg[1]})` }} />
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <CardVisual card={{ number: (c.number ?? '').replace(/\D/g, '') || '0000000000000000', holder: c.holder ?? '', bank: c.bank ?? '', theme: c.theme ?? 'dark' }} />
          </div>
        </div>
      )}
      <Field label="Tavsif" className="sm:col-span-2" htmlFor="pm-desc"><Input id="pm-desc" {...register('description')} /></Field>
      <Field label="Ko‘rsatma" hint="Masalan: bank rekvizitlari" className="sm:col-span-2" htmlFor="pm-ins"><Textarea id="pm-ins" rows={3} {...register('instructions')} /></Field>
      <Checkbox label="Faol" {...register('is_active')} />
      <input type="hidden" {...register('sort_order')} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" loading={isSubmitting}>Saqlash</Button>
      </div>
    </form>
  );
}
