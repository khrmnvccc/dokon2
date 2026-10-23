'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h1 className="mt-4 text-xl font-bold">Nimadir xato ketdi</h1>
      <p className="mt-2 text-sm text-muted">Sahifani yuklab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.</p>
      <Button className="mt-6" onClick={reset}>Qayta urinish</Button>
    </div>
  );
}
