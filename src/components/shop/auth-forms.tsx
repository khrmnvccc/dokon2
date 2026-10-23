'use client';

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
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted" aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FormError({ text }: { text: string | null }) {
  return text ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{text}</p> : null;
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [error, setErr] = useState<string | null>(linkError ? 'Havola eskirgan yoki noto‘g‘ri. Qaytadan urinib ko‘ring' : null);
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
      <Field label="Email" error={errors.email?.message} htmlFor="email">
        <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label="Parol" error={errors.password?.message} htmlFor="password">
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <div className="text-right text-sm"><Link href="/forgot-password" className="font-medium text-brand hover:underline">Parolni unutdingizmi?</Link></div>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Kirish</Button>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [error, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<z.input<typeof registerSchema>, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });
  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto h-12 w-12 text-brand" />
        <h2 className="mt-3 text-lg font-bold">Pochtangizni tekshiring</h2>
        <p className="mt-1 text-sm text-muted">Hisobni faollashtirish uchun emailga yuborilgan havolani bosing.</p>
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
      <Field label="Ism va familiya" error={errors.full_name?.message} htmlFor="full_name">
        <Input id="full_name" autoComplete="name" aria-invalid={!!errors.full_name} {...register('full_name')} />
      </Field>
      <Field label="Telefon" error={errors.phone?.message} htmlFor="phone">
        <Input id="phone" type="tel" autoComplete="tel" placeholder="+998 90 123 45 67" aria-invalid={!!errors.phone} {...register('phone')} />
      </Field>
      <Field label="Email" error={errors.email?.message} htmlFor="email">
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field label="Parol" hint="Kamida 8 belgi, harf va raqam" error={errors.password?.message} htmlFor="password">
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <Field label="Parolni takrorlang" error={errors.password_confirm?.message} htmlFor="password_confirm">
        <PasswordInput id="password_confirm" autoComplete="new-password" aria-invalid={!!errors.password_confirm} {...register('password_confirm')} />
      </Field>
      <div>
        <Checkbox label={<>Men <Link href="/terms" className="text-brand underline" target="_blank">foydalanish shartlari</Link> va <Link href="/privacy" className="text-brand underline" target="_blank">maxfiylik siyosati</Link>ga roziman</>} {...register('accept')} />
        {errors.accept && <p className="mt-1 text-xs text-red-600">{errors.accept.message}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Ro‘yxatdan o‘tish</Button>
    </form>
  );
}

const forgotSchema = z.object({ email: emailSchema });
export function ForgotForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
  if (message) return <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>;
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      const res = await requestPasswordReset(v);
      if (res.ok) setMessage(res.message ?? 'Yuborildi');
      else setErr(res.error);
    })}>
      <FormError text={error} />
      <Field label="Email" error={errors.email?.message} htmlFor="email">
        <Input id="email" type="email" autoComplete="email" autoFocus {...register('email')} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Havola yuborish</Button>
    </form>
  );
}

const resetSchema = z.object({ password: passwordSchema, password_confirm: z.string() })
  .refine((d) => d.password === d.password_confirm, { path: ['password_confirm'], message: 'Parollar mos emas' });
export function ResetForm() {
  const [error, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  if (done) return <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Parol yangilandi. <Link href="/account" className="font-semibold underline">Profilga o‘tish</Link></p>;
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      const res = await updatePassword(v);
      if (res.ok) setDone(true);
      else setErr(res.error);
    })}>
      <FormError text={error} />
      <Field label="Yangi parol" hint="Kamida 8 belgi, harf va raqam" error={errors.password?.message} htmlFor="password">
        <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <Field label="Parolni takrorlang" error={errors.password_confirm?.message} htmlFor="password_confirm">
        <PasswordInput id="password_confirm" autoComplete="new-password" {...register('password_confirm')} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Saqlash</Button>
    </form>
  );
}
