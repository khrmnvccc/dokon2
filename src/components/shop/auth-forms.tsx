'use client';

import { useL } from '@/components/providers';
import Link from 'next/link';
import { useState } from 'react';
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { login, register as registerAction, requestPasswordReset, updatePassword } from '@/lib/actions/auth';
import { emailSchema, loginSchema, passwordSchema, registerSchema } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/field';
import type { ActionResult } from '@/lib/types';

function applyErrors<T extends FieldValues>(res: ActionResult<unknown>, setError: UseFormSetError<T>) {
  if (!res.ok && res.fieldErrors) {
    for (const [k, v] of Object.entries(res.fieldErrors)) setError(k as Path<T>, { message: v });
  }
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  const L = useL();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3" aria-label={show ? L("Parolni yashirish") : L("Parolni ko‘rsatish")}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FormError({ text }: { text: string | null }) {
  return text ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{text}</p> : null;
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const L = useL();
  const [error, setErr] = useState<string | null>(linkError ? L("Havola eskirgan yoki noto‘g‘ri. Qaytadan urinib ko‘ring") : null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.input<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setErr(null);
        const res = await login(values, next);
        if (res.ok) window.location.assign(res.data!.redirectTo);
        else {
          setErr(res.error);
          applyErrors(res, setError);
        }
      })}
    >
      <FormError text={error} />
      <Field label={L("Email")} error={(L(errors.email?.message ?? '') || undefined)} htmlFor="email">
        <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label={L("Parol")} error={(L(errors.password?.message ?? '') || undefined)} htmlFor="password">
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <div className="text-right text-sm"><Link href="/forgot-password" className="font-medium text-primary hover:underline">{L("Parolni unutdingizmi?")}</Link></div>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{L("Kirish")}</Button>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const L = useL();
  const [error, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.input<typeof registerSchema>, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });
  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-3 text-[15px] font-semibold tracking-tight">{L("Pochtangizni tekshiring")}</h2>
        <p className="mt-1 text-sm text-ink-3">{L("Hisobni faollashtirish uchun emailga yuborilgan havolani bosing.")}</p>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setErr(null);
        const res = await registerAction(values, next);
        if (res.ok) {
          if (res.data?.needsConfirmation) setSent(true);
          else window.location.assign(res.data?.redirectTo ?? '/account');
        } else {
          setErr(res.error);
          applyErrors(res, setError);
        }
      })}
    >
      <FormError text={error} />
      <Field label={L("Ism va familiya")} error={(L(errors.full_name?.message ?? '') || undefined)} htmlFor="full_name">
        <Input id="full_name" autoComplete="name" aria-invalid={!!errors.full_name} {...register('full_name')} />
      </Field>
      <Field label={L("Telefon")} error={(L(errors.phone?.message ?? '') || undefined)} htmlFor="phone">
        <Input id="phone" type="tel" autoComplete="tel" placeholder="+998 90 123 45 67" aria-invalid={!!errors.phone} {...register('phone')} />
      </Field>
      <Field label={L("Email")} error={(L(errors.email?.message ?? '') || undefined)} htmlFor="email">
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label={L("Parol")} hint={L("Kamida 8 belgi, harf va raqam")} error={(L(errors.password?.message ?? '') || undefined)} htmlFor="password">
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <Field label={L("Parolni takrorlang")} error={(L(errors.password_confirm?.message ?? '') || undefined)} htmlFor="password_confirm">
        <PasswordInput id="password_confirm" autoComplete="new-password" aria-invalid={!!errors.password_confirm} {...register('password_confirm')} />
      </Field>
      <div>
        <Checkbox label={<>{L("Men")} <Link href="/terms" className="text-primary underline" target="_blank">{L("foydalanish shartlari")}</Link> va <Link href="/privacy" className="text-primary underline" target="_blank">{L("maxfiylik siyosati")}</Link>{L("ga roziman")}</>} {...register('accept')} />
        {errors.accept && <p className="mt-1 text-xs text-danger">{errors.accept.message}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{L("Ro‘yxatdan o‘tish")}</Button>
    </form>
  );
}

const forgotSchema = z.object({ email: emailSchema });
export function ForgotForm() {
  const L = useL();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
  if (message) return <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{message}</p>;
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      const res = await requestPasswordReset(v);
      if (res.ok) setMessage(res.message ?? 'Yuborildi');
      else setErr(res.error);
    })}>
      <FormError text={error} />
      <Field label={L("Email")} error={(L(errors.email?.message ?? '') || undefined)} htmlFor="email">
        <Input id="email" type="email" autoComplete="email" autoFocus {...register('email')} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{L("Havola yuborish")}</Button>
    </form>
  );
}

const resetSchema = z.object({ password: passwordSchema, password_confirm: z.string() })
  .refine((d) => d.password === d.password_confirm, { path: ['password_confirm'], message: "Parollar mos emas" });
export function ResetForm() {
  const L = useL();
  const [error, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  if (done) return <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{L("Parol yangilandi.")} <Link href="/account" className="font-semibold underline">{L("Profilga o‘tish")}</Link></p>;
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      const res = await updatePassword(v);
      if (res.ok) setDone(true);
      else setErr(res.error);
    })}>
      <FormError text={error} />
      <Field label={L("Yangi parol")} hint={L("Kamida 8 belgi, harf va raqam")} error={(L(errors.password?.message ?? '') || undefined)} htmlFor="password">
        <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <Field label={L("Parolni takrorlang")} error={(L(errors.password_confirm?.message ?? '') || undefined)} htmlFor="password_confirm">
        <PasswordInput id="password_confirm" autoComplete="new-password" {...register('password_confirm')} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{L("Saqlash")}</Button>
    </form>
  );
}
