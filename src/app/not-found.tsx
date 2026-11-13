import Link from 'next/link';

// Do'kon layout'idan tashqaridagi 404 (masalan, notFound() admin ichida emas, noma'lum yo'l)
export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-semibold text-primary">404</p>
      <h1 className="mt-3 text-[22px] font-semibold tracking-tight sm:text-2xl">Sahifa topilmadi</h1>
      <p className="mt-2 text-ink-3">Manzil noto‘g‘ri yoki sahifa o‘chirilgan.</p>
      <Link href="/" className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-fg">Bosh sahifaga qaytish</Link>
    </main>
  );
}
