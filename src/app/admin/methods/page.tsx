import { requirePagePermission } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getPaymentKeys, providerReady, publicKeyStatus } from '@/lib/payments/config';
import { parseSettings } from '@/lib/settings-schema';
import { SITE_URL } from '@/lib/env';
import { OnlinePaymentsPanel } from '@/components/admin/online-payments';
import { PageHeader } from '@/components/admin/ui';
import { MethodsManager } from '@/components/admin/methods-manager';
import { InstallmentSettings } from '@/components/admin/installment-settings';
import type { PaymentMethod, ShippingMethod } from '@/lib/types';

export const metadata = { title: 'Yetkazish va to‘lov' };

export default async function MethodsPage() {
  const ctx = await requirePagePermission('payments.write');
  const supabase = await getServerSupabase();
  const [{ data: shipping }, { data: payment }, keys, { data: rows }] = await Promise.all([
    supabase.from('shipping_methods').select('*').order('sort_order'),
    supabase.from('payment_methods').select('*').order('sort_order'),
    getPaymentKeys(),
    supabase.from('site_settings').select('key, value').in('key', ['online_payments', 'installments']),
  ]);
  // Onlayn provayder holati faqat serverda aniqlanadi (kalitlar va integratsiya kodi)
  const configured = { click: providerReady(keys, 'click'), payme: providerReady(keys, 'payme'), uzum: false };
  return (
    <div>
      <PageHeader title="Yetkazish va to‘lov" description="Narxlar, bepul yetkazish chegarasi va to‘lov usullari checkout’da darhol qo‘llanadi" />
      <MethodsManager shipping={(shipping ?? []) as ShippingMethod[]} payment={(payment ?? []) as PaymentMethod[]} configured={configured} />
      <div className="mt-4">
        <InstallmentSettings initial={parseSettings(rows ?? []).installments} canEdit={ctx.permissions.has('settings.write')} />
      </div>
      <div className="mt-4">
        <OnlinePaymentsPanel status={publicKeyStatus(keys)} siteUrl={SITE_URL} settings={parseSettings(rows ?? []).online_payments} isOwner={ctx.roles.includes('super_admin')} />
      </div>
    </div>
  );
}
