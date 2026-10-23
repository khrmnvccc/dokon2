import Link from 'next/link';

// Do'kon layout'idan tashqaridagi 404 (masalan, notFound() admin ichida emas, noma'lum yo'l)
export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-extrabold text-brand">404</p>
      <h1 className="mt-3 text-2xl font-bold">Sahifa topilmadi</h1>
      <p className="mt-2 text-muted">Manzil noto‘g‘ri yoki sahifa o‘chirilgan.</p>
      <Link href="/" className="mt-6 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">Bosh sahifaga qaytish</Link>
    </main>
  );
}
