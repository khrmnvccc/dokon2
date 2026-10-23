import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { providers } from '@/lib/payments';
import { PageHeader } from '@/components/admin/ui';
import { MethodsManager } from '@/components/admin/methods-manager';
import type { PaymentMethod, ShippingMethod } from '@/lib/types';

export const metadata = { title: 'Yetkazish va to‘lov' };

export default async function MethodsPage() {
  await requirePagePermission('payments.write');
  const supabase = await getServerSupabase();
  const [{ data: shipping }, { data: payment }] = await Promise.all([
    supabase.from('shipping_methods').select('*').order('sort_order'),
    supabase.from('payment_methods').select('*').order('sort_order'),
  ]);
  // Onlayn provayder holati faqat serverda aniqlanadi (kalitlar va integratsiya kodi)
  const configured = Object.fromEntries(Object.entries(providers).map(([k, p]) => [k, p.isConfigured()]));
  return (
    <div>
      <PageHeader title="Yetkazish va to‘lov" description="Narxlar, bepul yetkazish chegarasi va to‘lov usullari checkout’da darhol qo‘llanadi" />
      <MethodsManager shipping={(shipping ?? []) as ShippingMethod[]} payment={(payment ?? []) as PaymentMethod[]} configured={configured} />
    </div>
  );
}
