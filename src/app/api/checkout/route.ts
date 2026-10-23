import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { checkoutSchema, fieldErrors } from '@/lib/validation';
import { buildQuote, hasServiceKey } from '@/lib/checkout';
import { getServiceSupabase } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';
import { getCurrentProfile, getCurrentUser } from '@/lib/auth';
import { getPaymentMethods, getSettings } from '@/lib/data/public';
import { isPaymentMethodUsable } from '@/lib/payments';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { couponErrorText, lineErrorText } from '@/lib/pricing';
import { formatPrice } from '@/lib/format';
import { TAGS } from '@/lib/cache-tags';

export const dynamic = 'force-dynamic';

function fail(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Formadagi xatolarni tuzating', 400, { fieldErrors: fieldErrors(parsed.error) });
  const input = parsed.data;

  if (!hasServiceKey()) {
    console.error('checkout: SUPABASE_SERVICE_ROLE_KEY sozlanmagan');
    return fail('Buyurtma qabul qilish vaqtincha ishlamayapti. Iltimos, telefon orqali bog‘laning', 503);
  }

  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  if (!user && !settings.checkout.allow_guest_checkout) return fail('Buyurtma berish uchun tizimga kiring', 401);
  if (user) {
    const profile = await getCurrentProfile();
    if (profile?.is_blocked) return fail('Hisobingiz bloklangan. Qo‘llab-quvvatlash xizmatiga murojaat qiling', 403);
  }

  const ip = await getClientIp();
  if (!(await rateLimit(`checkout:${user?.id ?? ip}`, 5, 600))) return fail('Juda ko‘p buyurtma urinishi. Birozdan so‘ng qayta urinib ko‘ring', 429);

  const { quote, shippingMethod } = await buildQuote({
    items: input.items,
    couponCode: input.couponCode,
    shippingMethodId: input.shippingMethodId,
    withCost: true,
  });

  if (!shippingMethod) return fail('Yetkazib berish usulini tanlang', 400, { fieldErrors: { shippingMethodId: 'Yetkazib berish usulini tanlang' } });
  if (shippingMethod.requires_address && !input.address) {
    return fail('Yetkazib berish manzilini kiriting', 400, { fieldErrors: { 'address.street': 'Manzilni kiriting' } });
  }
  const paymentMethod = (await getPaymentMethods()).find((m) => m.id === input.paymentMethodId);
  if (!paymentMethod || !isPaymentMethodUsable(paymentMethod)) return fail('Bu to‘lov usuli hozir mavjud emas', 400);

  const lineError = quote.lines.find((l) => l.error);
  if (lineError) {
    return fail(`${lineError.name}: ${lineErrorText[lineError.error!]}${lineError.available ? ` (mavjud: ${lineError.available} dona)` : ''}`, 409, { quote: true });
  }
  if (quote.hasErrors) return fail('Savatcha bo‘sh', 409);
  if (quote.couponError) return fail(couponErrorText[quote.couponError], 409, { fieldErrors: { couponCode: couponErrorText[quote.couponError] } });
  if (quote.belowMinimum) return fail(`Minimal buyurtma summasi: ${formatPrice(quote.minOrderAmount, settings.localization.currency_symbol)}`, 409);

  const payload = {
    idempotency_key: input.idempotencyKey,
    user_id: user?.id ?? null,
    payment_method_id: paymentMethod.id,
    payment_method_name: paymentMethod.name,
    payment_provider: paymentMethod.provider,
    shipping_method_id: shippingMethod.id,
    shipping_method_name: shippingMethod.name,
    customer_name: input.customer_name,
    customer_phone: input.phone,
    customer_email: input.email || null,
    address: shippingMethod.requires_address ? input.address : null,
    comment: input.comment || null,
    subtotal: quote.subtotal,
    discount_total: quote.discount,
    coupon_id: quote.coupon?.id ?? null,
    coupon_code: quote.coupon?.code ?? null,
    shipping_cost: quote.shipping,
    total: quote.total,
    cost_total: quote.costTotal,
    items: quote.lines.map((l) => ({
      product_id: l.productId,
      variant_id: l.variantId,
      product_name: l.name,
      variant_name: l.variantName,
      sku: l.sku,
      image_url: l.imageUrl,
      unit_price: l.unitPrice,
      original_price: l.originalPrice,
      cost_price: l.costPrice,
      quantity: l.quantity,
      discount: l.couponDiscount,
      line_total: l.lineTotal - l.couponDiscount,
    })),
  };

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('place_order', { p: payload });
  if (error) {
    const msg = error.message ?? '';
    if (msg.startsWith('OUT_OF_STOCK')) return fail(`Omborda yetarli emas: ${msg.split(':').slice(1).join(':')}`, 409, { quote: true });
    if (msg.startsWith('PRODUCT_UNAVAILABLE')) return fail(`Mahsulot sotuvda yo‘q: ${msg.split(':').slice(1).join(':')}`, 409, { quote: true });
    if (msg === 'COUPON_USER_LIMIT') return fail('Siz bu promo-koddan allaqachon foydalangansiz', 409, { fieldErrors: { couponCode: 'Promo-koddan allaqachon foydalanilgan' } });
    if (msg === 'COUPON_INVALID') return fail('Promo-kod endi amal qilmaydi', 409, { fieldErrors: { couponCode: 'Promo-kod amal qilmaydi' } });
    if (msg === 'USER_BLOCKED') return fail('Hisobingiz bloklangan', 403);
    console.error('place_order', msg);
    return fail('Buyurtmani saqlab bo‘lmadi. Qayta urinib ko‘ring', 500);
  }
  const order = data as { id: string; number: number; token: string; duplicate: boolean };

  if (user && !order.duplicate) {
    const supabase = await getServerSupabase();
    if (input.saveAddress && input.address && shippingMethod.requires_address) {
      const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((count ?? 0) < 10) {
        await supabase.from('addresses').insert({
          user_id: user.id, full_name: input.customer_name, phone: input.phone, ...input.address, is_default: !count,
        });
      }
    }
    const { data: cart } = await supabase.from('carts').select('id').eq('user_id', user.id).maybeSingle();
    if (cart) await supabase.from('cart_items').delete().eq('cart_id', cart.id);
  }

  revalidateTag(TAGS.products);
  return NextResponse.json({ ok: true, number: order.number, token: order.token });
}
