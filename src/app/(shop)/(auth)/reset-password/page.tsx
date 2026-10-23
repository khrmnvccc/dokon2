import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthCard } from '@/components/shop/auth-card';
import { ResetForm } from '@/components/shop/auth-forms';

export const metadata: Metadata = { title: 'Yangi parol', robots: { index: false } };

export default async function ResetPage() {
  // Tiklash havolasi /auth/callback orqali sessiya yaratadi
  if (!(await getCurrentUser())) redirect('/forgot-password');
  return (
    <AuthCard title="Yangi parol o‘rnatish">
      <ResetForm />
    </AuthCard>
  );
}
