import { getL } from '@/lib/i18n/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/shop/auth-card';
import { ForgotForm } from '@/components/shop/auth-forms';

export const metadata: Metadata = { title: 'Parolni tiklash', robots: { index: false } };

export default async function ForgotPage() {
  const L = await getL();
  return (
    <AuthCard title={L("Parolni tiklash")} subtitle={L("Emailingizni kiriting, tiklash havolasini yuboramiz")}
      footer={<Link href="/login" className="font-semibold text-primary hover:underline">{L("Kirish sahifasiga qaytish")}</Link>}>
      <ForgotForm />
    </AuthCard>
  );
}
