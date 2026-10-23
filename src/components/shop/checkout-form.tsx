'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banknote, CreditCard, MapPin, ShoppingCart, Store, Truck, Package, Info } from 'lucide-react';
import { useApp, useCart } from '@/components/providers';
import { useToast } from '@/components/ui/toast';
import { Button, buttonClass } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { addressSchema, emailSchema, uzPhone, UZ_REGIONS } from '@/lib/validation';
import { formatUzPhone } from '@/lib/phone';
import { lineErrorText } from '@/lib/pricing';
import type { Address, PaymentMethod, ShippingMethod } from '@/lib/types';
import { ProductImage } from './product-image';
import { useQuote } from './use-quote';
import { CouponBox, readSavedCoupon, saveCoupon } from './cart-view';

const formSchema = z.object({
  customer_name: z.string().trim().min(2, 'Ismingizni kiriting').max(120),
  phone: uzPhone,
  email: z.union([emailSchema, z.literal('')]).optional(),
  shippingMethodId: z.string().min(1, 'Yetkazib berish usulini tanlang'),
  paymentMethodId: z.string().min(1, 'To‘lov usulini tanlang'),
  region: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  apartment: z.string().optional(),
  landmark: z.string().optional(),
  comment: z.string().trim().max(1000).optional(),
  saveAddress: z.boolean().optional(),
});
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

const shipIcon = { courier: Truck, pickup: Store, post: Package } as const;
const payIcon = { cash: Banknote, card_on_delivery: CreditCard, bank_transfer: CreditCard, online: CreditCard } as const;

export function CheckoutForm({ shippingMethods, paymentMethods, addresses, defaults, isGuest, orderNote }: {
  shippingMethods: ShippingMethod[];
  paymentMethods: PaymentMethod[];
  addresses: Address[];
  defaults: { name: string; phone: string; email: string };
  isGuest: boolean;
  orderNote: string;
}) {
  const { t, price } = useApp();
  const cart = useCart();
  const toast = useToast();
  const router = useRouter();
  const idempotencyKey = useRef<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>(addresses[0]?.id ?? 'new');
  const done = useRef(false);

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
    setCoupon(readSavedCoupon());
  }, []);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_name: defaults.name,
      phone: defaults.phone ? formatUzPhone(defaults.phone) : '',
      email: defaults.email,
      shippingMethodId: shippingMethods[0]?.id ?? '',
      paymentMethodId: paymentMethods[0]?.id ?? '',
      region: 'Toshkent shahri',
      saveAddress: !isGuest && addresses.length === 0,
    },
  });
  const { register, handleSubmit, watch, setError, formState: { errors } } = form;
  const shippingId = watch('shippingMethodId');
  const shipping = shippingMethods.find((m) => m.id === shippingId) ?? null;
  const needsAddress = shipping?.requires_address ?? false;
  const { quote, loading } = useQuote(cart.items, cart.ready, coupon, shippingId || null);
  const savedAddress = useMemo(() => addresses.find((a) => a.id === selectedAddress) ?? null, [addresses, selectedAddress]);

  if (!cart.ready) return <Skeleton className="h-96 rounded-2xl" />;
  if (!cart.items.length && !done.current) {
    return (
      <EmptyState icon={<ShoppingCart className="h-8 w-8" />} title={t('cart.empty')} text={t('cart.emptyText')}
        action={<Link href="/catalog" className={buttonClass('primary')}>{t('nav.catalog')}</Link>} />
    );
  }

  const onSubmit = async (values: FormOut) => {
    if (submitting) return;
    setServerError(null);
    let address: z.infer<typeof addressSchema> | null = null;
    if (needsAddress) {
      const raw = savedAddress
        ? { region: savedAddress.region, city: savedAddress.city, street: savedAddress.street, apartment: savedAddress.apartment, landmark: savedAddress.landmark }
        : { region: values.region, city: values.city, street: values.street, apartment: values.apartment, landmark: values.landmark };
      const parsed = addressSchema.safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) setError(issue.path[0] as 'street', { message: issue.message });
        return;
      }
      address = parsed.data;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          items: cart.items,
          customer_name: values.customer_name,
          phone: values.phone,
          email: values.email || '',
          shippingMethodId: values.shippingMethodId,
          paymentMethodId: values.paymentMethodId,
          address,
          comment: values.comment || null,
          couponCode: coupon,
          saveAddress: Boolean(values.saveAddress && !savedAddress),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(data.error ?? 'Xatolik yuz berdi');
        if (data.fieldErrors?.couponCode) {
          setCoupon(null);
          saveCoupon(null);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSubmitting(false);
        return;
      }
      done.current = true;
      cart.clear();
      saveCoupon(null);
      router.replace(`/order/success?token=${encodeURIComponent(data.token)}`);
    } catch {
      // Tarmoq xatosi: bir xil idempotency kalit bilan qayta yuborish xavfsiz (dublikat yaratilmaydi)
      toast('Internet aloqasini tekshirib, qayta bosing', 'error');
      setSubmitting(false);
    }
  };

  const blocked = !quote || quote.hasErrors || quote.belowMinimum || loading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t('checkout.title')}</h1>
      {serverError && <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{serverError}</div>}
      {isGuest && (
        <p className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Buyurtmalaringizni kuzatish uchun <Link href="/login?next=/checkout" className="font-semibold underline">tizimga kiring</Link> yoki ro‘yxatdan o‘tmasdan davom eting.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-4">
          <Section n={1} title="Qabul qiluvchi">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ism va familiya" required error={errors.customer_name?.message} htmlFor="customer_name">
                <Input id="customer_name" autoComplete="name" aria-invalid={!!errors.customer_name} {...register('customer_name')} />
              </Field>
              <Field label="Telefon" required error={errors.phone?.message} htmlFor="phone">
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" aria-invalid={!!errors.phone} {...register('phone')} />
              </Field>
              <Field label="Email" hint="Ixtiyoriy" error={errors.email?.message} htmlFor="email" className="sm:col-span-2">
                <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
              </Field>
            </div>
          </Section>

          <Section n={2} title="Yetkazib berish">
            {shippingMethods.length === 0 && <p className="text-sm text-red-600">Yetkazib berish usullari sozlanmagan.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {shippingMethods.map((m) => {
                const Icon = shipIcon[m.kind];
                return (
                  <label key={m.id} className={cn('flex cursor-pointer gap-3 rounded-xl border-2 p-3 transition', shippingId === m.id ? 'border-brand bg-brand-50/50' : 'border-line hover:border-slate-300')}>
                    <input type="radio" value={m.id} className="sr-only" {...register('shippingMethodId')} />
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2 text-sm font-semibold">
                        {m.name}
                        <span>{m.kind === 'pickup' || m.price === 0 ? t('cart.free') : price(m.price)}</span>
                      </span>
                      {m.eta && <span className="block text-xs text-muted">{m.eta}</span>}
                      {m.free_from ? <span className="block text-xs text-muted">{price(m.free_from)} dan bepul</span> : null}
                      {m.description && <span className="mt-0.5 block text-xs text-muted">{m.description}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.shippingMethodId && <p className="mt-2 text-xs text-red-600">{errors.shippingMethodId.message}</p>}

            {needsAddress && (
              <div className="mt-4 space-y-3">
                {addresses.length > 0 && (
                  <div className="space-y-2">
                    {addresses.map((a) => (
                      <label key={a.id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 text-sm', selectedAddress === a.id ? 'border-brand bg-brand-50/50' : 'border-line')}>
                        <input type="radio" name="saved-address" checked={selectedAddress === a.id} onChange={() => setSelectedAddress(a.id)} className="mt-1 accent-[var(--brand)]" />
                        <span><MapPin className="mr-1 inline h-4 w-4 text-brand" />{a.label && <b>{a.label}: </b>}{[a.region, a.city, a.street, a.apartment].filter(Boolean).join(', ')}</span>
                      </label>
                    ))}
                    <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-sm', selectedAddress === 'new' ? 'border-brand bg-brand-50/50' : 'border-line')}>
                      <input type="radio" name="saved-address" checked={selectedAddress === 'new'} onChange={() => setSelectedAddress('new')} className="accent-[var(--brand)]" />
                      Yangi manzil
                    </label>
                  </div>
                )}
                {!savedAddress && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Viloyat" required error={errors.region?.message} htmlFor="region">
                      <Select id="region" {...register('region')}>
                        {UZ_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </Field>
                    <Field label="Tuman / shahar" error={errors.city?.message} htmlFor="city">
                      <Input id="city" autoComplete="address-level2" {...register('city')} />
                    </Field>
                    <Field label="Ko‘cha, uy" required error={errors.street?.message} htmlFor="street" className="sm:col-span-2">
                      <Input id="street" autoComplete="street-address" aria-invalid={!!errors.street} {...register('street')} />
                    </Field>
                    <Field label="Xonadon / ofis" htmlFor="apartment">
                      <Input id="apartment" {...register('apartment')} />
                    </Field>
                    <Field label="Mo‘ljal" htmlFor="landmark">
                      <Input id="landmark" placeholder="Masalan: maktab yonida" {...register('landmark')} />
                    </Field>
                    {!isGuest && <Checkbox label="Manzilni saqlab qo‘yish" {...register('saveAddress')} className="sm:col-span-2" />}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section n={3} title="To‘lov usuli">
            {paymentMethods.length === 0 && <p className="text-sm text-red-600">To‘lov usullari sozlanmagan.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {paymentMethods.map((m) => {
                const Icon = payIcon[m.kind];
                return (
                  <label key={m.id} className={cn('flex cursor-pointer gap-3 rounded-xl border-2 p-3 transition', watch('paymentMethodId') === m.id ? 'border-brand bg-brand-50/50' : 'border-line hover:border-slate-300')}>
                    <input type="radio" value={m.id} className="sr-only" {...register('paymentMethodId')} />
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                    <span>
                      <span className="block text-sm font-semibold">{m.name}</span>
                      {m.description && <span className="block text-xs text-muted">{m.description}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.paymentMethodId && <p className="mt-2 text-xs text-red-600">{errors.paymentMethodId.message}</p>}
            <Field label="Izoh" hint="Kuryer uchun qo‘shimcha ma’lumot" htmlFor="comment" className="mt-4">
              <Textarea id="comment" rows={3} maxLength={1000} {...register('comment')} />
            </Field>
          </Section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24">
          <CouponBox applied={quote?.coupon?.code ?? null} requested={coupon} error={quote?.couponError ?? null}
            onApply={(c) => { setCoupon(c); saveCoupon(c); }} />
          <div className={cn('rounded-2xl bg-white p-4 shadow-card sm:p-5', loading && 'opacity-70')}>
            <h2 className="mb-3 font-bold">Buyurtmangiz</h2>
            <ul className="max-h-72 space-y-3 overflow-auto pr-1">
              {(quote?.lines ?? []).map((l) => (
                <li key={`${l.productId}:${l.variantId ?? ''}`} className="flex gap-3 text-sm">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg"><ProductImage src={l.imageUrl} alt={l.name} sizes="56px" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2">{l.name}</p>
                    <p className="text-xs text-muted">{l.variantName ? `${l.variantName} · ` : ''}{l.quantity} dona</p>
                    {l.error && <p className="text-xs font-medium text-red-600">{lineErrorText[l.error]}</p>}
                  </div>
                  <span className="shrink-0 font-semibold">{price(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {quote && (
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between"><dt className="text-muted">{t('cart.subtotal')}</dt><dd>{price(quote.subtotal)}</dd></div>
                {quote.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>{t('cart.discount')}</dt><dd>−{price(quote.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted">{t('cart.shipping')}</dt><dd>{quote.shipping === 0 ? t('cart.free') : price(quote.shipping)}</dd></div>
                <div className="flex justify-between border-t border-line pt-3 text-lg"><dt className="font-bold">{t('cart.total')}</dt><dd className="font-extrabold">{price(quote.total)}</dd></div>
              </dl>
            )}
            {quote?.belowMinimum && <p className="mt-3 text-xs font-medium text-amber-700">{t('cart.minOrder', { amount: price(quote.minOrderAmount) })}</p>}
            {quote?.hasErrors && <p className="mt-3 text-xs font-medium text-red-600">Savatchadagi xatolarni tuzating. <Link href="/cart" className="underline">Savatchaga qaytish</Link></p>}
            <Button type="submit" size="lg" className="mt-4 w-full" loading={submitting} disabled={blocked || submitting}>
              {t('checkout.place')}
            </Button>
            {orderNote && <p className="mt-3 flex gap-1.5 text-xs text-muted"><Info className="h-4 w-4 shrink-0" />{orderNote}</p>}
            <p className="mt-2 text-center text-xs text-muted">
              Buyurtma berish orqali <Link href="/terms" className="underline">foydalanish shartlariga</Link> rozilik bildirasiz
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-card sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
