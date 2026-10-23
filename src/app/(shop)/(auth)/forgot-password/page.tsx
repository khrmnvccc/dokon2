import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/shop/auth-card';
import { ForgotForm } from '@/components/shop/auth-forms';

export const metadata: Metadata = { title: 'Parolni tiklash', robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthCard title="Parolni tiklash" subtitle="Emailingizni kiriting, tiklash havolasini yuboramiz"
      footer={<Link href="/login" className="font-semibold text-brand hover:underline">Kirish sahifasiga qaytish</Link>}>
      <ForgotForm />
    </AuthCard>
  );
}
