'use client';

import { useL } from '@/components/providers';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { cancelMyOrder, deleteAddress, saveAddress, updateProfile } from '@/lib/actions/shop';
import { profileSchema, savedAddressSchema, UZ_REGIONS } from '@/lib/validation';
import { formatUzPhone } from '@/lib/phone';
import { useToast } from '@/components/ui/toast';
import { useConfirm, Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/misc';
import type { Address } from '@/lib/types';

export function ProfileForm({ defaults, email }: { defaults: { full_name: string; phone: string }; email: string }) {
  const L = useL();
  const toast = useToast();
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting, isDirty } } = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });
  return (
    <form className="grid max-w-xl gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (v) => {
      const res = await updateProfile(v);
      if (res.ok) {
        toast(res.message ?? L("Saqlandi"));
        router.refresh();
      } else {
        toast(res.error, 'error');
        for (const [k, m] of Object.entries(res.fieldErrors ?? {})) setError(k as 'phone', { message: m });
      }
    })}>
      <Field label={L("Ism va familiya")} error={(L(errors.full_name?.message ?? '') || undefined)} htmlFor="full_name"><Input id="full_name" {...register('full_name')} /></Field>
      <Field label={L("Telefon")} error={(L(errors.phone?.message ?? '') || undefined)} htmlFor="phone"><Input id="phone" type="tel" {...register('phone')} /></Field>
      <Field label={L("Email")} hint={L("Emailni o‘zgartirib bo‘lmaydi")} className="sm:col-span-2"><Input value={email} disabled readOnly /></Field>
      <div className="sm:col-span-2"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>{L("Saqlash")}</Button></div>
    </form>
  );
}

type AddrIn = z.input<typeof savedAddressSchema>;
type AddrOut = z.output<typeof savedAddressSchema>;

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const L = useL();
  const toast = useToast();
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<AddrIn, unknown, AddrOut>({
    resolver: zodResolver(savedAddressSchema),
    defaultValues: address
      ? { ...address, phone: formatUzPhone(address.phone) }
      : { region: L("Toshkent shahri"), full_name: '', phone: '', street: '', is_default: false },
  });
  return (
    <form className="grid gap-3 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (v) => {
      const res = await saveAddress(v, address?.id);
      if (res.ok) {
        toast(res.message ?? L("Saqlandi"));
        router.refresh();
        onDone();
      } else {
        toast(res.error, 'error');
        for (const [k, m] of Object.entries(res.fieldErrors ?? {})) setError(k as 'street', { message: m });
      }
    })}>
      <Field label="Nomi" hint="Masalan: Uy, Ish" htmlFor="label"><Input id="label" {...register('label')} /></Field>
      <Field label={L("Qabul qiluvchi")} error={(L(errors.full_name?.message ?? '') || undefined)} htmlFor="full_name"><Input id="full_name" {...register('full_name')} /></Field>
      <Field label={L("Telefon")} error={(L(errors.phone?.message ?? '') || undefined)} htmlFor="aphone"><Input id="aphone" type="tel" {...register('phone')} /></Field>
      <Field label={L("Viloyat")} error={(L(errors.region?.message ?? '') || undefined)} htmlFor="region">
        <Select id="region" {...register('region')}>{UZ_REGIONS.map((r) => <option key={r}>{r}</option>)}</Select>
      </Field>
      <Field label="Tuman / shahar" htmlFor="city"><Input id="city" {...register('city')} /></Field>
      <Field label="Ko‘cha, uy" error={(L(errors.street?.message ?? '') || undefined)} htmlFor="street"><Input id="street" {...register('street')} /></Field>
      <Field label="Xonadon" htmlFor="apartment"><Input id="apartment" {...register('apartment')} /></Field>
      <Field label={L("Mo‘ljal")} htmlFor="landmark"><Input id="landmark" {...register('landmark')} /></Field>
      <Checkbox label={L("Asosiy manzil")} {...register('is_default')} className="sm:col-span-2" />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>{L("Bekor qilish")}</Button>
        <Button type="submit" loading={isSubmitting}>{L("Saqlash")}</Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const L = useL();
  const [editing, setEditing] = useState<Address | null | 'new'>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{L("Manzillar")}</h1>
        <Button size="sm" onClick={() => setEditing('new')} disabled={addresses.length >= 10}><Plus className="h-4 w-4" /> {L("Qo‘shish")}</Button>
      </div>
      {addresses.length === 0 ? (
        <EmptyState icon={<MapPin className="h-8 w-8" />} title={L("Saqlangan manzil yo‘q")} text={L("Manzil qo‘shsangiz, buyurtma berish tezlashadi.")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-xl border border-line bg-surface p-4 text-sm shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{a.label || L("Manzil")} {a.is_default && <Badge tone="brand">{L("Asosiy")}</Badge>}</p>
                <div className="flex gap-1">
                  <button className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" onClick={() => setEditing(a)} aria-label="Tahrirlash"><Pencil className="h-4 w-4" /></button>
                  <button className="rounded-lg p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger" aria-label="O‘chirish" onClick={async () => {
                    if (!(await confirm({ title: L("Manzilni o‘chirish?"), danger: true, confirmText: 'O‘chirish' }))) return;
                    const res = await deleteAddress(a.id);
                    toast(res.ok ? res.message ?? 'O‘chirildi' : res.error, res.ok ? 'success' : 'error');
                    router.refresh();
                  }}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-1 text-ink-2">{[a.region, a.city, a.street, a.apartment].filter(Boolean).join(', ')}</p>
              {a.landmark && <p className="text-xs text-ink-3">Mo‘ljal: {a.landmark}</p>}
              <p className="mt-1 text-xs text-ink-3">{a.full_name} · {formatUzPhone(a.phone)}</p>
            </li>
          ))}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? L("Yangi manzil") : L("Manzilni tahrirlash")} className="max-w-2xl">
        {editing !== null && <AddressForm address={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const L = useL();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" className="text-danger" loading={pending} onClick={async () => {
      if (!(await confirm({ title: L("Buyurtmani bekor qilasizmi?"), text: L("Bu amalni qaytarib bo‘lmaydi."), confirmText: L("Bekor qilish"), danger: true }))) return;
      start(async () => {
        const res = await cancelMyOrder(orderId);
        toast(res.ok ? res.message ?? L("Bekor qilindi") : res.error, res.ok ? 'success' : 'error');
        router.refresh();
      });
    }}>
      {L("Buyurtmani bekor qilish")}
    </Button>
  );
}
