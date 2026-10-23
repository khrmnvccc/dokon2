import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthCard } from '@/components/shop/auth-card';
import { RegisterForm } from '@/components/shop/auth-forms';

export const metadata: Metadata = { title: 'Ro‘yxatdan o‘tish', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect('/account');
  return (
    <AuthCard title="Ro‘yxatdan o‘tish" subtitle="Buyurtmalar tarixi, saqlangan manzillar va sevimlilar"
      footer={<>Hisobingiz bormi? <Link href="/login" className="font-semibold text-brand hover:underline">Kirish</Link></>}>
      <RegisterForm next={next} />
    </AuthCard>
  );
}
