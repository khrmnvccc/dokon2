import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { safeNext } from '@/lib/safe-next';
import { AuthCard } from '@/components/shop/auth-card';
import { LoginForm } from '@/components/shop/auth-forms';

export const metadata: Metadata = { title: 'Kirish', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  return (
    <AuthCard title="Kirish" subtitle="Buyurtmalar va sevimlilaringiz uchun hisobingizga kiring"
      footer={<>Hisobingiz yo‘qmi? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand hover:underline">Ro‘yxatdan o‘ting</Link></>}>
      <LoginForm next={next} linkError={error === 'link'} />
    </AuthCard>
  );
}
