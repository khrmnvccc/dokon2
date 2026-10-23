import { z } from 'zod';
import { normalizeUzPhone } from './phone';

export const uzPhone = z
  .string()
  .trim()
  .min(1, 'Telefon raqamini kiriting')
  .transform((v, ctx) => {
    const n = normalizeUzPhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Telefon raqami noto‘g‘ri. Masalan: +998 90 123 45 67' });
      return z.NEVER;
    }
    return n;
  });

export const emailSchema = z.string().trim().toLowerCase().email('Email noto‘g‘ri').max(120);
export const passwordSchema = z
  .string()
  .min(8, 'Parol kamida 8 ta belgidan iborat bo‘lsin')
  .max(72, 'Parol juda uzun')
  .regex(/[A-Za-z]/, 'Parolda kamida bitta harf bo‘lsin')
  .regex(/\d/, 'Parolda kamida bitta raqam bo‘lsin');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Parolni kiriting').max(72),
});

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Ismingizni kiriting').max(120),
    phone: uzPhone,
    email: emailSchema,
    password: passwordSchema,
    password_confirm: z.string(),
    accept: z.literal(true, { errorMap: () => ({ message: 'Shartlarga rozilik bering' }) }),
  })
  .refine((d) => d.password === d.password_confirm, { path: ['password_confirm'], message: 'Parollar mos emas' });

export const addressSchema = z.object({
  region: z.string().trim().min(2, 'Viloyatni tanlang').max(80),
  city: z.string().trim().max(80).optional().nullable(),
  street: z.string().trim().min(3, 'Manzilni kiriting').max(200),
  apartment: z.string().trim().max(60).optional().nullable(),
  landmark: z.string().trim().max(200).optional().nullable(),
});

export const savedAddressSchema = addressSchema.extend({
  label: z.string().trim().max(40).optional().nullable(),
  full_name: z.string().trim().min(2, 'Ismni kiriting').max(120),
  phone: uzPhone,
  is_default: z.boolean().optional(),
});

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(999),
});

export const cartSchema = z.array(cartLineSchema).max(100);

export const quoteRequestSchema = z.object({
  items: cartSchema,
  couponCode: z.string().trim().toUpperCase().max(32).optional().nullable(),
  shippingMethodId: z.string().uuid().optional().nullable(),
});

export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    items: cartSchema.min(1, 'Savatcha bo‘sh'),
    customer_name: z.string().trim().min(2, 'Ismingizni kiriting').max(120),
    phone: uzPhone,
    email: z.union([emailSchema, z.literal('')]).optional(),
    shippingMethodId: z.string().uuid('Yetkazib berish usulini tanlang'),
    paymentMethodId: z.string().uuid('To‘lov usulini tanlang'),
    address: addressSchema.optional().nullable(),
    comment: z.string().trim().max(1000).optional().nullable(),
    couponCode: z.string().trim().toUpperCase().max(32).optional().nullable(),
    saveAddress: z.boolean().optional(),
  });

export const reviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, 'Bahoni tanlang').max(5),
  body: z.string().trim().max(2000).optional(),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Ismni kiriting').max(120),
  phone: uzPhone,
});

export const trackSchema = z.object({
  number: z.coerce.number().int().positive('Buyurtma raqamini kiriting'),
  phone: uzPhone,
});

export type CheckoutInput = z.input<typeof checkoutSchema>;

/** Zod xatolarini { maydon: xabar } ko'rinishiga o'tkazish */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const UZ_REGIONS = [
  'Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', 'Farg‘ona', 'Jizzax', 'Xorazm', 'Namangan', 'Navoiy',
  'Qashqadaryo', 'Qoraqalpog‘iston Respublikasi', 'Samarqand', 'Sirdaryo', 'Surxondaryo',
];
