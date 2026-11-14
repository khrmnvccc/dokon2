'use client';

import { useL } from '@/components/providers';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const L = useL();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <AlertTriangle className="h-12 w-12 text-yandex" />
      <h1 className="mt-4 text-xl font-semibold">{L("Nimadir xato ketdi")}</h1>
      <p className="mt-2 text-sm text-ink-3">{L("Sahifani yuklab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.")}</p>
      <Button className="mt-6" onClick={reset}>{L("Qayta urinish")}</Button>
    </div>
  );
}
