import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPaymentMethods, getSettings, getShippingMethods } from '@/lib/data/public';
import { getCurrentProfile, getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { isPaymentMethodUsable } from '@/lib/payments';
import { CheckoutForm } from '@/components/shop/checkout-form';
import type { Address } from '@/lib/types';

export const metadata: Metadata = { title: 'Buyurtmani rasmiylashtirish', robots: { index: false } };

export default async function CheckoutPage() {
  const [settings, user, shipping, payments] = await Promise.all([getSettings(), getCurrentUser(), getShippingMethods(), getPaymentMethods()]);
  if (!user && !settings.checkout.allow_guest_checkout) redirect('/login?next=/checkout');

  let addresses: Address[] = [];
  const profile = user ? await getCurrentProfile() : null;
  if (user) {
    const supabase = await getServerSupabase();
    const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at');
    addresses = (data ?? []) as Address[];
  }

  return (
    <CheckoutForm
      shippingMethods={shipping}
      // Ulanmagan onlayn to'lovlar (Click/Payme) ko'rsatilmaydi
      paymentMethods={payments.filter(isPaymentMethodUsable)}
      addresses={addresses}
      defaults={{ name: profile?.full_name ?? '', phone: profile?.phone ?? '', email: profile?.email ?? user?.email ?? '' }}
      isGuest={!user}
      orderNote={settings.checkout.order_note}
    />
  );
}
