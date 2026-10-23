'use client';

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
        toast(res.message ?? 'Saqlandi');
        router.refresh();
      } else {
        toast(res.error, 'error');
        for (const [k, m] of Object.entries(res.fieldErrors ?? {})) setError(k as 'phone', { message: m });
      }
    })}>
      <Field label="Ism va familiya" error={errors.full_name?.message} htmlFor="full_name"><Input id="full_name" {...register('full_name')} /></Field>
      <Field label="Telefon" error={errors.phone?.message} htmlFor="phone"><Input id="phone" type="tel" {...register('phone')} /></Field>
      <Field label="Email" hint="Emailni o‘zgartirib bo‘lmaydi" className="sm:col-span-2"><Input value={email} disabled readOnly /></Field>
      <div className="sm:col-span-2"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Saqlash</Button></div>
    </form>
  );
}

type AddrIn = z.input<typeof savedAddressSchema>;
type AddrOut = z.output<typeof savedAddressSchema>;

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<AddrIn, unknown, AddrOut>({
    resolver: zodResolver(savedAddressSchema),
    defaultValues: address
      ? { ...address, phone: formatUzPhone(address.phone) }
      : { region: 'Toshkent shahri', full_name: '', phone: '', street: '', is_default: false },
  });
  return (
    <form className="grid gap-3 sm:grid-cols-2" noValidate onSubmit={handleSubmit(async (v) => {
      const res = await saveAddress(v, address?.id);
      if (res.ok) {
        toast(res.message ?? 'Saqlandi');
        router.refresh();
        onDone();
      } else {
        toast(res.error, 'error');
        for (const [k, m] of Object.entries(res.fieldErrors ?? {})) setError(k as 'street', { message: m });
      }
    })}>
      <Field label="Nomi" hint="Masalan: Uy, Ish" htmlFor="label"><Input id="label" {...register('label')} /></Field>
      <Field label="Qabul qiluvchi" error={errors.full_name?.message} htmlFor="full_name"><Input id="full_name" {...register('full_name')} /></Field>
      <Field label="Telefon" error={errors.phone?.message} htmlFor="aphone"><Input id="aphone" type="tel" {...register('phone')} /></Field>
      <Field label="Viloyat" error={errors.region?.message} htmlFor="region">
        <Select id="region" {...register('region')}>{UZ_REGIONS.map((r) => <option key={r}>{r}</option>)}</Select>
      </Field>
      <Field label="Tuman / shahar" htmlFor="city"><Input id="city" {...register('city')} /></Field>
      <Field label="Ko‘cha, uy" error={errors.street?.message} htmlFor="street"><Input id="street" {...register('street')} /></Field>
      <Field label="Xonadon" htmlFor="apartment"><Input id="apartment" {...register('apartment')} /></Field>
      <Field label="Mo‘ljal" htmlFor="landmark"><Input id="landmark" {...register('landmark')} /></Field>
      <Checkbox label="Asosiy manzil" {...register('is_default')} className="sm:col-span-2" />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" loading={isSubmitting}>Saqlash</Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [editing, setEditing] = useState<Address | null | 'new'>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Manzillar</h1>
        <Button size="sm" onClick={() => setEditing('new')} disabled={addresses.length >= 10}><Plus className="h-4 w-4" /> Qo‘shish</Button>
      </div>
      {addresses.length === 0 ? (
        <EmptyState icon={<MapPin className="h-8 w-8" />} title="Saqlangan manzil yo‘q" text="Manzil qo‘shsangiz, buyurtma berish tezlashadi." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl bg-white p-4 text-sm shadow-card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{a.label || 'Manzil'} {a.is_default && <Badge tone="brand">Asosiy</Badge>}</p>
                <div className="flex gap-1">
                  <button className="rounded-lg p-1.5 text-muted hover:bg-slate-100" onClick={() => setEditing(a)} aria-label="Tahrirlash"><Pencil className="h-4 w-4" /></button>
                  <button className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600" aria-label="O‘chirish" onClick={async () => {
                    if (!(await confirm({ title: 'Manzilni o‘chirish?', danger: true, confirmText: 'O‘chirish' }))) return;
                    const res = await deleteAddress(a.id);
                    toast(res.ok ? res.message ?? 'O‘chirildi' : res.error, res.ok ? 'success' : 'error');
                    router.refresh();
                  }}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-1 text-slate-600">{[a.region, a.city, a.street, a.apartment].filter(Boolean).join(', ')}</p>
              {a.landmark && <p className="text-xs text-muted">Mo‘ljal: {a.landmark}</p>}
              <p className="mt-1 text-xs text-muted">{a.full_name} · {formatUzPhone(a.phone)}</p>
            </li>
          ))}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Yangi manzil' : 'Manzilni tahrirlash'} className="max-w-2xl">
        {editing !== null && <AddressForm address={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" className="text-red-600" loading={pending} onClick={async () => {
      if (!(await confirm({ title: 'Buyurtmani bekor qilasizmi?', text: 'Bu amalni qaytarib bo‘lmaydi.', confirmText: 'Bekor qilish', danger: true }))) return;
      start(async () => {
        const res = await cancelMyOrder(orderId);
        toast(res.ok ? res.message ?? 'Bekor qilindi' : res.error, res.ok ? 'success' : 'error');
        router.refresh();
      });
    }}>
      Buyurtmani bekor qilish
    </Button>
  );
}
